// Integration tests for the entitlement service (spec §37). Runs against the dev
// Neon DB using synthetic throwaway users, cleaned up after. Seeds the real FREE
// plan plus a controlled TEST_PLAN (deterministic limits) so assertions don't
// depend on env-tunable FREE limits. Run with: npm test
import "dotenv/config";
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import sql from "../config/Neon.js";
import {
  ensureUserPlan,
  getUserPlan,
  checkFeatureAccess,
  consumeFeatureUsage,
  getFeatureUsage,
  getUserEntitlements,
  assignPlan,
} from "../services/entitlementService.js";
import { ENTITLEMENTS } from "../config/entitlements.js";
import { PLANS } from "../config/plans.js";
import { PLAN_ENTITLEMENTS } from "../config/entitlements.js";
import { EntitlementError } from "../lib/entitlementError.js";

const TEST_PLAN = "TEST_PLAN_PHASE4";
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

// Upsert a plan + its entitlements (same shape as scripts/seedPlans.js).
const seedPlan = async (key, name, entitlements) => {
  const [p] = await sql`
    INSERT INTO plans (id, key, name, is_active, created_at, updated_at)
    VALUES (${crypto.randomUUID()}, ${key}, ${name}, true, NOW(), NOW())
    ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name, updated_at = NOW()
    RETURNING id
  `;
  for (const [featureKey, rule] of Object.entries(entitlements)) {
    await sql`
      INSERT INTO plan_entitlements (id, plan_id, feature_key, enabled, monthly_limit, created_at, updated_at)
      VALUES (${crypto.randomUUID()}, ${p.id}, ${featureKey}, ${rule.enabled}, ${rule.monthlyLimit ?? null}, NOW(), NOW())
      ON CONFLICT (plan_id, feature_key) DO UPDATE
        SET enabled = EXCLUDED.enabled, monthly_limit = EXCLUDED.monthly_limit, updated_at = NOW()
    `;
  }
  return p.id;
};

before(async () => {
  // Ensure the real FREE plan exists (new-user default test depends on it).
  await seedPlan(PLANS.FREE.key, PLANS.FREE.name, PLAN_ENTITLEMENTS.FREE);
  // Controlled plan with deterministic limits for the rest of the tests.
  await seedPlan(TEST_PLAN, "Test Plan", {
    [ENTITLEMENTS.RESUME_REVIEW]: { enabled: true, monthlyLimit: 2 },
    [ENTITLEMENTS.ARTICLE_GENERATION]: { enabled: false, monthlyLimit: 5 },
    [ENTITLEMENTS.MATCH_ANALYSIS]: { enabled: true, monthlyLimit: null },
  });
});

after(async () => {
  if (createdUserIds.length) {
    await sql`DELETE FROM feature_usage     WHERE user_id = ANY(${createdUserIds})`;
    await sql`DELETE FROM user_plans        WHERE user_id = ANY(${createdUserIds})`;
    await sql`DELETE FROM plan_change_audit WHERE target_user_id = ANY(${createdUserIds})`;
    await sql`DELETE FROM users             WHERE id = ANY(${createdUserIds})`;
  }
  // Remove the controlled test plan (user_plans referencing it are already gone).
  const [tp] = await sql`SELECT id FROM plans WHERE key = ${TEST_PLAN}`;
  if (tp) {
    await sql`DELETE FROM plan_entitlements WHERE plan_id = ${tp.id}`;
    await sql`DELETE FROM plans WHERE id = ${tp.id}`;
  }
});

// ---- plan ---------------------------------------------------------------

test("new user is assigned the FREE plan", async () => {
  const u = await makeUser();
  await ensureUserPlan(u);
  assert.equal((await getUserPlan(u)).key, "FREE");
});

test("ensureUserPlan is idempotent — one active plan only", async () => {
  const u = await makeUser();
  await ensureUserPlan(u);
  await ensureUserPlan(u);
  await ensureUserPlan(u);
  const [{ count }] = await sql`SELECT count(*)::int AS count FROM user_plans WHERE user_id = ${u}`;
  assert.equal(count, 1);
});

test("getUserPlan throws when the user has no plan", async () => {
  const u = await makeUser();
  await assert.rejects(
    () => getUserPlan(u),
    (e) => e instanceof EntitlementError && e.code === "USER_PLAN_NOT_FOUND"
  );
});

// ---- entitlement --------------------------------------------------------

test("enabled feature is accessible", async () => {
  const u = await makeUser();
  await assignPlan(u, TEST_PLAN, { reason: "test" });
  const res = await checkFeatureAccess(u, ENTITLEMENTS.RESUME_REVIEW);
  assert.equal(res.allowed, true);
  assert.equal(res.limit, 2);
  assert.equal(res.remaining, 2);
});

test("disabled feature is rejected with FEATURE_NOT_AVAILABLE", async () => {
  const u = await makeUser();
  await assignPlan(u, TEST_PLAN, { reason: "test" });
  await assert.rejects(
    () => checkFeatureAccess(u, ENTITLEMENTS.ARTICLE_GENERATION),
    (e) => e instanceof EntitlementError && e.code === "FEATURE_NOT_AVAILABLE"
  );
});

