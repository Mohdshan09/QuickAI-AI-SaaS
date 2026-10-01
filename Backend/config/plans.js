// Application plan definitions (spec §4, §6). The application database is the
// authoritative source for a user's plan — these are the canonical plan configs
// that scripts/seedPlans.js upserts into the `plans` table. Pricing is
// configuration, not business logic (spec §4): price is whole INR, monthly_credits
// is granted on subscription activation/renewal (FREE's 3 is the Phase 2 one-time
// initial grant; FREE has no recurring grant).
//
// Phase 5 activates FREE, STARTER and PRO. (POWER was intentionally dropped.)

export const PLAN_KEYS = {
  FREE: "FREE",
  STARTER: "STARTER",
  PRO: "PRO",
};

export const PLANS = {
  FREE: {
    key: "FREE",
    name: "Free",
    description: "Generic AI tools with monthly limits; career tools are credit-based.",
    price: 0,
    currency: "INR",
    billingInterval: "MONTHLY",
    monthlyCredits: 3,
    isActive: true,
  },
  STARTER: {
    key: "STARTER",
    name: "Starter",
    description: "Higher monthly limits and 20 AI credits each month.",
    price: 99,
    currency: "INR",
    billingInterval: "MONTHLY",
    monthlyCredits: 20,
    isActive: true,
  },
  PRO: {
    key: "PRO",
    name: "Pro",
    description: "The highest limits and 60 AI credits each month.",
    price: 249,
    currency: "INR",
    billingInterval: "MONTHLY",
    monthlyCredits: 60,
    isActive: true,
  },
};

// The plan new users are assigned (spec §5).
export const DEFAULT_PLAN_KEY = PLAN_KEYS.FREE;

export const isKnownPlan = (key) => Object.prototype.hasOwnProperty.call(PLANS, key);

// Paid plan keys (everything except FREE) — the plans a subscription can grant.
export const PAID_PLAN_KEYS = Object.values(PLAN_KEYS).filter((k) => k !== PLAN_KEYS.FREE);
