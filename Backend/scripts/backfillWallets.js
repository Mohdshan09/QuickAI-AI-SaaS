// One-time backfill: ensure every existing application user has a credit wallet
// and its one-time initial grant (Phase 2). Idempotent — safe to re-run; the
// initial grant is never applied twice.
//
// Usage: node scripts/backfillWallets.js   (or: npm run backfill:wallets)
import "dotenv/config";
import sql from "../config/Neon.js";
import { ensureWallet } from "../services/creditService.js";

let total = 0;
try {
  const users = await sql`SELECT id FROM users WHERE deleted_at IS NULL ORDER BY created_at ASC`;
  for (const u of users) {
    await ensureWallet(u.id);
    total += 1;
  }
  console.log(`Done. Ensured wallets for ${total} users.`);
  process.exit(0);
} catch (err) {
  console.error("backfillWallets failed:", err.message);
  process.exit(1);
}
