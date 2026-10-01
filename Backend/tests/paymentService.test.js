// Integration tests for the Phase 7 manual-UPI payment domain (spec §35). Runs against the
// dev Neon DB with synthetic throwaway users; assumes `npm run seed:plans` + `npm run seed:packs`
// populated the catalog. Cleans up after. Run: npm test
import "dotenv/config";
import test, { after } from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import sql from "../config/Neon.js";
import {
  createPayment,
  submitPayment,
  confirmPayment,
  rejectPayment,
  getPayment,
  getPaymentHistory,
} from "../services/paymentService.js";
import { createPurchase } from "../services/creditPurchaseService.js";
import { getBalance } from "../services/creditService.js";
import { getCurrentSubscription } from "../services/subscriptionService.js";
import { TRANSACTION_TYPES } from "../config/credits.js";
import { PaymentError } from "../lib/paymentError.js";

const createdUserIds = [];

const makeUser = async () => {
  const id = `user_test_${crypto.randomUUID()}`;
  await sql`
    INSERT INTO users (id, clerk_user_id, email, created_at, updated_at)
    VALUES (${id}, ${id}, ${id + "@test.local"}, NOW(), NOW())
  `;
  createdUserIds.push(id);
  return id;
};

// Unique, valid-looking UTRs so the UNIQUE(utr) index never collides across tests.
const utr = () => crypto.randomUUID().replace(/-/g, "").slice(0, 16);

after(async () => {
  if (!createdUserIds.length) return;
  await sql`DELETE FROM payment_audit          WHERE target_user_id = ANY(${createdUserIds})`;
  await sql`DELETE FROM payments               WHERE user_id = ANY(${createdUserIds})`;
  await sql`DELETE FROM subscription_audit     WHERE target_user_id = ANY(${createdUserIds})`;
  await sql`DELETE FROM subscriptions          WHERE user_id = ANY(${createdUserIds})`;
  await sql`DELETE FROM credit_purchase_audit  WHERE target_user_id = ANY(${createdUserIds})`;
  await sql`DELETE FROM credit_purchases       WHERE user_id = ANY(${createdUserIds})`;
  await sql`DELETE FROM credit_transactions    WHERE user_id = ANY(${createdUserIds})`;
  await sql`DELETE FROM credit_wallets         WHERE user_id = ANY(${createdUserIds})`;
  await sql`DELETE FROM users                  WHERE id = ANY(${createdUserIds})`;
});

// ---- creation -----------------------------------------------------------

test("credit-topup payment snapshots the amount from the purchase and starts PENDING", async () => {
  const u = await makeUser();
  const purchase = await createPurchase(u, "LARGE"); // 30 cr / ₹199
  const p = await createPayment(u, "CREDIT_TOPUP", purchase.id);
  assert.equal(p.status, "PENDING");
  assert.equal(p.purpose, "CREDIT_TOPUP");
  assert.equal(p.amount, 199);
  assert.equal(p.referenceId, purchase.id);
});

test("subscription payment snapshots the amount from the plan", async () => {
  const u = await makeUser();
  const p = await createPayment(u, "SUBSCRIPTION", "PRO"); // ₹249
  assert.equal(p.amount, 249);
  assert.equal(p.referenceId, "PRO");
});

test("unknown purpose and unknown reference are rejected", async () => {
  const u = await makeUser();
  await assert.rejects(
    () => createPayment(u, "DONATION", "x"),
    (e) => e instanceof PaymentError && e.code === "INVALID_PAYMENT_PURPOSE"
  );
  await assert.rejects(
    () => createPayment(u, "SUBSCRIPTION", "NOPLAN"),
    (e) => e instanceof PaymentError && e.code === "INVALID_PAYMENT_REFERENCE"
  );
});

// ---- submission ---------------------------------------------------------

test("submitting a valid UTR moves the payment to ADMIN_REVIEW", async () => {
  const u = await makeUser();
  const p = await createPayment(u, "SUBSCRIPTION", "STARTER");
  const submitted = await submitPayment(u, p.id, { utr: utr(), userNote: "Paid via PhonePe" });
  assert.equal(submitted.status, "ADMIN_REVIEW");
  assert.ok(submitted.submittedAt);
});

test("an invalid UTR is rejected", async () => {
  const u = await makeUser();
  const p = await createPayment(u, "SUBSCRIPTION", "STARTER");
  await assert.rejects(
    () => submitPayment(u, p.id, { utr: "bad!" }),
    (e) => e instanceof PaymentError && e.code === "INVALID_UTR"
  );
});

test("a reused UTR is blocked for admin review", async () => {
  const u = await makeUser();
  const shared = utr();
  const p1 = await createPayment(u, "SUBSCRIPTION", "STARTER");
  await submitPayment(u, p1.id, { utr: shared });
  const p2 = await createPayment(u, "SUBSCRIPTION", "PRO");
  await assert.rejects(
    () => submitPayment(u, p2.id, { utr: shared }),
    (e) => e instanceof PaymentError && e.code === "DUPLICATE_UTR"
  );
});

