// Public, alias-based discussion for a specific exam. No accounts, images, contact details,
// or HTML are accepted. The client renders body text (React escapes it by default).
import { json, readJson, clientIp } from "./_lib/respond.js";
import { checkRateLimit } from "./_lib/rateLimit.js";
import { getSql } from "./_lib/db.js";
import { cap, validateComment } from "./_lib/validate.js";

function publicComment(row) {
  return { id: Number(row.id), alias: row.alias, body: row.body, parentId: row.parent_id == null ? null : Number(row.parent_id), createdAt: row.created_at };
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    const examRef = cap(req.query?.examRef, 120)?.trim();
    if (!examRef) return json(res, 400, { error: "examRef required" });
    const sql = getSql();
    const rows = await sql`
      SELECT id, alias, body, parent_id, created_at FROM exam_comments
      WHERE exam_ref = ${examRef} AND status = 'published'
      ORDER BY created_at ASC LIMIT 100`;
    return json(res, 200, { comments: rows.map(publicComment) });
  }
  if (req.method !== "POST") return json(res, 405, { error: "method not allowed" });
  let data;
  try { data = await readJson(req); } catch { return json(res, 400, { error: "invalid json" }); }
  if (data.hp) return json(res, 200, { ok: true });

  if (data.action === "report") {
    const commentId = Number(data.commentId);
    const anonId = cap(data.anonId, 64);
    const reason = cap(data.reason, 20);
    if (!Number.isSafeInteger(commentId) || commentId < 1 || !anonId || !["spam", "harmful", "misleading", "other"].includes(reason)) return json(res, 400, { error: "invalid report" });
    if (!(await checkRateLimit(clientIp(req), "comment-reports"))) return json(res, 429, { error: "rate limited" });
    const sql = getSql();
    const reported = await sql`INSERT INTO comment_reports (comment_id, reporter_anon_id, reason) VALUES (${commentId}, ${anonId}, ${reason}) ON CONFLICT (comment_id, reporter_anon_id) DO NOTHING RETURNING id`;
    const count = await sql`SELECT COUNT(*)::int AS n FROM comment_reports WHERE comment_id = ${commentId}`;
    const reports = Number(count[0]?.n) || 0;
    if (reports >= 3) await sql`UPDATE exam_comments SET status = 'hidden' WHERE id = ${commentId}`;
    return json(res, 200, { ok: true, alreadyReported: !reported.length, hidden: reports >= 3 });
  }

  const examRef = cap(data.examRef, 120)?.trim();
  const alias = cap(data.alias, 32)?.trim();
  const body = cap(data.body, 1000)?.trim();
  const anonId = cap(data.anonId, 64);
  const parentId = data.parentId == null ? null : Number(data.parentId);
  if (!examRef || !anonId) return json(res, 400, { error: "examRef and anonId required" });
  const validationError = validateComment(alias, body);
  if (validationError) return json(res, 400, { error: validationError });
  if (parentId != null && (!Number.isSafeInteger(parentId) || parentId < 1)) return json(res, 400, { error: "invalid reply" });
  if (!(await checkRateLimit(clientIp(req), "comments"))) return json(res, 429, { error: "rate limited" });

  const sql = getSql();
  if (parentId != null) {
    const parent = await sql`SELECT id FROM exam_comments WHERE id = ${parentId} AND exam_ref = ${examRef} AND status = 'published'`;
    if (!parent.length) return json(res, 400, { error: "reply target no longer exists" });
  }
  const rows = await sql`
    INSERT INTO exam_comments (exam_ref, alias, body, parent_id, anon_id)
    VALUES (${examRef}, ${alias}, ${body}, ${parentId}, ${anonId})
    RETURNING id, alias, body, parent_id, created_at`;
  return json(res, 201, { comment: publicComment(rows[0]) });
}
