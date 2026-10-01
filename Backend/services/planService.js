// planService — read-only access to the plan catalog (spec §19). The frontend
// consumes plan info (pricing, credits) from the API through this, never hardcoding
// it (spec §4, §41). Plans are seeded from config by scripts/seedPlans.js.
import sql from "../config/Neon.js";

const shapePlan = (row) =>
  row && {
    id: row.id,
    key: row.key,
    name: row.name,
    description: row.description ?? null,
    price: row.price,
    currency: row.currency,
    billingInterval: row.billing_interval,
    monthlyCredits: row.monthly_credits,
    isActive: row.is_active,
  };

/** Active, public plans ordered by price (spec §31). FREE first, then paid tiers. */
export const getPlans = async () => {
  const rows = await sql`
    SELECT id, key, name, description, price, currency, billing_interval, monthly_credits, is_active
    FROM plans
    WHERE is_active = true
    ORDER BY price ASC
  `;
  return rows.map(shapePlan);
};

/** One plan by key (includes inactive); null if unknown. */
export const getPlan = async (planKey) => {
  const [row] = await sql`
    SELECT id, key, name, description, price, currency, billing_interval, monthly_credits, is_active
    FROM plans WHERE key = ${planKey}
  `;
  return shapePlan(row);
};

/** One plan by id; null if unknown. */
export const getPlanById = async (planId) => {
  const [row] = await sql`
    SELECT id, key, name, description, price, currency, billing_interval, monthly_credits, is_active
    FROM plans WHERE id = ${planId}
  `;
  return shapePlan(row);
};

/** The entitlement rules for a plan (spec §19). */
export const getPlanEntitlements = async (planId) => {
  const rows = await sql`
    SELECT feature_key, enabled, monthly_limit
    FROM plan_entitlements WHERE plan_id = ${planId}
    ORDER BY feature_key ASC
  `;
  return rows.map((r) => ({
    featureKey: r.feature_key,
    enabled: r.enabled,
    monthlyLimit: r.monthly_limit,
  }));
};

/** The monthly credit grant for a plan (spec §19). 0 if unknown. */
export const getPlanCreditGrant = async (planId) => {
  const [row] = await sql`SELECT monthly_credits FROM plans WHERE id = ${planId}`;
  return row?.monthly_credits ?? 0;
};
