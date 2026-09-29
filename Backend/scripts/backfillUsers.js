// One-time backfill: mirror all existing Clerk users into the local `users`
// table. Safe to re-run (upsert). Plan is left to the live auth middleware to
// correct on each user's next request, so this script never overwrites plan.
//
// Usage: node scripts/backfillUsers.js   (or: npm run backfill:users)
import "dotenv/config";
import { clerkClient } from "@clerk/express";
import sql from "../config/Neon.js";

const PAGE = 100;

const primaryEmail = (u) =>
  u.emailAddresses?.find((e) => e.id === u.primaryEmailAddressId)?.emailAddress ||
  u.emailAddresses?.[0]?.emailAddress ||
  null;

const upsert = (u) =>
  sql`
    INSERT INTO users (
      id, email, first_name, last_name, image_url, plan, admin_role,
      clerk_created_at, last_active_at, synced_at
    ) VALUES (
      ${u.id}, ${primaryEmail(u)}, ${u.firstName ?? null}, ${u.lastName ?? null},
      ${u.imageUrl ?? null}, 'free', ${u.publicMetadata?.role ?? null},
      ${u.createdAt ? new Date(u.createdAt) : null}, NULL, NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      email       = EXCLUDED.email,
      first_name  = EXCLUDED.first_name,
      last_name   = EXCLUDED.last_name,
      image_url   = EXCLUDED.image_url,
      admin_role  = EXCLUDED.admin_role,
      clerk_created_at = EXCLUDED.clerk_created_at,
      synced_at   = NOW()
  `;

let offset = 0;
let total = 0;
try {
  for (;;) {
    const { data } = await clerkClient.users.getUserList({ limit: PAGE, offset });
    if (!data.length) break;
    for (const u of data) {
      await upsert(u);
      total += 1;
    }
    console.log(`Backfilled ${total} users...`);
    if (data.length < PAGE) break;
    offset += PAGE;
  }
  console.log(`Done. Mirrored ${total} users.`);
  process.exit(0);
} catch (err) {
  console.error("backfillUsers failed:", err.message);
  process.exit(1);
}
