// Integration tests for the credit service (spec §28). Runs against the dev Neon
// DB using synthetic throwaway users (real FK rows in `users`), cleaned up after.
// Run with: npm test
import "dotenv/config";
import test, { after } from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import sql from "../config/Neon.js";
import {
  getBalance,
  ensureWallet,
  grantCredits,
  consumeCredits,
  refundCredits,
  listTransactions,
} from "../services/creditService.js";
import { INITIAL_CREDIT_GRANT, TRANSACTION_TYPES } from "../config/credits.js";
import { CreditError } from "../lib/creditError.js";

const createdUserIds = [];

// Create a real users row (credit tables FK to users.id) and track it for cleanup.
const makeUser = async () => {
  const id = `user_test_${crypto.randomUUID()}`;
  await sql`
    INSERT INTO users (id, clerk_user_id, email, created_at, updated_at)
    VALUES (${id}, ${id}, ${id + "@test.local"}, NOW(), NOW())
  `;
  createdUserIds.push(id);
  return id;
};

after(async () => {
  if (createdUserIds.length === 0) return;
  await sql`DELETE FROM credit_transactions WHERE user_id = ANY(${createdUserIds})`;
  await sql`DELETE FROM credit_wallets      WHERE user_id = ANY(${createdUserIds})`;
  await sql`DELETE FROM users               WHERE id      = ANY(${createdUserIds})`;
});

test("wallet creation grants the configurable initial credits exactly once", async () => {
  const u = await makeUser();
  await ensureWallet(u);
  assert.equal(await getBalance(u), INITIAL_CREDIT_GRANT);

  // Duplicate creation is a no-op: balance unchanged, single INITIAL_GRANT row.
  await ensureWallet(u);
  assert.equal(await getBalance(u), INITIAL_CREDIT_GRANT);

  const [{ count }] = await sql`
    SELECT count(*)::int AS count FROM credit_transactions
    WHERE user_id = ${u} AND type = ${TRANSACTION_TYPES.INITIAL_GRANT}
  `;
  assert.equal(count, INITIAL_CREDIT_GRANT > 0 ? 1 : 0);

  const [{ wcount }] = await sql`
    SELECT count(*)::int AS wcount FROM credit_wallets WHERE user_id = ${u}
  `;
  assert.equal(wcount, 1);
});

test("grant increases the balance", async () => {
  const u = await makeUser();
  await grantCredits(u, 10, TRANSACTION_TYPES.BONUS);
  assert.equal(await getBalance(u), 10);
});

test("consume decreases the balance", async () => {
  const u = await makeUser();
  await grantCredits(u, 10, TRANSACTION_TYPES.BONUS);
  const tx = await consumeCredits(u, 4);
  assert.equal(tx.amount, -4);
  assert.equal(tx.balanceAfter, 6);
  assert.equal(await getBalance(u), 6);
});

test("insufficient credits: consume fails, balance unchanged, no ledger row", async () => {
  const u = await makeUser();
  await grantCredits(u, 3, TRANSACTION_TYPES.BONUS);

  await assert.rejects(
    () => consumeCredits(u, 5),
    (err) => err instanceof CreditError && err.code === "INSUFFICIENT_CREDITS"
  );
  assert.equal(await getBalance(u), 3);

  const [{ count }] = await sql`
    SELECT count(*)::int AS count FROM credit_transactions
    WHERE user_id = ${u} AND type = ${TRANSACTION_TYPES.AI_USAGE}
  `;
  assert.equal(count, 0);
});

test("refund returns credits", async () => {
  const u = await makeUser();
  await grantCredits(u, 5, TRANSACTION_TYPES.BONUS);
  await refundCredits(u, 5);
  assert.equal(await getBalance(u), 10);
});

test("invalid amounts are rejected", async () => {
  const u = await makeUser();
  for (const bad of [0, -5, 1.5]) {
    await assert.rejects(
      () => grantCredits(u, bad, TRANSACTION_TYPES.BONUS),
      (err) => err instanceof CreditError && err.code === "INVALID_CREDIT_AMOUNT"
    );
  }
  assert.equal(await getBalance(u), 0);
});

test("idempotency: same reference is applied once", async () => {
  const u = await makeUser();
  const ref = `purchase_${crypto.randomUUID()}`;

  const first = await grantCredits(u, 10, TRANSACTION_TYPES.PURCHASE, ref);
  const second = await grantCredits(u, 10, TRANSACTION_TYPES.PURCHASE, ref);

  assert.equal(await getBalance(u), 10); // not 20
  assert.equal(first.id, second.id); // second returned the existing transaction

  const [{ count }] = await sql`
    SELECT count(*)::int AS count FROM credit_transactions
    WHERE user_id = ${u} AND type = ${TRANSACTION_TYPES.PURCHASE} AND reference_id = ${ref}
  `;
  assert.equal(count, 1);
});

test("concurrent consumption cannot double-spend", async () => {
  const u = await makeUser();
  await grantCredits(u, 5, TRANSACTION_TYPES.BONUS);

  const results = await Promise.allSettled([consumeCredits(u, 5), consumeCredits(u, 5)]);
  const ok = results.filter((r) => r.status === "fulfilled");
  const failed = results.filter((r) => r.status === "rejected");

  assert.equal(ok.length, 1, "exactly one consume should succeed");
  assert.equal(failed.length, 1, "the other should fail");
  assert.ok(failed[0].reason instanceof CreditError && failed[0].reason.code === "INSUFFICIENT_CREDITS");

  const balance = await getBalance(u);
  assert.equal(balance, 0);
  assert.ok(balance >= 0, "balance must never be negative");
});

test("user isolation: balances and transactions are per-user", async () => {
  const a = await makeUser();
  const b = await makeUser();
  await grantCredits(a, 7, TRANSACTION_TYPES.BONUS);
  await grantCredits(b, 3, TRANSACTION_TYPES.BONUS);

  assert.equal(await getBalance(a), 7);
  assert.equal(await getBalance(b), 3);

  const { transactions, total } = await listTransactions(a, { page: 1, limit: 20 });
  assert.equal(total, 1);
  assert.equal(transactions.length, 1);
  assert.equal(transactions[0].balanceAfter, 7);
});