// ---- confirmation: credit top-up ---------------------------------------

test("confirming a credit-topup payment confirms the purchase and grants credits once", async () => {
  const u = await makeUser();
  const purchase = await createPurchase(u, "MEDIUM"); // 12 cr
  const p = await createPayment(u, "CREDIT_TOPUP", purchase.id);
  await submitPayment(u, p.id, { utr: utr() });

  const confirmed = await confirmPayment(p.id, { adminUserId: "admin_test", reason: "verified" });
  assert.equal(confirmed.status, "CONFIRMED");
  assert.equal(await getBalance(u), 12);

  const [{ count }] = await sql`
    SELECT count(*)::int AS count FROM credit_transactions
    WHERE user_id = ${u} AND type = ${TRANSACTION_TYPES.PURCHASE}
  `;
  assert.equal(count, 1);

  // Re-confirming the same payment is rejected and grants nothing more.
  await assert.rejects(
    () => confirmPayment(p.id, { adminUserId: "admin_test", reason: "again" }),
    (e) => e instanceof PaymentError && e.code === "PAYMENT_ALREADY_CONFIRMED"
  );
  assert.equal(await getBalance(u), 12);
});

// ---- confirmation: subscription ----------------------------------------

test("confirming a subscription payment activates the plan and grants monthly credits", async () => {
  const u = await makeUser();
  const p = await createPayment(u, "SUBSCRIPTION", "PRO");
  await submitPayment(u, p.id, { utr: utr() });
  await confirmPayment(p.id, { adminUserId: "admin_test", reason: "verified" });

  const sub = await getCurrentSubscription(u);
  assert.equal(sub.plan.key, "PRO");
  assert.equal(await getBalance(u), 60); // PRO monthly credits
});

test("concurrent confirmation of a subscription payment activates exactly once", async () => {
  const u = await makeUser();
  const p = await createPayment(u, "SUBSCRIPTION", "STARTER");
  await submitPayment(u, p.id, { utr: utr() });

  const results = await Promise.allSettled([
    confirmPayment(p.id, { adminUserId: "admin_test", reason: "verified" }),
    confirmPayment(p.id, { adminUserId: "admin_test", reason: "verified" }),
  ]);
  const ok = results.filter((r) => r.status === "fulfilled").length;
  assert.equal(ok, 1); // exactly one winner

  const [{ count }] = await sql`
    SELECT count(*)::int AS count FROM subscriptions WHERE user_id = ${u} AND status = 'ACTIVE'
  `;
  assert.equal(count, 1);
  assert.equal(await getBalance(u), 20); // granted once
});

// ---- rejection ----------------------------------------------------------

test("rejecting a payment stores the reason and grants nothing", async () => {
  const u = await makeUser();
  const purchase = await createPurchase(u, "SMALL");
  const p = await createPayment(u, "CREDIT_TOPUP", purchase.id);
  await submitPayment(u, p.id, { utr: utr() });

  const rejected = await rejectPayment(p.id, { adminUserId: "admin_test", reason: "Amount did not match." });
  assert.equal(rejected.status, "REJECTED");
  assert.equal(rejected.adminNote, "Amount did not match.");
  assert.equal(await getBalance(u), 0);

  // A rejected payment cannot then be confirmed.
  await assert.rejects(
    () => confirmPayment(p.id, { adminUserId: "admin_test", reason: "oops" }),
    (e) => e instanceof PaymentError && e.code === "PAYMENT_ALREADY_REJECTED"
  );
});

// ---- security / ownership ----------------------------------------------

test("a user cannot read another user's payment", async () => {
  const owner = await makeUser();
  const other = await makeUser();
  const p = await createPayment(owner, "SUBSCRIPTION", "STARTER");
  await assert.rejects(
    () => getPayment(other, p.id),
    (e) => e instanceof PaymentError && e.code === "PAYMENT_ACCESS_DENIED"
  );
  assert.equal((await getPayment(owner, p.id)).id, p.id);
  assert.equal((await getPayment(null, p.id, { asAdmin: true })).id, p.id);
});

test("payment history is user-scoped and newest-first", async () => {
  const u = await makeUser();
  await createPayment(u, "SUBSCRIPTION", "STARTER");
  await createPayment(u, "SUBSCRIPTION", "PRO");
  const history = await getPaymentHistory(u);
  assert.equal(history.length, 2);
  assert.ok(new Date(history[0].createdAt) >= new Date(history[1].createdAt));
});

test("wallet balance equals the ledger sum after a confirmed payment", async () => {
  const u = await makeUser();
  const purchase = await createPurchase(u, "LARGE");
  const p = await createPayment(u, "CREDIT_TOPUP", purchase.id);
  await submitPayment(u, p.id, { utr: utr() });
  await confirmPayment(p.id, { adminUserId: "admin_test", reason: "verified" });
  const [{ sum }] = await sql`
    SELECT coalesce(sum(amount), 0)::int AS sum FROM credit_transactions WHERE user_id = ${u}
  `;
  assert.equal(await getBalance(u), sum);
});