test("invalid feature key is rejected with INVALID_FEATURE", async () => {
  const u = await makeUser();
  await assignPlan(u, TEST_PLAN, { reason: "test" });
  await assert.rejects(
    () => checkFeatureAccess(u, "not_a_real_feature"),
    (e) => e instanceof EntitlementError && e.code === "INVALID_FEATURE"
  );
});

// ---- usage --------------------------------------------------------------

test("usage increments and the monthly limit is enforced", async () => {
  const u = await makeUser();
  await assignPlan(u, TEST_PLAN, { reason: "test" });

  const a = await consumeFeatureUsage(u, ENTITLEMENTS.RESUME_REVIEW);
  assert.equal(a.used, 1);
  const b = await consumeFeatureUsage(u, ENTITLEMENTS.RESUME_REVIEW);
  assert.equal(b.used, 2);

  await assert.rejects(
    () => consumeFeatureUsage(u, ENTITLEMENTS.RESUME_REVIEW),
    (e) => e instanceof EntitlementError && e.code === "USAGE_LIMIT_REACHED"
  );
  assert.equal((await getFeatureUsage(u, ENTITLEMENTS.RESUME_REVIEW)).used, 2);
});

test("credit-metered feature does not record usage", async () => {
  const u = await makeUser();
  await assignPlan(u, TEST_PLAN, { reason: "test" });
  const res = await consumeFeatureUsage(u, ENTITLEMENTS.MATCH_ANALYSIS);
  assert.equal(res.used, null);
  const [{ count }] = await sql`
    SELECT count(*)::int AS count FROM feature_usage
    WHERE user_id = ${u} AND feature_key = ${ENTITLEMENTS.MATCH_ANALYSIS}
  `;
  assert.equal(count, 0);
});

test("a new month starts a new period and preserves history", async () => {
  const u = await makeUser();
  await assignPlan(u, TEST_PLAN, { reason: "test" });

  // Simulate last month's usage at the limit.
  await sql`
    INSERT INTO feature_usage (id, user_id, feature_key, period_start, period_end, usage_count, created_at, updated_at)
    VALUES (
      ${crypto.randomUUID()}, ${u}, ${ENTITLEMENTS.RESUME_REVIEW},
      (date_trunc('month', CURRENT_DATE) - INTERVAL '1 month')::date,
      (date_trunc('month', CURRENT_DATE) - INTERVAL '1 day')::date,
      2, NOW(), NOW()
    )
  `;

  // This month starts fresh.
  const res = await consumeFeatureUsage(u, ENTITLEMENTS.RESUME_REVIEW);
  assert.equal(res.used, 1);

  // Both periods exist; last month's count is untouched.
  const rows = await sql`
    SELECT usage_count FROM feature_usage
    WHERE user_id = ${u} AND feature_key = ${ENTITLEMENTS.RESUME_REVIEW}
    ORDER BY period_start ASC
  `;
  assert.equal(rows.length, 2);
  assert.equal(rows[0].usage_count, 2); // last month preserved
  assert.equal(rows[1].usage_count, 1); // this month fresh
});

test("concurrent requests cannot exceed the limit", async () => {
  const u = await makeUser();
  await assignPlan(u, TEST_PLAN, { reason: "test" });

  const results = await Promise.allSettled([
    consumeFeatureUsage(u, ENTITLEMENTS.RESUME_REVIEW),
    consumeFeatureUsage(u, ENTITLEMENTS.RESUME_REVIEW),
    consumeFeatureUsage(u, ENTITLEMENTS.RESUME_REVIEW),
    consumeFeatureUsage(u, ENTITLEMENTS.RESUME_REVIEW),
  ]);
  const ok = results.filter((r) => r.status === "fulfilled");
  const failed = results.filter((r) => r.status === "rejected");

  assert.equal(ok.length, 2, "exactly two (the limit) should succeed");
  assert.equal(failed.length, 2);
  assert.ok(
    failed.every((r) => r.reason instanceof EntitlementError && r.reason.code === "USAGE_LIMIT_REACHED")
  );
  assert.equal((await getFeatureUsage(u, ENTITLEMENTS.RESUME_REVIEW)).used, 2);
});

// ---- API shape ----------------------------------------------------------

test("getUserEntitlements returns plan + credit and usage features", async () => {
  const u = await makeUser();
  await ensureUserPlan(u); // FREE
  const { plan, features } = await getUserEntitlements(u);
  assert.equal(plan.key, "FREE");

  // Career op exposes a credit cost; generic op exposes usage.
  assert.ok(features[ENTITLEMENTS.MATCH_ANALYSIS].creditCost >= 0);
  const rr = features[ENTITLEMENTS.RESUME_REVIEW];
  assert.equal(typeof rr.monthlyLimit, "number");
  assert.equal(rr.used, 0);
  assert.equal(rr.remaining, rr.monthlyLimit);
});
