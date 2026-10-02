// GET /api/analytics — aggregate visit counts for the owner's analytics page. Returns only
// numbers (no identifiers), and excludes visits flagged is_admin so the owner's own visits
// don't inflate the count.
import { json } from "./_lib/respond.js";
import { getSql } from "./_lib/db.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return json(res, 405, { error: "method not allowed" });

  const sql = getSql();
  const users = await sql`SELECT count(DISTINCT anon_id)::int AS n FROM visits WHERE is_admin = false`;
  const visits = await sql`SELECT count(*)::int AS n FROM visits WHERE is_admin = false`;
  const today = await sql`
    SELECT count(DISTINCT anon_id)::int AS n
    FROM visits
    WHERE is_admin = false AND created_at::date = (now() AT TIME ZONE 'UTC')::date`;

  return json(res, 200, {
    totalUsers: users[0].n,
    totalVisits: visits[0].n,
    todayUsers: today[0].n,
  });
}
