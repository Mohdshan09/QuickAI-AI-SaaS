// POST /api/spec-submissions — record a user-entered spec for an unlisted exam (spec §7.2).
// Body: { examName, documents[], notificationUrl?, anonId, hp? }. The server re-derives the
// spec_hash from the submitted documents (never trusting a client-supplied hash).
import { json, readJson, clientIp } from "./_lib/respond.js";
import { checkRateLimit } from "./_lib/rateLimit.js";
import { getSql } from "./_lib/db.js";
import { normalizeExamName } from "./_lib/normalize.js";
import { specHash } from "./_lib/specHash.js";
import { validateSpecDocuments, validateNotificationUrl, cap } from "./_lib/validate.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "method not allowed" });

  let body;
  try {
    body = await readJson(req);
  } catch {
    return json(res, 400, { error: "invalid json" });
  }

  if (body.hp) return json(res, 200, { ok: true }); // honeypot

  const examName = cap(body.examName, 120);
  const anonId = cap(body.anonId, 64);
  if (!examName || !examName.trim() || !anonId) return json(res, 400, { error: "examName and anonId required" });

  const docErr = validateSpecDocuments(body.documents);
  if (docErr) return json(res, 400, { error: docErr });

  const urlErr = validateNotificationUrl(body.notificationUrl);
  if (urlErr) return json(res, 400, { error: urlErr });

  const normalized = normalizeExamName(examName);
  if (!normalized) return json(res, 400, { error: "examName not usable" });

  // Store a minimal, canonical document set (no extra client fields).
  const documents = body.documents.map((d) => ({
    type: String(d.type),
    width: d.width ?? null,
    height: d.height ?? null,
    minKb: Number(d.minKb) || 0,
    maxKb: Number.isFinite(d.maxKb) ? Number(d.maxKb) : null,
  }));
  const hash = specHash(documents);

  if (!(await checkRateLimit(clientIp(req), "spec-submissions"))) {
    return json(res, 429, { error: "rate limited" });
  }

  const sql = getSql();
  await sql`
    INSERT INTO spec_submissions (normalized, documents, spec_hash, notification_url, anon_id)
    VALUES (${normalized}, ${JSON.stringify(documents)}, ${hash}, ${body.notificationUrl || null}, ${anonId})`;

  return json(res, 200, { ok: true, specHash: hash });
}
