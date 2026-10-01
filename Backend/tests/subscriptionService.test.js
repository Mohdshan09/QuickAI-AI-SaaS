// Integration tests for the subscription domain (spec §44). Runs against the dev
// Neon DB with synthetic throwaway users; assumes `npm run seed:plans` has populated
// FREE/STARTER/PRO. Cleans up after. Run: npm test
import "dotenv/config";
import test, { after } from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import sql from "../config/Neon.js";
import {
  getCurrentSubscription,
  getCurrentPlan,
  activateSubscription,
  cancelSubscription,
  resumeSubscription,
  expireSubscription,
  renewSubscription,
  changeSubscriptionPlan,
  getSubscriptionHistory,
} from "../services/subscriptionService.js";
import { getUserPlan, getEntitlement } from "../services/entitlementService.js";
import { getBalance, grantCredits } from "../services/creditService.js";
import { TRANSACTION_TYPES } from "../config/credits.js";
import { SubscriptionError } from "../lib/subscriptionError.js";

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

const toDate = (d) => new Date(d).toISOString().slice(0, 10);

after(async () => {
  if (!createdUserIds.length) return;
  await sql`DELETE FROM subscription_audit  WHERE target_user_id = ANY(${createdUserIds})`;
  await sql`DELETE FROM subscriptions       WHERE user_id = ANY(${createdUserIds})`;
  await sql`DELETE FROM feature_usage       WHERE user_id = ANY(${createdUserIds})`;
  await sql`DELETE FROM user_plans          WHERE user_id = ANY(${createdUserIds})`;
  await sql`DELETE FROM credit_transactions WHERE user_id = ANY(${createdUserIds})`;
  await sql`DELETE FROM credit_wallets      WHERE user_id = ANY(${createdUserIds})`;
  await sql`DELETE FROM users               WHERE id = ANY(${createdUserIds})`;
});

// ---- plan resolution ----------------------------------------------------

test("free user has no subscription and resolves to FREE", async () => {
  const u = await makeUser();
  assert.equal(await getCurrentSubscription(u), null);
  assert.equal((await getCurrentPlan(u)).key, "FREE");
  assert.equal((await getUserPlan(u)).key, "FREE");
});

test("activation makes the subscription the effective plan", async () => {
  const u = await makeUser();
  await activateSubscription(u, "STARTER", { reason: "test" });
  assert.equal((await getCurrentSubscription(u)).plan.key, "STARTER");
  assert.equal((await getUserPlan(u)).key, "STARTER");
  // Effective entitlement limit comes from the subscription's plan (STARTER=50).
  assert.equal((await getEntitlement(u, "article_generation")).monthlyLimit, 50);
});

// ---- credit grants ------------------------------------------------------

test("activation grants the plan's monthly credits via the ledger, once", async () => {
  const u = await makeUser();
  const sub = await activateSubscription(u, "PRO", { reason: "test" });
  assert.equal(await getBalance(u), 60); // PRO monthly_credits

  const [row] = await sql`
    SELECT amount, reference_id FROM credit_transactions
    WHERE user_id = ${u} AND type = ${TRANSACTION_TYPES.SUBSCRIPTION_GRANT}
  `;
  assert.equal(row.amount, 60);
  assert.equal(row.reference_id, `SUBSCRIPTION_GRANT:${sub.id}:${toDate(sub.currentPeriodStart)}`);
});

test("a duplicate grant for the same period adds nothing (idempotent)", async () => {
  const u = await makeUser();
  const sub = await activateSubscription(u, "STARTER", { reason: "test" });
  assert.equal(await getBalance(u), 20);

  // Re-issue the exact grant the service used -> no-op.
  const ref = `SUBSCRIPTION_GRANT:${sub.id}:${toDate(sub.currentPeriodStart)}`;
  await grantCredits(u, 20, TRANSACTION_TYPES.SUBSCRIPTION_GRANT, ref);
  assert.equal(await getBalance(u), 20);

  const [{ count }] = await sql`
    SELECT count(*)::int AS count FROM credit_transactions
    WHERE user_id = ${u} AND type = ${TRANSACTION_TYPES.SUBSCRIPTION_GRANT}
  `;
  assert.equal(count, 1);
});

