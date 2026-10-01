// Integration tests for the credit top-up / purchase domain (spec §48). Runs against the
// dev Neon DB with synthetic throwaway users; assumes `npm run seed:packs` populated
// SMALL/MEDIUM/LARGE. Cleans up after. Run: npm test
import "dotenv/config";
import test, { after } from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import sql from "../config/Neon.js";
import {
  createPurchase,
  confirmPurchase,
  cancelPurchase,
  getPurchase,
  getPurchaseHistory,
} from "../services/creditPurchaseService.js";
import { createPack, disablePack, updatePack } from "../services/creditPackService.js";
import { getWallet, getBalance, grantCredits } from "../services/creditService.js";
import { TRANSACTION_TYPES } from "../config/credits.js";
import { PurchaseError } from "../lib/purchaseError.js";

const createdUserIds = [];
const tmpPackKeys = [];

const makeUser = async () => {
  const id = `user_test_${crypto.randomUUID()}`;
  await sql`
    INSERT INTO users (id, clerk_user_id, email, created_at, updated_at)
    VALUES (${id}, ${id}, ${id + "@test.local"}, NOW(), NOW())
  `;
  createdUserIds.push(id);
  return id;
};

const tmpPack = async (def) => {
  const key = `TEST_${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  tmpPackKeys.push(key);
  return createPack({ key, name: def.name ?? key, credits: def.credits, price: def.price });
};

after(async () => {
  if (createdUserIds.length) {
    await sql`DELETE FROM credit_purchase_audit WHERE target_user_id = ANY(${createdUserIds})`;
    await sql`DELETE FROM credit_purchases      WHERE user_id = ANY(${createdUserIds})`;
    await sql`DELETE FROM credit_transactions   WHERE user_id = ANY(${createdUserIds})`;
    await sql`DELETE FROM credit_wallets        WHERE user_id = ANY(${createdUserIds})`;
    await sql`DELETE FROM users                 WHERE id = ANY(${createdUserIds})`;
  }
  if (tmpPackKeys.length) await sql`DELETE FROM credit_packs WHERE key = ANY(${tmpPackKeys})`;
});

// ---- creation -----------------------------------------------------------

test("createPurchase snapshots pack credits/amount and starts PENDING", async () => {
  const u = await makeUser();
  const p = await createPurchase(u, "LARGE");
  assert.equal(p.status, "PENDING");
  assert.equal(p.credits, 30);
  assert.equal(p.amount, 199);
  assert.equal(p.currency, "INR");
  assert.equal(p.userId, u);
  // No credits granted merely by creating (spec §11).
  assert.equal(await getBalance(u), 0);
});

test("an unknown pack is rejected", async () => {
  const u = await makeUser();
  await assert.rejects(
    () => createPurchase(u, "NOPE"),
    (e) => e instanceof PurchaseError && e.code === "PACK_NOT_FOUND"
  );
});

test("a disabled pack cannot be purchased", async () => {
  const u = await makeUser();
  const pack = await tmpPack({ credits: 7, price: 70 });
  await disablePack(pack.key);
  await assert.rejects(
    () => createPurchase(u, pack.key),
    (e) => e instanceof PurchaseError && e.code === "PACK_INACTIVE"
  );
});

test("the purchase snapshot survives a later pack price/credit change (spec §9)", async () => {
  const u = await makeUser();
  const pack = await tmpPack({ credits: 30, price: 199 });
  const p = await createPurchase(u, pack.key);
  await updatePack(pack.key, { credits: 25, price: 249 }); // future repricing
  const reloaded = await getPurchase(u, p.id);
  assert.equal(reloaded.credits, 30);
  assert.equal(reloaded.amount, 199);
});

test("idempotency key dedupes creation", async () => {
  const u = await makeUser();
  const a = await createPurchase(u, "SMALL", { idempotencyKey: "abc-123" });
  const b = await createPurchase(u, "SMALL", { idempotencyKey: "abc-123" });
  assert.equal(a.id, b.id);
  const [{ count }] = await sql`SELECT count(*)::int AS count FROM credit_purchases WHERE user_id = ${u}`;
  assert.equal(count, 1);
});

// ---- confirmation / grant ----------------------------------------------

test("confirmation grants credits once and writes a PURCHASE ledger row", async () => {
  const u = await makeUser();
  const p = await createPurchase(u, "LARGE");
  const confirmed = await confirmPurchase(p.id, { reason: "test" });
  assert.equal(confirmed.status, "CONFIRMED");
  assert.ok(confirmed.confirmedAt);
  assert.equal(await getBalance(u), 30);

  const [row] = await sql`
    SELECT amount, reference_id FROM credit_transactions
    WHERE user_id = ${u} AND type = ${TRANSACTION_TYPES.PURCHASE}
  `;
  assert.equal(row.amount, 30);
  assert.equal(row.reference_id, `PURCHASE:${p.id}`);
});

test("re-confirming a CONFIRMED purchase is idempotent (no double grant)", async () => {
  const u = await makeUser();
  const p = await createPurchase(u, "MEDIUM");
  await confirmPurchase(p.id, { reason: "test" });
  await confirmPurchase(p.id, { reason: "test" }); // retry
  assert.equal(await getBalance(u), 12);
  const [{ count }] = await sql`
    SELECT count(*)::int AS count FROM credit_transactions
    WHERE user_id = ${u} AND type = ${TRANSACTION_TYPES.PURCHASE}
  `;
  assert.equal(count, 1);
});

test("concurrent confirmations grant exactly once", async () => {
  const u = await makeUser();
  const p = await createPurchase(u, "LARGE");
  await Promise.all([
    confirmPurchase(p.id, { reason: "test" }),
    confirmPurchase(p.id, { reason: "test" }),
    confirmPurchase(p.id, { reason: "test" }),
  ]);
  assert.equal(await getBalance(u), 30);
  const [{ count }] = await sql`
    SELECT count(*)::int AS count FROM credit_transactions
    WHERE user_id = ${u} AND type = ${TRANSACTION_TYPES.PURCHASE}
  `;
  assert.equal(count, 1);
});

test("a cancelled purchase cannot be confirmed", async () => {
  const u = await makeUser();
  const p = await createPurchase(u, "SMALL");
  await cancelPurchase(p.id, { reason: "test" });
  await assert.rejects(
    () => confirmPurchase(p.id, { reason: "test" }),
    (e) => e instanceof PurchaseError && e.code === "INVALID_PURCHASE_STATE"
  );
  assert.equal(await getBalance(u), 0);
});

// ---- wallet accounting --------------------------------------------------

test("purchase increases lifetime_purchased, separate from subscription grants", async () => {
  const u = await makeUser();
  // A subscription-style grant increments lifetime_granted, not lifetime_purchased.
  await grantCredits(u, 60, TRANSACTION_TYPES.SUBSCRIPTION_GRANT, "SUBSCRIPTION_GRANT:test:2026-10-01");
  const p = await createPurchase(u, "LARGE");
  await confirmPurchase(p.id, { reason: "test" });

  const wallet = await getWallet(u);
  assert.equal(wallet.balance, 90);            // 60 + 30
  assert.equal(wallet.lifetimePurchased, 30);  // only the top-up
  assert.equal(wallet.lifetimeGranted, 60);    // only the subscription grant
});

test("wallet balance equals the ledger sum", async () => {
  const u = await makeUser();
  const p = await createPurchase(u, "MEDIUM");
  await confirmPurchase(p.id, { reason: "test" });
  const [{ sum }] = await sql`
    SELECT coalesce(sum(amount), 0)::int AS sum FROM credit_transactions WHERE user_id = ${u}
  `;
  assert.equal(await getBalance(u), sum);
});

// ---- security / ownership ----------------------------------------------

test("a user cannot read another user's purchase", async () => {
  const owner = await makeUser();
  const other = await makeUser();
  const p = await createPurchase(owner, "SMALL");
  await assert.rejects(
    () => getPurchase(other, p.id),
    (e) => e instanceof PurchaseError && e.code === "PURCHASE_FORBIDDEN"
  );
  // The owner (and an admin via asAdmin) can.
  assert.equal((await getPurchase(owner, p.id)).id, p.id);
  assert.equal((await getPurchase(null, p.id, { asAdmin: true })).id, p.id);
});

test("purchase history is user-scoped and newest-first", async () => {
  const u = await makeUser();
  await createPurchase(u, "SMALL");
  await createPurchase(u, "LARGE");
  const history = await getPurchaseHistory(u);
  assert.equal(history.length, 2);
  assert.ok(new Date(history[0].createdAt) >= new Date(history[1].createdAt));
});
