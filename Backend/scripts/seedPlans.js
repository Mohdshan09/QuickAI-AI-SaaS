// Seed/sync the plan + entitlement catalog from config into the database
// (spec §9, §11). Idempotent — safe to re-run after changing config/plans.js or
// config/entitlements.js; it upserts so limits stay in sync with the config, the
// single source of truth. Run after migrations.
//
// Usage: node scripts/seedPlans.js   (or: npm run seed:plans)
import "dotenv/config";
import crypto from "crypto";
import sql from "../config/Neon.js";
import { PLANS } from "../config/plans.js";
import { PLAN_ENTITLEMENTS } from "../config/entitlements.js";

let plansCount = 0;
let entCount = 0;
try {
  for (const plan of Object.values(PLANS)) {
    const [row] = await sql`
      INSERT INTO plans (id, key, name, description, is_active, created_at, updated_at)
      VALUES (${crypto.randomUUID()}, ${plan.key}, ${plan.name}, ${plan.description ?? null}, ${plan.isActive ?? true}, NOW(), NOW())
      ON CONFLICT (key) DO UPDATE
        SET name = EXCLUDED.name,
            description = EXCLUDED.description,
            is_active = EXCLUDED.is_active,
            updated_at = NOW()
      RETURNING id
    `;
    plansCount += 1;

    const entitlements = PLAN_ENTITLEMENTS[plan.key] || {};
    for (const [featureKey, rule] of Object.entries(entitlements)) {
      await sql`
        INSERT INTO plan_entitlements (id, plan_id, feature_key, enabled, monthly_limit, created_at, updated_at)
        VALUES (${crypto.randomUUID()}, ${row.id}, ${featureKey}, ${rule.enabled ?? true}, ${rule.monthlyLimit ?? null}, NOW(), NOW())
        ON CONFLICT (plan_id, feature_key) DO UPDATE
          SET enabled = EXCLUDED.enabled,
              monthly_limit = EXCLUDED.monthly_limit,
              updated_at = NOW()
      `;
      entCount += 1;
    }
  }
  console.log(`Done. Seeded ${plansCount} plan(s) and ${entCount} entitlement(s).`);
  process.exit(0);
} catch (err) {
  console.error("seedPlans failed:", err.message);
  process.exit(1);
}
