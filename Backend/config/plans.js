// Application plan definitions (spec §9). The application database is the
// authoritative source for a user's plan — these are the canonical plan configs
// that scripts/seedPlans.js upserts into the `plans` table.
//
// Phase 4 only ACTIVATES FREE. The structure intentionally leaves room for paid
// plans (STARTER / PRO / POWER) in Phase 5 without reworking the schema, but no
// paid-plan behavior is implemented here.

export const PLAN_KEYS = {
  FREE: "FREE",
  // STARTER: "STARTER",  // Phase 5
  // PRO: "PRO",          // Phase 5
  // POWER: "POWER",      // Phase 5
};

export const PLANS = {
  FREE: {
    key: "FREE",
    name: "Free",
    description: "Default plan for every user. Generic AI tools with monthly limits; career tools are credit-based.",
    isActive: true,
  },
};

// The plan new users are assigned (spec §5).
export const DEFAULT_PLAN_KEY = PLAN_KEYS.FREE;

export const isKnownPlan = (key) => Object.prototype.hasOwnProperty.call(PLANS, key);
