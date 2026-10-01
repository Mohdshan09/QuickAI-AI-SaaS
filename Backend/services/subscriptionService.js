// subscriptionService — the single owner of subscription state + lifecycle (spec
// §10, §18). It decides WHICH plan a user is on; entitlements and credits are
// resolved from that (spec §48). Payment-provider independent: a future verified
// payment event (Phase 7) is just another caller of activate/renew (spec §17, §42).
//
// Reuses the Phase 2 credit ledger for recurring grants (spec §21-26) — it never
// touches wallet.balance directly. All state transitions happen here and invalid
// ones are rejected (spec §35).
import crypto from "crypto";
import sql from "../config/Neon.js";
import { grantCredits } from "./creditService.js";
import { getPlan, getPlanById } from "./planService.js";
import { TRANSACTION_TYPES } from "../config/credits.js";
import { DEFAULT_PLAN_KEY } from "../config/plans.js";
import { SubscriptionError } from "../lib/subscriptionError.js";

const log = (event, fields = {}) =>
  console.log(`[subscription] ${JSON.stringify({ event, at: new Date().toISOString(), ...fields })}`);

// ---- shaping ------------------------------------------------------------
const shape = (row) =>
  row
    ? {
    id: row.id,
    userId: row.user_id,
    planId: row.plan_id,
    pendingPlanId: row.pending_plan_id ?? null,
    plan: row.plan_key ? { key: row.plan_key, name: row.plan_name } : null,
    status: row.status,
    billingInterval: row.billing_interval,
    startedAt: row.started_at,
    currentPeriodStart: row.current_period_start,
    currentPeriodEnd: row.current_period_end,
    cancelAtPeriodEnd: row.cancel_at_period_end,
    cancelledAt: row.cancelled_at ?? null,
    endedAt: row.ended_at ?? null,
      }
    : null;

const getById = async (subscriptionId) => {
  const [row] = await sql`
    SELECT s.*, p.key AS plan_key, p.name AS plan_name
    FROM subscriptions s JOIN plans p ON p.id = s.plan_id
    WHERE s.id = ${subscriptionId}
  `;
  return shape(row);
};

// ISO date (YYYY-MM-DD) used in the idempotent grant reference (spec §26).
const toDate = (d) => new Date(d).toISOString().slice(0, 10);

// Grant this period's plan credits once (spec §22-26). Deterministic reference makes
// repeats a no-op via the ledger's (user_id, type, reference_id) partial-unique.
const grantForPeriod = async (sub, { monthlyCredits, planKey }) => {
  if (!monthlyCredits || monthlyCredits <= 0) return; // FREE / no grant
  const referenceId = `SUBSCRIPTION_GRANT:${sub.id}:${toDate(sub.currentPeriodStart)}`;
  await grantCredits(sub.userId, monthlyCredits, TRANSACTION_TYPES.SUBSCRIPTION_GRANT, referenceId, {
    subscriptionId: sub.id,
    planKey,
    periodStart: toDate(sub.currentPeriodStart),
  });
  log("SUBSCRIPTION_CREDIT_GRANTED", { userId: sub.userId, subscriptionId: sub.id, amount: monthlyCredits, referenceId });
};

const audit = async ({ adminUserId = null, targetUserId, subscriptionId = null, action, oldStatus = null, newStatus = null, oldPlan = null, newPlan = null, reason = null }) => {
  try {
    await sql`
      INSERT INTO subscription_audit (
        id, admin_user_id, target_user_id, subscription_id, action,
        old_status, new_status, old_plan, new_plan, reason, created_at
      ) VALUES (
        ${crypto.randomUUID()}, ${adminUserId}, ${targetUserId}, ${subscriptionId}, ${action},
        ${oldStatus}, ${newStatus}, ${oldPlan}, ${newPlan}, ${reason}, NOW()
      )
    `;
  } catch (err) {
    console.error("subscription_audit insert failed:", err.message);
  }
};

// ---- reads --------------------------------------------------------------