test("renewal grants the next period's credits once", async () => {
  const u = await makeUser();
  const sub = await activateSubscription(u, "STARTER", { reason: "test" });
  assert.equal(await getBalance(u), 20);
  await renewSubscription(sub.id, { reason: "test" });
  assert.equal(await getBalance(u), 40); // +20 for the new period

  const [{ count }] = await sql`
    SELECT count(*)::int AS count FROM credit_transactions
    WHERE user_id = ${u} AND type = ${TRANSACTION_TYPES.SUBSCRIPTION_GRANT}
  `;
  assert.equal(count, 2); // two distinct periods
});

test("wallet balance equals the ledger sum", async () => {
  const u = await makeUser();
  const sub = await activateSubscription(u, "PRO", { reason: "test" });
  await renewSubscription(sub.id, { reason: "test" });
  const [{ sum }] = await sql`
    SELECT coalesce(sum(amount), 0)::int AS sum FROM credit_transactions WHERE user_id = ${u}
  `;
  assert.equal(await getBalance(u), sum);
});

// ---- lifecycle ----------------------------------------------------------

test("cancellation keeps access until period end", async () => {
  const u = await makeUser();
  const sub = await activateSubscription(u, "PRO", { reason: "test" });
  const cancelled = await cancelSubscription(sub.id, { reason: "test" });
  assert.equal(cancelled.cancelAtPeriodEnd, true);
  assert.equal(cancelled.status, "ACTIVE");
  // Still PRO until the period actually ends.
  assert.equal((await getCurrentPlan(u)).key, "PRO");

  const resumed = await resumeSubscription(sub.id, { reason: "test" });
  assert.equal(resumed.cancelAtPeriodEnd, false);
});

test("expiration returns the user to FREE", async () => {
  const u = await makeUser();
  const sub = await activateSubscription(u, "STARTER", { reason: "test" });
  await expireSubscription(sub.id, { reason: "test" });
  assert.equal(await getCurrentSubscription(u), null);
  assert.equal((await getCurrentPlan(u)).key, "FREE");
  assert.equal((await getEntitlement(u, "article_generation")).monthlyLimit, 10); // FREE limit
});

test("only one active subscription exists; activating again supersedes", async () => {
  const u = await makeUser();
  await activateSubscription(u, "STARTER", { reason: "test" });
  await activateSubscription(u, "PRO", { reason: "test" });

  const [{ count }] = await sql`
    SELECT count(*)::int AS count FROM subscriptions WHERE user_id = ${u} AND status = 'ACTIVE'
  `;
  assert.equal(count, 1);
  assert.equal((await getCurrentPlan(u)).key, "PRO");
});

test("subscription history is preserved", async () => {
  const u = await makeUser();
  const sub = await activateSubscription(u, "STARTER", { reason: "test" });
  await expireSubscription(sub.id, { reason: "test" });
  await activateSubscription(u, "PRO", { reason: "test" });

  const history = await getSubscriptionHistory(u);
  assert.ok(history.length >= 2);
  assert.ok(history.some((s) => s.plan.key === "STARTER" && s.status === "EXPIRED"));
  assert.ok(history.some((s) => s.plan.key === "PRO" && s.status === "ACTIVE"));
});

test("invalid state transitions are rejected", async () => {
  const u = await makeUser();
  const sub = await activateSubscription(u, "STARTER", { reason: "test" });
  await expireSubscription(sub.id, { reason: "test" });

  await assert.rejects(
    () => cancelSubscription(sub.id, { reason: "test" }),
    (e) => e instanceof SubscriptionError && e.code === "INVALID_SUBSCRIPTION_STATE"
  );
  await assert.rejects(
    () => expireSubscription(sub.id, { reason: "test" }),
    (e) => e instanceof SubscriptionError && e.code === "INVALID_SUBSCRIPTION_STATE"
  );
});

test("immediate plan change switches the effective plan and grants new credits", async () => {
  const u = await makeUser();
  const sub = await activateSubscription(u, "STARTER", { reason: "test" }); // +20
  await changeSubscriptionPlan(sub.id, "PRO", { immediate: true, reason: "test" }); // +60
  assert.equal((await getCurrentPlan(u)).key, "PRO");
  assert.equal(await getBalance(u), 80);
});
