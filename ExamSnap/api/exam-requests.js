// POST /api/exam-requests — record demand for an unlisted exam (spec §7.2). Body: { name,
// anonId, hp? }. Stores only the raw name, its normalised form and the anonymous id. Honeypot
// submissions are silently accepted and dropped.
import { json, readJson, clientIp } from "./_lib/respond.js";
import { checkRateLimit } from "./_lib/rateLimit.js";
import { getSql } from "./_lib/db.js";
import { normalizeExamName } from "./_lib/normalize.js";
import { cap } from "./_lib/validate.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "method not allowed" });

  let body;
  try {
    body = await readJson(req);
  } catch {
    return json(res, 400, { error: "invalid json" });
  }

  if (body.hp) return json(res, 200, { ok: true }); // honeypot — drop silently

  const rawName = cap(body.name, 120);
  const anonId = cap(body.anonId, 64);
  if (!rawName || !rawName.trim() || !anonId) return json(res, 400, { error: "name and anonId required" });

  const normalized = normalizeExamName(rawName);
  if (!normalized) return json(res, 400, { error: "name not usable" });

  if (!(await checkRateLimit(clientIp(req), "exam-requests"))) {
    return json(res, 429, { error: "rate limited" });
  }

  const sql = getSql();
  await sql`
    INSERT INTO exam_requests (raw_name, normalized, anon_id)
    VALUES (${rawName}, ${normalized}, ${anonId})`;

  return json(res, 200, { ok: true });
}
