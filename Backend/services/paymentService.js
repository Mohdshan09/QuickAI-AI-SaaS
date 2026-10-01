// paymentService — the single owner of the Phase 7 manual-UPI payment lifecycle (spec §4).
// It is the manual-verification GATE that sits in front of the existing business operations:
// an admin-CONFIRMED payment calls creditPurchaseService.confirmPurchase (CREDIT_TOPUP) or
// subscriptionService.activateSubscription (SUBSCRIPTION). It never touches the wallet/ledger
// directly, and the rest of the app does not depend on manual UPI — a future gateway replaces
// only confirmPayment's trigger, not the wallet/ledger/subscription architecture (spec §36-37).
//
// Core rule (spec §2, §37): UPI Payment ≠ Payment Confirmation ≠ Credit Grant ≠ Subscription
// Activation. Only CONFIRMED grants benefits; the frontend never declares success.
import crypto from "crypto";
import sql from "../config/Neon.js";
import { confirmPurchase, getPurchase } from "./creditPurchaseService.js";
import { activateSubscription } from "./subscriptionService.js";
import { getPlan } from "./planService.js";
import { PAYMENT_PURPOSES, isKnownPurpose, isValidUtr, getPaymentConfig } from "../config/payments.js";
import { PaymentError } from "../lib/paymentError.js";

const log = (event, fields = {}) =>
  console.log(`[payment] ${JSON.stringify({ event, at: new Date().toISOString(), ...fields })}`);

// ---- shaping ------------------------------------------------------------
const shape = (row) =>
  row
    ? {
        id: row.id,
        userId: row.user_id,
        purpose: row.purpose,
        referenceId: row.reference_id,
        amount: row.amount,
        currency: row.currency,
        status: row.status,
        upiId: row.upi_id ?? null,
        utr: row.utr ?? null,
        userNote: row.user_note ?? null,
        adminNote: row.admin_note ?? null,
        submittedAt: row.submitted_at ?? null,
        verifiedAt: row.verified_at ?? null,
        rejectedAt: row.rejected_at ?? null,
        createdAt: row.created_at,
      }
    : null;

const getRow = async (paymentId) => {
  const [row] = await sql`SELECT * FROM payments WHERE id = ${paymentId}`;
  return shape(row);
};

const audit = async ({ adminUserId = null, targetUserId = null, paymentId = null, action, oldState = null, newState = null, reason = null }) => {
  try {
    await sql`
      INSERT INTO payment_audit (id, admin_user_id, target_user_id, payment_id, action, old_state, new_state, reason, created_at)
      VALUES (${crypto.randomUUID()}, ${adminUserId}, ${targetUserId}, ${paymentId}, ${action}, ${oldState}, ${newState}, ${reason}, NOW())
    `;
  } catch (err) {
    console.error("payment_audit insert failed:", err.message);
  }
};

const isPgDuplicate = (err) =>
  err?.code === "23505" || /duplicate key|unique/i.test(err?.message || "");

// ---- reads --------------------------------------------------------------

/** A payment by id, ownership-checked (spec §26, §31). Admins pass { asAdmin:true }. */
export const getPayment = async (userId, paymentId, { asAdmin = false } = {}) => {
  const payment = await getRow(paymentId);
  if (!payment) throw new PaymentError("PAYMENT_NOT_FOUND", "Payment not found.");
  if (!asAdmin && payment.userId !== userId) {
    throw new PaymentError("PAYMENT_ACCESS_DENIED", "You do not have access to this payment.");
  }
  return payment;
};

/** A user's own payment history, newest first (spec §26). */
export const getPaymentHistory = async (userId) => {
  const rows = await sql`SELECT * FROM payments WHERE user_id = ${userId} ORDER BY created_at DESC`;
  return rows.map(shape);
};

/** Admin: how many payments are awaiting verification (the review queue size). */
export const countPendingReviews = async () => {
  const [row] = await sql`SELECT count(*)::int AS n FROM payments WHERE status = 'ADMIN_REVIEW'`;
  return row?.n ?? 0;
};

