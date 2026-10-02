// POST /api/visit — record one visit for the simple analytics counter. Body: { anonId, isAdmin }.
// Not rate-limited on purpose: many real users share one IP (college/office NAT), so limiting by
// IP would undercount. The client fires this at most once per browser session. Only the anonymous
// id and an is_admin flag are stored — no image or personal data.
import { json, readJson } from "./_lib/respond.js";
import { getSql } from "./_lib/db.js";
import { cap } from "./_lib/validate.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "method not allowed" });

  let body;
  try {
    body = await readJson(req);
  } catch {
    return json(res, 400, { error: "invalid json" });
  }

  const anonId = cap(body.anonId, 64);
  if (!anonId) return json(res, 400, { error: "anonId required" });
  const isAdmin = body.isAdmin === true;

  const sql = getSql();
  await sql`INSERT INTO visits (anon_id, is_admin) VALUES (${anonId}, ${isAdmin})`;

  return json(res, 200, { ok: true });
}
