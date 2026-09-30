// One-time backfill: mirror all existing Clerk users into the local `users`
// table. Safe to re-run (idempotent upsert). Plan is left to the live auth
// middleware to correct on each user's next request, so this script never
// overwrites plan (upsertUser called without a plan preserves the existing one).
//
// Usage: node scripts/backfillUsers.js   (or: npm run backfill:users)
import "dotenv/config";
import { clerkClient } from "@clerk/express";
import { fromClerkUser, upsertUser } from "../lib/userSync.js";

const PAGE = 100;

let offset = 0;
let total = 0;
try {
  for (;;) {
    const { data } = await clerkClient.users.getUserList({ limit: PAGE, offset });
    if (!data.length) break;
    for (const u of data) {
      await upsertUser(fromClerkUser(u)); // no plan -> preserved / defaults to 'free'
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