/** Admin: list payments with optional filters (spec §23). */
export const listPayments = async ({ status = null, purpose = null, userId = null, limit = 100 } = {}) => {
  const rows = await sql`
    SELECT * FROM payments
    WHERE (${status}::text IS NULL OR status = ${status})
      AND (${purpose}::text IS NULL OR purpose = ${purpose})
      AND (${userId}::text IS NULL OR user_id = ${userId})
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
  return rows.map(shape);
};

// ---- lifecycle ----------------------------------------------------------

/**
 * Create a PENDING payment for a user (spec §13). The amount is read from the DB and
 * snapshotted (spec §7) — the client never supplies it. For CREDIT_TOPUP, referenceId is the
 * user's own PENDING credit_purchases.id; for SUBSCRIPTION, referenceId is a plan key.
 */
export const createPayment = async (userId, purpose, referenceId) => {
  if (!isKnownPurpose(purpose)) throw new PaymentError("INVALID_PAYMENT_PURPOSE", "Unknown payment purpose.");
  if (typeof referenceId !== "string" || !referenceId.trim()) {
    throw new PaymentError("INVALID_PAYMENT_REFERENCE", "A referenceId is required.");
  }
  const ref = referenceId.trim();

  let amount;
  let currency;
  if (purpose === PAYMENT_PURPOSES.CREDIT_TOPUP) {
    // getPurchase enforces ownership (throws PURCHASE_FORBIDDEN/NOT_FOUND).
    let purchase;
    try {
      purchase = await getPurchase(userId, ref);
    } catch {
      throw new PaymentError("INVALID_PAYMENT_REFERENCE", "Unknown or inaccessible purchase.");
    }
    if (purchase.status !== "PENDING") {
      throw new PaymentError("INVALID_PAYMENT_REFERENCE", `Purchase is already ${purchase.status}.`);
    }
    amount = purchase.amount;
    currency = purchase.currency;
  } else {
    const plan = await getPlan(ref);
    if (!plan || !plan.isActive || plan.price <= 0) {
      throw new PaymentError("INVALID_PAYMENT_REFERENCE", `Plan ${ref} is not a payable plan.`);
    }
    amount = plan.price;
    currency = plan.currency;
  }

  const { upiId } = getPaymentConfig();
  try {
    const [row] = await sql`
      INSERT INTO payments (id, user_id, purpose, reference_id, amount, currency, status, upi_id, created_at, updated_at)
      VALUES (${crypto.randomUUID()}, ${userId}, ${purpose}, ${ref}, ${amount}, ${currency}, 'PENDING', ${upiId}, NOW(), NOW())
      RETURNING *
    `;
    const created = shape(row);
    await audit({ targetUserId: userId, paymentId: created.id, action: "PAYMENT_CREATED", newState: "PENDING" });
    log("PAYMENT_CREATED", { userId, paymentId: created.id, purpose, amount });
    return created;
  } catch (err) {
    if (err?.code === "23503" || /foreign key/i.test(err?.message || "")) {
      throw new PaymentError("PAYMENT_CONFIRMATION_FAILED", "User does not exist.");
    }
    if (err instanceof PaymentError) throw err;
    console.error("createPayment failed:", err.message);
    throw new PaymentError("PAYMENT_CONFIRMATION_FAILED", "Could not create the payment.");
  }
};

/**
 * User submits their UPI transaction reference (spec §15-17). Moves PENDING → ADMIN_REVIEW.
 * A valid-looking UTR is still only a *claim* until an admin verifies it (spec §16).
 */
export const submitPayment = async (userId, paymentId, { utr, userNote = null } = {}) => {
  const payment = await getPayment(userId, paymentId); // ownership-checked
  if (payment.status === "CONFIRMED") throw new PaymentError("PAYMENT_ALREADY_CONFIRMED", "This payment is already confirmed.");
  if (payment.status === "REJECTED") throw new PaymentError("PAYMENT_ALREADY_REJECTED", "This payment was rejected.");
  if (payment.status !== "PENDING" && payment.status !== "ADMIN_REVIEW") {
    throw new PaymentError("PAYMENT_ALREADY_SUBMITTED", "This payment can no longer be submitted.");
  }
  if (!isValidUtr(utr)) throw new PaymentError("INVALID_UTR", "Enter a valid UPI/UTR reference (8-30 letters or digits).");

  try {
    const [row] = await sql`
      UPDATE payments
      SET utr = ${utr.trim()}, user_note = ${userNote}, status = 'ADMIN_REVIEW', submitted_at = NOW(), updated_at = NOW()
      WHERE id = ${paymentId} AND status IN ('PENDING','ADMIN_REVIEW')
      RETURNING *
    `;
    if (!row) throw new PaymentError("PAYMENT_ALREADY_SUBMITTED", "This payment can no longer be submitted.");
    log("PAYMENT_SUBMITTED", { userId, paymentId });
    return shape(row);
  } catch (err) {
    if (isPgDuplicate(err)) {
      throw new PaymentError("DUPLICATE_UTR", "This UPI reference has already been used; it needs admin review.");
    }
    if (err instanceof PaymentError) throw err;
    console.error("submitPayment failed:", err.message);
    throw new PaymentError("PAYMENT_CONFIRMATION_FAILED", "Could not submit the payment.");
  }
};

/**
 * Admin confirms a payment (spec §18, §20): the guarded status flip is the exactly-once gate —
 * only the winner proceeds to the business op, so the (non-idempotent) subscription activation
 * runs once; the credit grant is additionally idempotent via its PURCHASE:{id} ledger reference
 * (spec §21-22). Neon HTTP has no interactive transaction, so we flip first then run the op; a
 * crash in between leaves a CONFIRMED payment an admin re-drives via the Phase 5/6 admin op.
 */
export const confirmPayment = async (paymentId, { adminUserId = null, reason = null } = {}) => {
  const payment = await getRow(paymentId);
  if (!payment) throw new PaymentError("PAYMENT_NOT_FOUND", "Payment not found.");
  if (payment.status === "CONFIRMED") throw new PaymentError("PAYMENT_ALREADY_CONFIRMED", "This payment is already confirmed.");
  if (payment.status === "REJECTED") throw new PaymentError("PAYMENT_ALREADY_REJECTED", "This payment was rejected.");
  if (payment.status === "REFUNDED") throw new PaymentError("PAYMENT_ALREADY_CONFIRMED", "This payment was refunded.");

  // Guarded flip — the exactly-once gate.
  const [row] = await sql`
    UPDATE payments
    SET status = 'CONFIRMED', verified_at = NOW(), verified_by = ${adminUserId}, admin_note = ${reason}, updated_at = NOW()
    WHERE id = ${paymentId} AND status IN ('PENDING','ADMIN_REVIEW')
    RETURNING *
  `;
  if (!row) throw new PaymentError("PAYMENT_ALREADY_CONFIRMED", "This payment was already handled.");

  // Run the business op for the confirmed payment.
  try {
    if (payment.purpose === PAYMENT_PURPOSES.CREDIT_TOPUP) {
      await confirmPurchase(payment.referenceId, { adminUserId, reason: reason ?? "UPI payment confirmed" });
    } else {
      await activateSubscription(payment.userId, payment.referenceId, { adminUserId, reason: reason ?? "UPI payment confirmed" });
    }
  } catch (err) {
    console.error("confirmPayment business op failed:", err.message);
    throw new PaymentError("PAYMENT_CONFIRMATION_FAILED", "Payment was marked confirmed but the benefit could not be applied; please retry from the related record.");
  }

  await audit({ adminUserId, targetUserId: payment.userId, paymentId, action: "PAYMENT_CONFIRMED", oldState: payment.status, newState: "CONFIRMED", reason });
  log("PAYMENT_CONFIRMED", { paymentId, purpose: payment.purpose, userId: payment.userId });
  return shape(row);
};

/** Admin rejects a payment submission (spec §19). The reason is shown to the user. */
export const rejectPayment = async (paymentId, { adminUserId = null, reason = null } = {}) => {
  const payment = await getRow(paymentId);
  if (!payment) throw new PaymentError("PAYMENT_NOT_FOUND", "Payment not found.");
  if (payment.status === "CONFIRMED") throw new PaymentError("PAYMENT_ALREADY_CONFIRMED", "A confirmed payment cannot be rejected.");
  if (payment.status === "REJECTED") throw new PaymentError("PAYMENT_ALREADY_REJECTED", "This payment is already rejected.");

  const [row] = await sql`
    UPDATE payments
    SET status = 'REJECTED', rejected_at = NOW(), rejected_by = ${adminUserId}, admin_note = ${reason}, updated_at = NOW()
    WHERE id = ${paymentId} AND status IN ('PENDING','ADMIN_REVIEW')
    RETURNING *
  `;
  if (!row) throw new PaymentError("PAYMENT_REJECTION_FAILED", "This payment can no longer be rejected.");
  await audit({ adminUserId, targetUserId: payment.userId, paymentId, action: "PAYMENT_REJECTED", oldState: payment.status, newState: "REJECTED", reason });
  log("PAYMENT_REJECTED", { paymentId });
  return shape(row);
};

/**
 * Admin marks a confirmed payment refunded (spec §30). Phase 7 records the state only — it does
 * NOT auto-reverse money or credits. Any credit reversal is a separate REFUND ledger entry
 * (Phase 7+). Original payment/ledger history is never mutated or deleted.
 */
export const refundPayment = async (paymentId, { adminUserId = null, reason = null } = {}) => {
  const payment = await getRow(paymentId);
  if (!payment) throw new PaymentError("PAYMENT_NOT_FOUND", "Payment not found.");
  if (payment.status !== "CONFIRMED") throw new PaymentError("PAYMENT_REJECTION_FAILED", "Only a confirmed payment can be refunded.");

  const [row] = await sql`
    UPDATE payments SET status = 'REFUNDED', admin_note = ${reason}, updated_at = NOW()
    WHERE id = ${paymentId} AND status = 'CONFIRMED'
    RETURNING *
  `;
  if (!row) throw new PaymentError("PAYMENT_REJECTION_FAILED", "This payment can no longer be refunded.");
  await audit({ adminUserId, targetUserId: payment.userId, paymentId, action: "PAYMENT_REFUNDED", oldState: "CONFIRMED", newState: "REFUNDED", reason });
  log("PAYMENT_REFUNDED", { paymentId });
  return shape(row);
};
