// entitlementService — the single place that resolves plan/entitlement state and
// mutates feature_usage (mirrors how creditService owns the wallet). Controllers
// must go through this so access logic is never duplicated (spec §15).
//
// Separation of concerns (spec §4): entitlements answer "can this user access this
// feature?" — independent of credits ("can they afford it?"). The entitlement
// check always runs BEFORE the credit check for career ops (spec §17, §19).
//
// Atomicity: like creditService, the Neon HTTP driver has no interactive
// transactions, so the usage limit is enforced with a single-statement conditional
// upsert whose row lock serializes concurrent writers — two requests can never
// consume the same final slot (spec §30).
import crypto from "crypto";
import sql from "../config/Neon.js";
import { EntitlementError } from "../lib/entitlementError.js";
import { DEFAULT_PLAN_KEY } from "../config/plans.js";
import { isKnownFeature, creditCostForFeature, isCreditMetered } from "../config/entitlements.js";

// ---- helpers ------------------------------------------------------------
const isPgCode = (err, code) =>
  err?.code === code ||
  (code === "23503" && /foreign key/i.test(err?.message || "")) ||
  (code === "23505" && /duplicate key|unique/i.test(err?.message || ""));

const wrap = (err, code, message) => {
  if (err instanceof EntitlementError) return err;
  console.error(`entitlement ${code}:`, err?.message || err);
  return new EntitlementError(code, message);
};

const getPlanByKey = async (key) => {
  const [row] = await sql`SELECT id, key, name, description FROM plans WHERE key = ${key}`;
  return row || null;
};

const shapePlan = (row) => row && { key: row.key, name: row.name, description: row.description ?? null };

// ---- plan assignment ----------------------------------------------------

/**
 * Idempotently ensure the user has one ACTIVE application plan (spec §27).
 * Safe to call on every login / entitlement access — the UNIQUE(user_id)
 * constraint + ON CONFLICT DO NOTHING guarantee it never creates a second plan.
 * @returns {Promise<{key,name,description}>} the user's active plan
 */
export const ensureUserPlan = async (userId, planKey = DEFAULT_PLAN_KEY) => {
  if (!userId) throw new EntitlementError("ENTITLEMENT_CHECK_FAILED", "Missing user id.");
  const plan = await getPlanByKey(planKey);
  if (!plan) throw new EntitlementError("PLAN_NOT_FOUND", `Plan ${planKey} is not configured.`);
  try {
    await sql`
      INSERT INTO user_plans (id, user_id, plan_id, status, started_at, expires_at, created_at, updated_at)
      VALUES (${crypto.randomUUID()}, ${userId}, ${plan.id}, 'ACTIVE', NOW(), NULL, NOW(), NOW())
      ON CONFLICT (user_id) DO NOTHING
    `;
  } catch (err) {
    if (isPgCode(err, "23503")) {
      throw new EntitlementError("USER_PLAN_NOT_FOUND", "User does not exist.");
    }
    throw wrap(err, "ENTITLEMENT_CHECK_FAILED", "Could not assign a plan.");
  }
  return shapePlan(plan);
};

/** The user's active plan, or throws USER_PLAN_NOT_FOUND (spec §15). */
export const getUserPlan = async (userId) => {
  const [row] = await sql`
    SELECT p.key, p.name, p.description
    FROM user_plans up
    JOIN plans p ON p.id = up.plan_id
    WHERE up.user_id = ${userId} AND up.status = 'ACTIVE'
    LIMIT 1
  `;
  if (!row) throw new EntitlementError("USER_PLAN_NOT_FOUND", "No active plan for this user.");
  return shapePlan(row);
};

// ---- entitlement resolution --------------------------------------------

/**
 * The entitlement rule for one feature on the user's active plan, or null if the
 * plan does not grant it. Throws INVALID_FEATURE for unknown keys.
 * @returns {Promise<{enabled:boolean, monthlyLimit:number|null}|null>}
 */
export const getEntitlement = async (userId, featureKey) => {
  if (!isKnownFeature(featureKey)) {
    throw new EntitlementError("INVALID_FEATURE", "Unknown feature.");
  }
  const [row] = await sql`
    SELECT pe.enabled, pe.monthly_limit
    FROM user_plans up
    JOIN plan_entitlements pe ON pe.plan_id = up.plan_id
    WHERE up.user_id = ${userId} AND up.status = 'ACTIVE' AND pe.feature_key = ${featureKey}
    LIMIT 1
  `;
  if (!row) return null;
  return { enabled: row.enabled, monthlyLimit: row.monthly_limit };
};

/** Boolean: is the feature enabled on the user's plan? (spec §15) */
export const hasEntitlement = async (userId, featureKey) => {
  const ent = await getEntitlement(userId, featureKey);
  return !!(ent && ent.enabled);
};

