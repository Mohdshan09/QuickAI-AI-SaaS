// creditPackService — read + admin-mutation access to the credit-pack catalog (spec §24).
// The frontend consumes pack info (price, credits) from the API through this, never
// hardcoding it (spec §6, §37). Packs are seeded from config by scripts/seedCreditPacks.js;
// admins may create/edit/disable them at runtime. Mirrors planService.
import crypto from "crypto";
import sql from "../config/Neon.js";
import { PurchaseError } from "../lib/purchaseError.js";

const shapePack = (row) =>
  row && {
    id: row.id,
    key: row.key,
    name: row.name,
    description: row.description ?? null,
    credits: row.credits,
    price: row.price,
    currency: row.currency,
    isActive: row.is_active,
  };

/** Active, public packs ordered by price (spec §25). */
export const getActivePacks = async () => {
  const rows = await sql`
    SELECT id, key, name, description, credits, price, currency, is_active
    FROM credit_packs
    WHERE is_active = true
    ORDER BY price ASC
  `;
  return rows.map(shapePack);
};

/** One pack by key (includes inactive); null if unknown. */
export const getPack = async (packKey) => {
  const [row] = await sql`
    SELECT id, key, name, description, credits, price, currency, is_active
    FROM credit_packs WHERE key = ${packKey}
  `;
  return shapePack(row);
};

/** One pack by id; null if unknown. */
export const getPackById = async (id) => {
  const [row] = await sql`
    SELECT id, key, name, description, credits, price, currency, is_active
    FROM credit_packs WHERE id = ${id}
  `;
  return shapePack(row);
};

// ---- admin mutations (authorization enforced in the route) --------------

/** Create a credit pack (spec §34). Rejects a duplicate key. */
export const createPack = async ({ key, name, description = null, credits, price, currency = "INR", isActive = true }) => {
  if (!key || !name || !Number.isInteger(credits) || credits <= 0 || !Number.isInteger(price) || price < 0) {
    throw new PurchaseError("PURCHASE_OPERATION_FAILED", "A valid key, name, positive credits and non-negative price are required.");
  }
  try {
    const [row] = await sql`
      INSERT INTO credit_packs (id, key, name, description, credits, price, currency, is_active, created_at, updated_at)
      VALUES (${crypto.randomUUID()}, ${key}, ${name}, ${description}, ${credits}, ${price}, ${currency}, ${isActive}, NOW(), NOW())
      RETURNING id, key, name, description, credits, price, currency, is_active
    `;
    return shapePack(row);
  } catch (err) {
    if (err?.code === "23505" || /duplicate key|unique/i.test(err?.message || "")) {
      throw new PurchaseError("PURCHASE_OPERATION_FAILED", `A pack with key ${key} already exists.`);
    }
    console.error("createPack failed:", err.message);
    throw new PurchaseError("PURCHASE_OPERATION_FAILED", "Could not create the credit pack.");
  }
};

/** Edit an existing pack's fields (spec §34). Only provided fields change. */
export const updatePack = async (packKey, patch = {}) => {
  const existing = await getPack(packKey);
  if (!existing) throw new PurchaseError("PACK_NOT_FOUND", `Pack ${packKey} does not exist.`);

  const next = {
    name: patch.name ?? existing.name,
    description: patch.description ?? existing.description,
    credits: patch.credits ?? existing.credits,
    price: patch.price ?? existing.price,
    currency: patch.currency ?? existing.currency,
    isActive: patch.isActive ?? existing.isActive,
  };
  if (!Number.isInteger(next.credits) || next.credits <= 0 || !Number.isInteger(next.price) || next.price < 0) {
    throw new PurchaseError("PURCHASE_OPERATION_FAILED", "Credits must be positive and price non-negative.");
  }

  const [row] = await sql`
    UPDATE credit_packs SET
      name = ${next.name}, description = ${next.description}, credits = ${next.credits},
      price = ${next.price}, currency = ${next.currency}, is_active = ${next.isActive}, updated_at = NOW()
    WHERE key = ${packKey}
    RETURNING id, key, name, description, credits, price, currency, is_active
  `;
  return shapePack(row);
};

/** Disable a pack so it can no longer be purchased (spec §34). History is untouched. */
export const disablePack = async (packKey) => {
  const [row] = await sql`
    UPDATE credit_packs SET is_active = false, updated_at = NOW()
    WHERE key = ${packKey}
    RETURNING id, key, name, description, credits, price, currency, is_active
  `;
  if (!row) throw new PurchaseError("PACK_NOT_FOUND", `Pack ${packKey} does not exist.`);
  return shapePack(row);
};
