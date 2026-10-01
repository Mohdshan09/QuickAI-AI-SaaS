// creditPurchaseService — the single owner of top-up purchase state + lifecycle (spec
// §23). A purchase is NOT a subscription (spec §4, §51): it buys one-time credits. It is
// payment-provider independent — a future verified Razorpay webhook (Phase 7) is just
// another caller of confirmPurchase (spec §39-40).
//
// Credits are granted ONLY on confirmation, and exactly once: the grant reuses the Phase 2
// ledger (type PURCHASE) with the deterministic reference `PURCHASE:{purchaseId}`, whose
// (user_id, type, reference_id) partial-unique is the DB-level exactly-once guarantee (spec
// §14, §43). It never touches wallet.balance directly (spec §13).
import crypto from "crypto";
import sql from "../config/Neon.js";
import { grantCredits } from "./creditService.js";
import { getPack } from "./creditPackService.js";
import { TRANSACTION_TYPES } from "../config/credits.js";
import { PurchaseError } from "../lib/purchaseError.js";

const log = (event, fields = {}) =>
  console.log(`[purchase] ${JSON.stringify({ event, at: new Date().toISOString(), ...fields })}`);

// ---- shaping ------------------------------------------------------------
const shape = (row) =>
  row
    ? {
        id: row.id,
        userId: row.user_id,
        creditPackId: row.credit_pack_id,
        pack: row.pack_key ? { key: row.pack_key, name: row.pack_name } : null,
        status: row.status,
        credits: row.credits,
        amount: row.amount,
        currency: row.currency,
        createdAt: row.created_at,
        confirmedAt: row.confirmed_at ?? null,
        cancelledAt: row.cancelled_at ?? null,
      }
    : null;

const getRow = async (purchaseId) => {
  const [row] = await sql`
    SELECT cp.*, p.key AS pack_key, p.name AS pack_name
    FROM credit_purchases cp JOIN credit_packs p ON p.id = cp.credit_pack_id
    WHERE cp.id = ${purchaseId}
  `;
  return shape(row);
};

const audit = async ({ adminUserId = null, targetUserId = null, purchaseId = null, creditPackId = null, action, oldState = null, newState = null, reason = null }) => {
  try {
    await sql`
      INSERT INTO credit_purchase_audit (
        id, admin_user_id, target_user_id, purchase_id, credit_pack_id,
        action, old_state, new_state, reason, created_at
      ) VALUES (
        ${crypto.randomUUID()}, ${adminUserId}, ${targetUserId}, ${purchaseId}, ${creditPackId},
        ${action}, ${oldState}, ${newState}, ${reason}, NOW()
      )
    `;
  } catch (err) {
    console.error("credit_purchase_audit insert failed:", err.message);
  }
};

// ---- reads --------------------------------------------------------------

/** A purchase by id, ownership-checked (spec §29, §38). Admins pass { asAdmin:true }. */
export const getPurchase = async (userId, purchaseId, { asAdmin = false } = {}) => {
  const purchase = await getRow(purchaseId);
  if (!purchase) throw new PurchaseError("PURCHASE_NOT_FOUND", "Purchase not found.");
  if (!asAdmin && purchase.userId !== userId) {
    throw new PurchaseError("PURCHASE_FORBIDDEN", "You do not have access to this purchase.");
  }
  return purchase;
};

/** A user's own purchase history, newest first (spec §28). */
export const getPurchaseHistory = async (userId) => {
  const rows = await sql`
    SELECT cp.*, p.key AS pack_key, p.name AS pack_name
    FROM credit_purchases cp JOIN credit_packs p ON p.id = cp.credit_pack_id
    WHERE cp.user_id = ${userId}
    ORDER BY cp.created_at DESC
  `;
  return rows.map(shape);
};

// ---- lifecycle ----------------------------------------------------------

/**
 * Create a PENDING purchase for a user (spec §11, §26). The pack must be active; credits,
 * amount and currency are SNAPSHOTTED from it (spec §7, §9) — the client can only choose a
 * packKey, never the price/credits. No credits are granted here (spec §11). An optional
 * idempotencyKey dedupes retries/double-clicks per user (spec §41).
 */