// ---- usage --------------------------------------------------------------

// Current monthly usage count for a feature (0 if no row yet). Period is derived
// from the server date only (spec §14) — never from the client.
const currentUsageCount = async (userId, featureKey) => {
  const [row] = await sql`
    SELECT usage_count
    FROM feature_usage
    WHERE user_id = ${userId}
      AND feature_key = ${featureKey}
      AND period_start = date_trunc('month', CURRENT_DATE)::date
    LIMIT 1
  `;
  return row?.usage_count ?? 0;
};

const remainingFrom = (limit, used) =>
  limit == null ? null : Math.max(0, limit - used);

/**
 * Read-only current-period usage for a feature (spec §15).
 * @returns {Promise<{used, limit, remaining, periodStart, periodEnd}>}
 */
export const getFeatureUsage = async (userId, featureKey) => {
  const ent = await getEntitlement(userId, featureKey);
  const limit = ent?.monthlyLimit ?? null;
  const [row] = await sql`
    SELECT usage_count,
           date_trunc('month', CURRENT_DATE)::date AS period_start,
           (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month - 1 day')::date AS period_end
    FROM feature_usage
    WHERE user_id = ${userId}
      AND feature_key = ${featureKey}
      AND period_start = date_trunc('month', CURRENT_DATE)::date
    LIMIT 1
  `;
  // When no row exists yet, still return the correct period bounds.
  let periodStart = row?.period_start ?? null;
  let periodEnd = row?.period_end ?? null;
  if (!periodStart) {
    const [p] = await sql`
      SELECT date_trunc('month', CURRENT_DATE)::date AS period_start,
             (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month - 1 day')::date AS period_end
    `;
    periodStart = p.period_start;
    periodEnd = p.period_end;
  }
  const used = row?.usage_count ?? 0;
  return { used, limit, remaining: remainingFrom(limit, used), periodStart, periodEnd };
};

/**
 * Full access decision, WITHOUT mutating (spec §16). Order:
 *   active plan -> feature enabled -> monthly limit not reached.
 * Credit-metered features (monthlyLimit null) only check enablement; credits are
 * verified separately afterwards (spec §17).
 * @returns {Promise<{allowed:true, limit, used, remaining, creditCost}>}
 * @throws {EntitlementError} FEATURE_NOT_AVAILABLE | USAGE_LIMIT_REACHED | ...
 */
export const checkFeatureAccess = async (userId, featureKey) => {
  if (!userId) throw new EntitlementError("ENTITLEMENT_CHECK_FAILED", "Missing user id.");
  if (!isKnownFeature(featureKey)) throw new EntitlementError("INVALID_FEATURE", "Unknown feature.");

  await ensureUserPlan(userId); // spec §16: there must always be an active plan
  const ent = await getEntitlement(userId, featureKey);

  if (!ent || !ent.enabled) {
    throw new EntitlementError(
      "FEATURE_NOT_AVAILABLE",
      "This feature isn't available on your current plan."
    );
  }

  const limit = ent.monthlyLimit;
  const creditCost = creditCostForFeature(featureKey);

  // Credit-metered feature: enablement is enough here; credits are checked next.
  if (limit == null) {
    return { allowed: true, limit: null, used: null, remaining: null, creditCost };
  }

  const used = await currentUsageCount(userId, featureKey);
  if (used >= limit) {
    throw new EntitlementError(
      "USAGE_LIMIT_REACHED",
      "You've reached your monthly limit for this feature."
    );
  }
  return { allowed: true, limit, used, remaining: remainingFrom(limit, used), creditCost };
};

/**
 * Atomically record one use of a usage-limited feature (spec §13, §18, §30). This
 * is the real concurrency guard: a single conditional upsert increments the
 * current period's counter only while it is below the limit, so two simultaneous
 * requests can never push usage past the limit. Not called for credit-metered
 * features (credits are their meter).
 * @returns {Promise<{used, limit, remaining}>}
 * @throws {EntitlementError} USAGE_LIMIT_REACHED | USAGE_RECORD_ERROR | ...
 */
