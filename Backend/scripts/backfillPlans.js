// One-time backfill: ensure every existing application user has an active FREE
// plan (spec §28). Idempotent — safe to re-run; the UNIQUE(user_id) constraint +
// ensureUserPlan's ON CONFLICT DO NOTHING mean no user ever gets a second plan.
// Does not touch credit balances. Requires plans to be seeded first (seedPlans).
//
// Usage: node scripts/backfillPlans.js   (or: npm run backfill:plans)
import "dotenv/config";
import sql from "../config/Neon.js";
import { ensureUserPlan } from "../services/entitlementService.js";

let total = 0;
try {
  const users = await sql`SELECT id FROM users WHERE deleted_at IS NULL ORDER BY created_at ASC`;
  for (const u of users) {
    await ensureUserPlan(u.id);
    total += 1;
  }
  console.log(`Done. Ensured FREE plan for ${total} users.`);
  process.exit(0);
} catch (err) {
  console.error("backfillPlans failed:", err.message);
  process.exit(1);
}
