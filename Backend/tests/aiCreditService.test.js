// Integration tests for Phase 3 AI credit consumption (spec §46–47). Drives
// executeWithCredits with injected fake execute() callbacks (no real Gemini) and
// synthetic users against the dev Neon DB; cleaned up after. Run: npm test
import "dotenv/config";
import test, { after } from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import sql from "../config/Neon.js";
import {
  ensureWallet,
  getBalance,
  grantCredits,
  consumeCredits,
  listTransactions,
} from "../services/creditService.js";
import { executeWithCredits, getServiceCost } from "../services/aiCreditService.js";
import { SERVICES } from "../config/aiServices.js";
import { TRANSACTION_TYPES } from "../config/credits.js";
import { CreditError } from "../lib/creditError.js";
import { AiError } from "../lib/aiError.js";

const SERVICE = SERVICES.MATCH_ANALYSIS;
const COST = getServiceCost(SERVICE); // from config (default 2)

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

// Bring a user's balance to exactly `target`. ensureWallet first so the one-time
// initial grant is already applied and won't interfere later.
const setBalance = async (userId, target) => {
  await ensureWallet(userId);
  const current = await getBalance(userId);
  if (target > current) await grantCredits(userId, target - current, TRANSACTION_TYPES.BONUS);
  else if (target < current) await consumeCredits(userId, current - target);
  return getBalance(userId);
};

after(async () => {
  if (createdUserIds.length === 0) return;
  await sql`DELETE FROM credit_transactions WHERE user_id = ANY(${createdUserIds})`;
  await sql`DELETE FROM credit_wallets      WHERE user_id = ANY(${createdUserIds})`;
  await sql`DELETE FROM ai_requests         WHERE user_id = ANY(${createdUserIds})`;
  await sql`DELETE FROM users               WHERE id      = ANY(${createdUserIds})`;
});

test("success: credits are deducted and kept", async () => {
  const u = await makeUser();
  await setBalance(u, 5);
  let called = 0;
  const { result, cost } = await executeWithCredits({
    userId: u,
    service: SERVICE,
    execute: async () => (called++, { ok: true }),
  });
  assert.equal(called, 1);
  assert.equal(cost, COST);
  assert.deepEqual(result, { ok: true });
  assert.equal(await getBalance(u), 5 - COST);
});

test("insufficient: AI is never called and balance is unchanged", async () => {
  const u = await makeUser();
  await setBalance(u, COST - 1);
  let called = 0;
  await assert.rejects(
    () =>
      executeWithCredits({
        userId: u,
        service: SERVICE,
        execute: async () => (called++, { ok: true }),
      }),
    (err) => err instanceof CreditError && err.code === "INSUFFICIENT_CREDITS" && err.required === COST
  );
  assert.equal(called, 0, "AI must not be called");
  assert.equal(await getBalance(u), COST - 1);
});

test("provider failure: credits are refunded", async () => {
  const u = await makeUser();
  await setBalance(u, 5);
  await assert.rejects(
    () =>
      executeWithCredits({
        userId: u,
        service: SERVICE,
        execute: async () => {
          throw new Error("gemini exploded");
        },
      }),
    (err) => err instanceof AiError && err.code === "AI_PROVIDER_ERROR"
  );
  assert.equal(await getBalance(u), 5, "balance restored after refund");
  const { transactions } = await listTransactions(u, { page: 1, limit: 20 });
  const usage = transactions.find((t) => t.type === TRANSACTION_TYPES.AI_USAGE);
  const refund = transactions.find((t) => t.type === TRANSACTION_TYPES.REFUND);
  assert.ok(usage && refund && usage.referenceId === refund.referenceId, "usage+refund share reference");
});

test("invalid response: credits are refunded", async () => {
  const u = await makeUser();
  await setBalance(u, 5);
  await assert.rejects(
    () =>
      executeWithCredits({
        userId: u,
        service: SERVICE,
        validate: () => false,
        execute: async () => ({ garbage: true }),
      }),
    (err) => err instanceof AiError && err.code === "AI_RESPONSE_INVALID"
  );
  assert.equal(await getBalance(u), 5);
});

test("timeout: credits are refunded", async () => {
  const u = await makeUser();
  await setBalance(u, 5);
  await assert.rejects(
    () =>
      executeWithCredits({
        userId: u,
        service: SERVICE,
        timeoutMs: 100,
        execute: () => new Promise((r) => setTimeout(() => r({ ok: true }), 1000)),
      }),
    (err) => err instanceof AiError && err.code === "AI_TIMEOUT"
  );
  assert.equal(await getBalance(u), 5);
});

test("idempotency key: only one charge, AI runs once", async () => {
  const u = await makeUser();
  await setBalance(u, 10);
  const key = `idem_${crypto.randomUUID()}`;
  let called = 0;
  const run = () =>
    executeWithCredits({
      userId: u,
      service: SERVICE,
      idempotencyKey: key,
      execute: async () => (called++, { ok: true }),
    });

  const first = await run();
  const second = await run();
  assert.equal(first.replayed, false);
  assert.equal(second.replayed, true);
  assert.equal(called, 1, "AI runs only once");
  assert.equal(await getBalance(u), 10 - COST);
});

test("concurrent: only one of two competing ops succeeds", async () => {
  const u = await makeUser();
  await setBalance(u, COST); // enough for exactly one
  let called = 0;
  const run = () =>
    executeWithCredits({
      userId: u,
      service: SERVICE,
      execute: async () => (called++, { ok: true }),
    });

  const results = await Promise.allSettled([run(), run()]);
  const ok = results.filter((r) => r.status === "fulfilled");
  const failed = results.filter((r) => r.status === "rejected");
  assert.equal(ok.length, 1);
  assert.equal(failed.length, 1);
  assert.ok(failed[0].reason instanceof CreditError && failed[0].reason.code === "INSUFFICIENT_CREDITS");
  assert.equal(called, 1, "only the winning op calls AI");
  const balance = await getBalance(u);
  assert.equal(balance, 0);
  assert.ok(balance >= 0);
});

test("user isolation: one user's AI op does not touch another's wallet", async () => {
  const a = await makeUser();
  const b = await makeUser();
  await setBalance(a, 5);
  await setBalance(b, 5);
  await executeWithCredits({ userId: a, service: SERVICE, execute: async () => ({ ok: true }) });
  assert.equal(await getBalance(a), 5 - COST);
  assert.equal(await getBalance(b), 5, "other user untouched");
  const { transactions } = await listTransactions(b, { page: 1, limit: 20 });
  assert.ok(transactions.every((t) => t.type !== TRANSACTION_TYPES.AI_USAGE), "no AI usage on B");
});