export const createPurchase = async (userId, packKey, { idempotencyKey = null } = {}) => {
  const pack = await getPack(packKey);
  if (!pack) throw new PurchaseError("PACK_NOT_FOUND", `Pack ${packKey} does not exist.`);
  if (!pack.isActive) throw new PurchaseError("PACK_INACTIVE", `Pack ${packKey} is not available.`);

  try {
    const [row] = await sql`
      INSERT INTO credit_purchases (
        id, user_id, credit_pack_id, status, credits, amount, currency, idempotency_key, created_at, updated_at
      ) VALUES (
        ${crypto.randomUUID()}, ${userId}, ${pack.id}, 'PENDING',
        ${pack.credits}, ${pack.price}, ${pack.currency}, ${idempotencyKey}, NOW(), NOW()
      )
      RETURNING *
    `;
    const created = shape({ ...row, pack_key: pack.key, pack_name: pack.name });
    await audit({ targetUserId: userId, purchaseId: created.id, creditPackId: pack.id, action: "PURCHASE_CREATED", newState: "PENDING" });
    log("PURCHASE_CREATED", { userId, purchaseId: created.id, pack: pack.key, credits: pack.credits });
    return created;
  } catch (err) {
    // Idempotent creation: a repeat with the same key returns the existing purchase (spec §41).
    if ((err?.code === "23505" || /duplicate key|unique/i.test(err?.message || "")) && idempotencyKey) {
      const [row] = await sql`
        SELECT cp.*, p.key AS pack_key, p.name AS pack_name
        FROM credit_purchases cp JOIN credit_packs p ON p.id = cp.credit_pack_id
        WHERE cp.user_id = ${userId} AND cp.idempotency_key = ${idempotencyKey}
        LIMIT 1
      `;
      if (row) return shape(row);
    }
    if (err?.code === "23503" || /foreign key/i.test(err?.message || "")) {
      throw new PurchaseError("PURCHASE_OPERATION_FAILED", "User does not exist.");
    }
    if (err instanceof PurchaseError) throw err;
    console.error("createPurchase failed:", err.message);
    throw new PurchaseError("PURCHASE_OPERATION_FAILED", "Could not create the purchase.");
  }
};

/**
 * Confirm a purchase → grant its credits exactly once (spec §12, §14, §15, §43). The grant
 * is applied BEFORE the status flip and is idempotent via the ledger's partial-unique on
 * `PURCHASE:{purchaseId}` — so duplicate/concurrent confirms, retries and crashes between the
 * two steps all converge on a single +credits grant and a single lifetime_purchased bump
 * (spec §46). CANCELLED/FAILED/REFUNDED cannot be confirmed (spec §42).
 */
export const confirmPurchase = async (purchaseId, { adminUserId = null, reason = null } = {}) => {
  const purchase = await getRow(purchaseId);
  if (!purchase) throw new PurchaseError("PURCHASE_NOT_FOUND", "Purchase not found.");
  if (purchase.status !== "PENDING" && purchase.status !== "CONFIRMED") {
    throw new PurchaseError("INVALID_PURCHASE_STATE", `A ${purchase.status} purchase cannot be confirmed.`);
  }

  // 1) Grant first, idempotently. The ledger reference makes this exactly-once (spec §43).
  await grantCredits(
    purchase.userId,
    purchase.credits,
    TRANSACTION_TYPES.PURCHASE,
    `PURCHASE:${purchase.id}`,
    { purchaseId: purchase.id, packKey: purchase.pack?.key }
  );

  // 2) Then flip status (no-op if already CONFIRMED by a concurrent/earlier call).
  if (purchase.status === "PENDING") {
    await sql`
      UPDATE credit_purchases SET status = 'CONFIRMED', confirmed_at = NOW(), updated_at = NOW()
      WHERE id = ${purchaseId} AND status = 'PENDING'
    `;
    await audit({ adminUserId, targetUserId: purchase.userId, purchaseId, creditPackId: purchase.creditPackId, action: "PURCHASE_CONFIRMED", oldState: "PENDING", newState: "CONFIRMED", reason });
    log("PURCHASE_CONFIRMED", { userId: purchase.userId, purchaseId, credits: purchase.credits });
  }
  return getRow(purchaseId);
};

/** Cancel a PENDING purchase (spec §42). Nothing was granted, so no refund is needed. */
export const cancelPurchase = async (purchaseId, { adminUserId = null, reason = null } = {}) => {
  const purchase = await getRow(purchaseId);
  if (!purchase) throw new PurchaseError("PURCHASE_NOT_FOUND", "Purchase not found.");
  if (purchase.status !== "PENDING") {
    throw new PurchaseError("INVALID_PURCHASE_STATE", `Only a PENDING purchase can be cancelled (was ${purchase.status}).`);
  }
  const [row] = await sql`
    UPDATE credit_purchases SET status = 'CANCELLED', cancelled_at = NOW(), updated_at = NOW()
    WHERE id = ${purchaseId} AND status = 'PENDING'
    RETURNING *
  `;
  await audit({ adminUserId, targetUserId: purchase.userId, purchaseId, creditPackId: purchase.creditPackId, action: "PURCHASE_CANCELLED", oldState: "PENDING", newState: "CANCELLED", reason });
  log("PURCHASE_CANCELLED", { purchaseId });
  return shape({ ...row, pack_key: purchase.pack?.key, pack_name: purchase.pack?.name });
};

/**
 * Reserved for Phase 7 (spec §22). Payment refunds are not implemented in Phase 6; the
 * REFUND ledger type already exists so a future verified refund can credit/debit the wallet.
 */
export const refundPurchase = async (/* purchaseId */) => {
  throw new PurchaseError("PURCHASE_OPERATION_FAILED", "Refunds are introduced in Phase 7.");
};
