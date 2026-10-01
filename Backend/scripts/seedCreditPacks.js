// Seed/sync the credit-pack catalog from config into the database (spec §5-6).
// Idempotent — safe to re-run after changing config/creditPacks.js; it upserts so pack
// pricing/credits stay in sync with the config, the single source of truth. Run after
// migrations.
//
// Usage: node scripts/seedCreditPacks.js   (or: npm run seed:packs)
import "dotenv/config";
import crypto from "crypto";
import sql from "../config/Neon.js";
import { CREDIT_PACKS } from "../config/creditPacks.js";

let count = 0;
try {
  for (const pack of Object.values(CREDIT_PACKS)) {
    await sql`
      INSERT INTO credit_packs (
        id, key, name, description, credits, price, currency, is_active, created_at, updated_at
      )
      VALUES (
        ${crypto.randomUUID()}, ${pack.key}, ${pack.name}, ${pack.description ?? null},
        ${pack.credits}, ${pack.price}, ${pack.currency ?? "INR"}, ${pack.isActive ?? true},
        NOW(), NOW()
      )
      ON CONFLICT (key) DO UPDATE
        SET name        = EXCLUDED.name,
            description = EXCLUDED.description,
            credits     = EXCLUDED.credits,
            price       = EXCLUDED.price,
            currency    = EXCLUDED.currency,
            is_active   = EXCLUDED.is_active,
            updated_at  = NOW()
    `;
    count += 1;
  }
  console.log(`Done. Seeded ${count} credit pack(s).`);
  process.exit(0);
} catch (err) {
  console.error("seedCreditPacks failed:", err.message);
  process.exit(1);
}
