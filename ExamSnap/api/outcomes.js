// POST /api/outcomes — record whether a portal accepted or rejected the files (spec §7.2/§8).
// Body: { examRef, examName?, specHash, result, documentType?, portalError?, anonId, hp? }.
// A spec_hash is required: outcomes are tied to a spec the user actually processed (recorded
// locally at download, §7.5). The portal error is capped at 300 chars.
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

  if (body.hp) return json(res, 200, { ok: true }); // honeypot

  const anonId = cap(body.anonId, 64);
  const result = body.result;
  const specHash = cap(body.specHash, 64);
  if (!anonId) return json(res, 400, { error: "anonId required" });
  if (result !== "accepted" && result !== "rejected") return json(res, 400, { error: "result must be accepted|rejected" });
  if (!specHash) return json(res, 400, { error: "specHash required" });

  // examRef may be a listed exam id or a normalised name; derive a stored normalised form.
  const normalized = normalizeExamName(body.examName || body.examRef || "");
  if (!normalized) return json(res, 400, { error: "examRef or examName required" });

  const documentType = cap(body.documentType, 40);
  const portalError = cap(body.portalError, 300);

  if (!(await checkRateLimit(clientIp(req), "outcomes"))) {
    return json(res, 429, { error: "rate limited" });
  }

  const sql = getSql();
  await sql`
    INSERT INTO outcomes (normalized, spec_hash, result, document_type, portal_error, anon_id)
    VALUES (${normalized}, ${specHash}, ${result}, ${documentType}, ${portalError}, ${anonId})`;

  return json(res, 200, { ok: true });
}