/** The active, non-expired subscription for a user, or null (spec §10). */
export const getCurrentSubscription = async (userId) => {
  const [row] = await sql`
    SELECT s.*, p.key AS plan_key, p.name AS plan_name
    FROM subscriptions s JOIN plans p ON p.id = s.plan_id
    WHERE s.user_id = ${userId} AND s.status = 'ACTIVE' AND s.current_period_end > NOW()
    ORDER BY s.current_period_end DESC
    LIMIT 1
  `;
  return shape(row);
};

/**
 * The user's effective plan (spec §11): the active subscription's plan, else FREE.
 * @returns {Promise<{id,key,name,...}>}
 */
export const getCurrentPlan = async (userId) => {
  const sub = await getCurrentSubscription(userId);
  if (sub) {
    const plan = await getPlanById(sub.planId);
    if (plan) return plan;
  }
  return getPlan(DEFAULT_PLAN_KEY); // FREE baseline (spec §12)
};

/** Full subscription history, newest first, never mutated (spec §29, §32). */
export const getSubscriptionHistory = async (userId) => {
  const rows = await sql`
    SELECT s.*, p.key AS plan_key, p.name AS plan_name
    FROM subscriptions s JOIN plans p ON p.id = s.plan_id
    WHERE s.user_id = ${userId}
    ORDER BY s.created_at DESC
  `;
  return rows.map(shape);
};

// ---- lifecycle ----------------------------------------------------------

/**
 * Activate a (paid) plan for a user: supersede any current subscription, create a
 * fresh ACTIVE period, and grant the plan's monthly credits (spec §16, §23). This is
 * the controlled entry point — invoked by admin ops or a future verified payment
 * event, never directly by an arbitrary client.
 */
export const activateSubscription = async (userId, planKey, { adminUserId = null, reason = null, billingInterval = "MONTHLY" } = {}) => {
  const plan = await getPlan(planKey);
  if (!plan || !plan.isActive) throw new SubscriptionError("PLAN_NOT_FOUND", `Plan ${planKey} is not available.`);

  // Supersede an existing active subscription so the one-active-per-user rule holds.
  const existing = await getCurrentSubscription(userId);
  if (existing) {
    await sql`UPDATE subscriptions SET status = 'EXPIRED', ended_at = NOW(), updated_at = NOW() WHERE id = ${existing.id}`;
  }

  let created;
  try {
    const [row] = await sql`
      INSERT INTO subscriptions (
        id, user_id, plan_id, status, billing_interval,
        started_at, current_period_start, current_period_end, created_at, updated_at
      ) VALUES (
        ${crypto.randomUUID()}, ${userId}, ${plan.id}, 'ACTIVE', ${billingInterval},
        NOW(), NOW(), NOW() + INTERVAL '1 month', NOW(), NOW()
      )
      RETURNING *
    `;
    created = shape({ ...row, plan_key: plan.key, plan_name: plan.name });
  } catch (err) {
    if (err?.code === "23503" || /foreign key/i.test(err?.message || "")) {
      throw new SubscriptionError("SUBSCRIPTION_OPERATION_FAILED", "User does not exist.");
    }
    console.error("activateSubscription insert failed:", err.message);
    throw new SubscriptionError("SUBSCRIPTION_OPERATION_FAILED", "Could not activate the subscription.");
  }

  await grantForPeriod(created, { monthlyCredits: plan.monthlyCredits, planKey: plan.key });
  await audit({ adminUserId, targetUserId: userId, subscriptionId: created.id, action: "SUBSCRIPTION_ACTIVATED", oldStatus: existing?.status ?? null, newStatus: "ACTIVE", oldPlan: existing?.plan?.key ?? null, newPlan: plan.key, reason });
  log("SUBSCRIPTION_ACTIVATED", { userId, subscriptionId: created.id, plan: plan.key });
  return created;
};