export const consumeFeatureUsage = async (userId, featureKey) => {
  const ent = await getEntitlement(userId, featureKey);
  if (!ent || !ent.enabled) {
    throw new EntitlementError("FEATURE_NOT_AVAILABLE", "This feature isn't available on your current plan.");
  }
  const limit = ent.monthlyLimit;

  // Unlimited / credit-metered: nothing to meter here.
  if (limit == null) return { used: null, limit: null, remaining: null };
  if (limit <= 0) {
    throw new EntitlementError("USAGE_LIMIT_REACHED", "You've reached your monthly limit for this feature.");
  }

  try {
    // Conditional upsert: insert the first use of the month, or increment while
    // under the limit. The DO UPDATE ... WHERE clause makes the limit atomic.
    const [row] = await sql`
      INSERT INTO feature_usage (
        id, user_id, feature_key, period_start, period_end, usage_count, created_at, updated_at
      ) VALUES (
        ${crypto.randomUUID()}, ${userId}, ${featureKey},
        date_trunc('month', CURRENT_DATE)::date,
        (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month - 1 day')::date,
        1, NOW(), NOW()
      )
      ON CONFLICT (user_id, feature_key, period_start) DO UPDATE
        SET usage_count = feature_usage.usage_count + 1, updated_at = NOW()
        WHERE feature_usage.usage_count < ${limit}
      RETURNING usage_count
    `;
    if (!row) {
      // Conflict existed but the guard failed -> already at the limit.
      throw new EntitlementError("USAGE_LIMIT_REACHED", "You've reached your monthly limit for this feature.");
    }
    return { used: row.usage_count, limit, remaining: remainingFrom(limit, row.usage_count) };
  } catch (err) {
    if (isPgCode(err, "23503")) throw new EntitlementError("USER_PLAN_NOT_FOUND", "User does not exist.");
    throw wrap(err, "USAGE_RECORD_ERROR", "Could not record feature usage.");
  }
};

/**
 * The authenticated user's plan + every feature's state, shaped for
 * GET /api/entitlements (spec §21). Credit features expose creditCost; usage
 * features expose monthlyLimit/used/remaining.
 */
export const getUserEntitlements = async (userId) => {
  const plan = await getUserPlan(userId);
  const rows = await sql`
    SELECT pe.feature_key, pe.enabled, pe.monthly_limit
    FROM user_plans up
    JOIN plan_entitlements pe ON pe.plan_id = up.plan_id
    WHERE up.user_id = ${userId} AND up.status = 'ACTIVE'
    ORDER BY pe.feature_key ASC
  `;

  // Current-period usage for all of this user's features in one query.
  const usageRows = await sql`
    SELECT feature_key, usage_count
    FROM feature_usage
    WHERE user_id = ${userId}
      AND period_start = date_trunc('month', CURRENT_DATE)::date
  `;
  const usedByFeature = Object.fromEntries(usageRows.map((r) => [r.feature_key, r.usage_count]));

  const features = {};
  for (const r of rows) {
    const key = r.feature_key;
    const limit = r.monthly_limit;
    if (isCreditMetered(key)) {
      features[key] = { enabled: r.enabled, creditCost: creditCostForFeature(key) };
    } else {
      const used = usedByFeature[key] ?? 0;
      features[key] = {
        enabled: r.enabled,
        monthlyLimit: limit,
        used,
        remaining: remainingFrom(limit, used),
      };
    }
  }
  return { plan, features };
};

// ---- admin --------------------------------------------------------------

/**
 * Change a user's plan and write an audit record (spec §33). Server-side only —
 * there is no public plan-switching endpoint. Only FREE is assignable in Phase 4.
 */
export const assignPlan = async (userId, planKey, { adminUserId = null, reason = null } = {}) => {
  const plan = await getPlanByKey(planKey);
  if (!plan) throw new EntitlementError("PLAN_NOT_FOUND", `Plan ${planKey} is not configured.`);

  // Capture the old plan for the audit (may be none).
  let oldPlanKey = null;
  try {
    const current = await getUserPlan(userId);
    oldPlanKey = current.key;
  } catch {
    oldPlanKey = null; // no active plan yet
  }

  try {
    await sql`
      INSERT INTO user_plans (id, user_id, plan_id, status, started_at, expires_at, created_at, updated_at)
      VALUES (${crypto.randomUUID()}, ${userId}, ${plan.id}, 'ACTIVE', NOW(), NULL, NOW(), NOW())
      ON CONFLICT (user_id) DO UPDATE
        SET plan_id = ${plan.id}, status = 'ACTIVE', expires_at = NULL, updated_at = NOW()
    `;
  } catch (err) {
    if (isPgCode(err, "23503")) throw new EntitlementError("USER_PLAN_NOT_FOUND", "User does not exist.");
    throw wrap(err, "ENTITLEMENT_CHECK_FAILED", "Could not change the plan.");
  }

  // Audit is append-only (spec §33). Best-effort: a logging failure must not undo
  // the plan change, but we surface it so it isn't silently lost.
  try {
    await sql`
      INSERT INTO plan_change_audit (id, admin_user_id, target_user_id, old_plan, new_plan, reason, created_at)
      VALUES (${crypto.randomUUID()}, ${adminUserId}, ${userId}, ${oldPlanKey}, ${planKey}, ${reason}, NOW())
    `;
  } catch (err) {
    console.error("plan_change_audit insert failed:", err.message);
  }

  return { plan: shapePlan(plan), oldPlan: oldPlanKey };
};
