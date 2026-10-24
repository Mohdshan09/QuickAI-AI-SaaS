// Private moderation API. Set MODERATION_KEY in Vercel; it is never bundled into the client.
import crypto from "node:crypto";
import { json, readJson } from "./_lib/respond.js";
import { getSql } from "./_lib/db.js";
import { cap } from "./_lib/validate.js";

function authorised(req) {
  const expected = process.env.MODERATION_KEY || "";
  const supplied = String(req.headers["x-moderation-key"] || "");
  if (!expected || supplied.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
}

export default async function handler(req, res) {
  if (!authorised(req)) return json(res, 401, { error: "unauthorised" });
  const sql = getSql();
  if (req.method === "GET") {
    const rows = await sql`
      SELECT c.id, c.exam_ref, c.alias, c.body, c.status, c.created_at,
        COUNT(r.id)::int AS reports, MAX(r.created_at) AS last_reported_at
      FROM exam_comments c JOIN comment_reports r ON r.comment_id = c.id
      GROUP BY c.id
      ORDER BY c.status = 'published' DESC, last_reported_at DESC
      LIMIT 100`;
    return json(res, 200, { comments: rows.map((row) => ({ ...row, id: Number(row.id), reports: Number(row.reports) || 0 })) });
  }
  if (req.method !== "POST") return json(res, 405, { error: "method not allowed" });
  let data;
  try { data = await readJson(req); } catch { return json(res, 400, { error: "invalid json" }); }
  const id = Number(data.commentId);
  const action = cap(data.action, 10);
  if (!Number.isSafeInteger(id) || id < 1 || !["hide", "restore"].includes(action)) return json(res, 400, { error: "invalid request" });
  const status = action === "hide" ? "hidden" : "published";
  const rows = await sql`UPDATE exam_comments SET status = ${status} WHERE id = ${id} RETURNING id, status`;
  if (!rows.length) return json(res, 404, { error: "comment not found" });
  return json(res, 200, { ok: true, status });
}