/** Request cancellation: keep access until period end (spec §14-15, §33). */
export const cancelSubscription = async (subscriptionId, { adminUserId = null, reason = null } = {}) => {
  const sub = await getById(subscriptionId);
  if (!sub) throw new SubscriptionError("SUBSCRIPTION_NOT_FOUND", "Subscription not found.");
  if (sub.status !== "ACTIVE") throw new SubscriptionError("INVALID_SUBSCRIPTION_STATE", "Only an active subscription can be cancelled.");

  const [row] = await sql`
    UPDATE subscriptions SET cancel_at_period_end = true, cancelled_at = NOW(), updated_at = NOW()
    WHERE id = ${subscriptionId}
    RETURNING *
  `;
  await audit({ adminUserId, targetUserId: sub.userId, subscriptionId, action: "SUBSCRIPTION_CANCELLED", oldStatus: "ACTIVE", newStatus: "ACTIVE", oldPlan: sub.plan?.key, newPlan: sub.plan?.key, reason });
  log("SUBSCRIPTION_CANCELLED", { subscriptionId });
  return shape({ ...row, plan_key: sub.plan?.key, plan_name: sub.plan?.name });
};

/** Undo a pending cancellation before the period ends (spec §34). */
export const resumeSubscription = async (subscriptionId, { adminUserId = null, reason = null } = {}) => {
  const sub = await getById(subscriptionId);
  if (!sub) throw new SubscriptionError("SUBSCRIPTION_NOT_FOUND", "Subscription not found.");
  if (sub.status !== "ACTIVE" || new Date(sub.currentPeriodEnd) <= new Date()) {
    throw new SubscriptionError("INVALID_SUBSCRIPTION_STATE", "Only an active, unexpired subscription can be resumed.");
  }

  const [row] = await sql`
    UPDATE subscriptions SET cancel_at_period_end = false, cancelled_at = NULL, updated_at = NOW()
    WHERE id = ${subscriptionId}
    RETURNING *
  `;
  await audit({ adminUserId, targetUserId: sub.userId, subscriptionId, action: "SUBSCRIPTION_RESUMED", oldStatus: "ACTIVE", newStatus: "ACTIVE", oldPlan: sub.plan?.key, newPlan: sub.plan?.key, reason });
  log("SUBSCRIPTION_RESUMED", { subscriptionId });
  return shape({ ...row, plan_key: sub.plan?.key, plan_name: sub.plan?.name });
};

/** End a subscription now → user falls back to FREE (spec §14). */
export const expireSubscription = async (subscriptionId, { adminUserId = null, reason = null } = {}) => {
  const sub = await getById(subscriptionId);
  if (!sub) throw new SubscriptionError("SUBSCRIPTION_NOT_FOUND", "Subscription not found.");
  if (sub.status === "EXPIRED") throw new SubscriptionError("INVALID_SUBSCRIPTION_STATE", "Subscription is already expired.");

  const [row] = await sql`
    UPDATE subscriptions SET status = 'EXPIRED', ended_at = NOW(), updated_at = NOW()
    WHERE id = ${subscriptionId}
    RETURNING *
  `;
  await audit({ adminUserId, targetUserId: sub.userId, subscriptionId, action: "SUBSCRIPTION_EXPIRED", oldStatus: sub.status, newStatus: "EXPIRED", oldPlan: sub.plan?.key, newPlan: sub.plan?.key, reason });
  log("SUBSCRIPTION_EXPIRED", { subscriptionId });
  return shape({ ...row, plan_key: sub.plan?.key, plan_name: sub.plan?.name });
};

/**
 * Renew into a new period (spec §24): advance the window, apply any pending plan
 * change (spec §28), and grant that period's credits once (idempotent). If the user
 * had requested cancellation, expire instead of renewing (spec §14).
 */
