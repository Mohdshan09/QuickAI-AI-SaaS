// POST /api/quality-feedback — 👍/👎 at download (spec §8.1). Body: { examRef, documentType,
// rating (±1), reason?, anonId, hp? }. `reason` is an optional short tag for a thumbs-down.
import { json, readJson, clientIp } from "./_lib/respond.js";
import { checkRateLimit } from "./_lib/rateLimit.js";
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

  if (body.hp) return json(res, 200, { ok: true }); // honeypot

  const examRef = cap(body.examRef, 120);
  const documentType = cap(body.documentType, 40);
  const anonId = cap(body.anonId, 64);
  const rating = Number(body.rating);
  const reason = cap(body.reason, 40);
  if (!examRef || !documentType || !anonId) return json(res, 400, { error: "examRef, documentType, anonId required" });
  if (rating !== 1 && rating !== -1) return json(res, 400, { error: "rating must be 1 or -1" });

  if (!(await checkRateLimit(clientIp(req), "quality-feedback"))) {
    return json(res, 429, { error: "rate limited" });
  }

  const sql = getSql();
  await sql`
    INSERT INTO quality_feedback (exam_ref, document_type, rating, reason, anon_id)
    VALUES (${examRef}, ${documentType}, ${rating}, ${reason}, ${anonId})`;

  return json(res, 200, { ok: true });
}
