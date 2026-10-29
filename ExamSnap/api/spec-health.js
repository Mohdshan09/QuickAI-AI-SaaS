// GET /api/spec-health — private aggregate of the signals the app already collects, for the
// spec-admin loop: which specs portals reject, which submitted specs disagree with the shipped
// ones, which exams users ask for, and which specs get thumbs-down. Guarded by MODERATION_KEY
// (same header as comment-moderation) because it exposes user-supplied text and free-text
// portal errors. Read-only; the loop ends with a human editing src/specs/exams/*.json.
import crypto from "node:crypto";
import { json } from "./_lib/respond.js";
import { getSql } from "./_lib/db.js";
import {
  summariseOutcomes,
  mergePortalErrors,
  summariseSubmissions,
  summariseRequests,
  summariseFeedback,
} from "./_lib/specHealth.js";

const WINDOW_DAYS = 90; // echoed to the client; the queries below mirror it as interval '90 days'

function authorised(req) {
  const expected = process.env.MODERATION_KEY || "";
  const supplied = String(req.headers["x-moderation-key"] || "");
  if (!expected || supplied.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
}

export default async function handler(req, res) {
  if (!authorised(req)) return json(res, 401, { error: "unauthorised" });
  if (req.method !== "GET") return json(res, 405, { error: "method not allowed" });

  const sql = getSql();
  // One statement per tagged-template call (the Neon HTTP driver), so run them in parallel.
  const [outcomeRows, errorRows, submissionRows, requestRows, feedbackRows] = await Promise.all([
    sql`
      SELECT normalized, spec_hash, result, COUNT(*)::int AS n, MAX(created_at) AS last_at
      FROM outcomes
      WHERE created_at > now() - interval '90 days'
      GROUP BY normalized, spec_hash, result
      ORDER BY n DESC
      LIMIT 500`,
    sql`
      SELECT normalized, portal_error, COUNT(*)::int AS n, MAX(created_at) AS last_at
      FROM outcomes
      WHERE result = 'rejected' AND coalesce(portal_error, '') <> ''
        AND created_at > now() - interval '90 days'
      GROUP BY normalized, portal_error
      ORDER BY n DESC
      LIMIT 300`,
    sql`
      SELECT normalized, spec_hash, COUNT(*)::int AS n, MAX(created_at) AS last_at,
        (ARRAY_AGG(documents ORDER BY created_at DESC))[1] AS documents,
        (ARRAY_AGG(notification_url ORDER BY created_at DESC))[1] AS notification_url
      FROM spec_submissions
      GROUP BY normalized, spec_hash
      ORDER BY last_at DESC
      LIMIT 200`,
    sql`
      SELECT normalized, COUNT(*)::int AS n, MAX(created_at) AS last_at,
        (ARRAY_AGG(raw_name ORDER BY created_at DESC))[1:3] AS samples
      FROM exam_requests
      GROUP BY normalized
      ORDER BY n DESC
      LIMIT 200`,
    sql`
      SELECT exam_ref, rating, reason, COUNT(*)::int AS n, MAX(created_at) AS last_at
      FROM quality_feedback
      GROUP BY exam_ref, rating, reason
      ORDER BY n DESC
      LIMIT 300`,
  ]);

  const outcomes = mergePortalErrors(summariseOutcomes(outcomeRows), errorRows);

  return json(res, 200, {
    generatedAt: new Date().toISOString(),
    windowDays: WINDOW_DAYS,
    outcomes,
    submissions: summariseSubmissions(submissionRows),
    requests: summariseRequests(requestRows),
    feedback: summariseFeedback(feedbackRows),
  });
}