export const renewSubscription = async (subscriptionId, { adminUserId = null, reason = null } = {}) => {
  const sub = await getById(subscriptionId);
  if (!sub) throw new SubscriptionError("SUBSCRIPTION_NOT_FOUND", "Subscription not found.");
  if (sub.status !== "ACTIVE") throw new SubscriptionError("INVALID_SUBSCRIPTION_STATE", "Only an active subscription can be renewed.");

  if (sub.cancelAtPeriodEnd) return expireSubscription(subscriptionId, { adminUserId, reason: reason ?? "cancelled at period end" });

  const newPlanId = sub.pendingPlanId || sub.planId;
  const plan = await getPlanById(newPlanId);
  if (!plan) throw new SubscriptionError("PLAN_NOT_FOUND", "Plan no longer exists.");

  const [row] = await sql`
    UPDATE subscriptions SET
      plan_id = ${newPlanId},
      pending_plan_id = NULL,
      current_period_start = current_period_end,
      current_period_end = current_period_end + INTERVAL '1 month',
      updated_at = NOW()
    WHERE id = ${subscriptionId}
    RETURNING *
  `;
  const renewed = shape({ ...row, plan_key: plan.key, plan_name: plan.name });
  await grantForPeriod(renewed, { monthlyCredits: plan.monthlyCredits, planKey: plan.key });
  await audit({ adminUserId, targetUserId: sub.userId, subscriptionId, action: "SUBSCRIPTION_RENEWED", oldStatus: "ACTIVE", newStatus: "ACTIVE", oldPlan: sub.plan?.key, newPlan: plan.key, reason });
  log("SUBSCRIPTION_RENEWED", { subscriptionId, plan: plan.key });
  return renewed;
};

/**
 * Change plan (spec §27-28). Default: schedule for the next period (pending_plan_id).
 * immediate (admin/test): expire current and activate the new plan now (fresh grant).
 */
export const changeSubscriptionPlan = async (subscriptionId, newPlanKey, { immediate = false, adminUserId = null, reason = null } = {}) => {
  const sub = await getById(subscriptionId);
  if (!sub) throw new SubscriptionError("SUBSCRIPTION_NOT_FOUND", "Subscription not found.");
  if (sub.status !== "ACTIVE") throw new SubscriptionError("INVALID_SUBSCRIPTION_STATE", "Only an active subscription can change plan.");
  const newPlan = await getPlan(newPlanKey);
  if (!newPlan || !newPlan.isActive) throw new SubscriptionError("PLAN_NOT_FOUND", `Plan ${newPlanKey} is not available.`);

  if (immediate) {
    await expireSubscription(subscriptionId, { adminUserId, reason: reason ?? "plan change (immediate)" });
    const activated = await activateSubscription(sub.userId, newPlanKey, { adminUserId, reason: reason ?? "plan change (immediate)" });
    await audit({ adminUserId, targetUserId: sub.userId, subscriptionId: activated.id, action: "SUBSCRIPTION_PLAN_CHANGED", oldStatus: "ACTIVE", newStatus: "ACTIVE", oldPlan: sub.plan?.key, newPlan: newPlan.key, reason });
    return activated;
  }

  const [row] = await sql`
    UPDATE subscriptions SET pending_plan_id = ${newPlan.id}, updated_at = NOW()
    WHERE id = ${subscriptionId}
    RETURNING *
  `;
  await audit({ adminUserId, targetUserId: sub.userId, subscriptionId, action: "SUBSCRIPTION_PLAN_CHANGED", oldStatus: "ACTIVE", newStatus: "ACTIVE", oldPlan: sub.plan?.key, newPlan: `${newPlan.key} (next period)`, reason });
  log("SUBSCRIPTION_PLAN_CHANGE_SCHEDULED", { subscriptionId, newPlan: newPlan.key });
  return shape({ ...row, plan_key: sub.plan?.key, plan_name: sub.plan?.name });
};

// For a cron/admin sweep: mark past-due ACTIVE subscriptions as EXPIRED (spec §14).
export const expireDueSubscriptions = async () => {
  const rows = await sql`
    UPDATE subscriptions SET status = 'EXPIRED', ended_at = NOW(), updated_at = NOW()
    WHERE status = 'ACTIVE' AND current_period_end <= NOW()
    RETURNING id, user_id
  `;
  if (rows.length) log("SUBSCRIPTIONS_EXPIRED_SWEEP", { count: rows.length });
  return rows.length;
};
