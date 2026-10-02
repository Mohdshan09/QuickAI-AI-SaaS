// POST /api/admin-login — lightweight admin check for the analytics page. Body: { email }.
// Compares against ADMIN_EMAIL (env, defaulting to the owner's address). This is a simple gate,
// NOT real authentication — it just flags the owner's own browser so their visits are excluded
// and they can see the counter. The admin email is kept server-side (never shipped in the bundle).
import { json, readJson } from "./_lib/respond.js";
import { cap } from "./_lib/validate.js";

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "mohdshan1024@gmail.com").trim().toLowerCase();

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "method not allowed" });

  let body;
  try {
    body = await readJson(req);
  } catch {
    return json(res, 400, { error: "invalid json" });
  }

  const email = cap(body.email, 200);
  const ok = Boolean(email) && email.trim().toLowerCase() === ADMIN_EMAIL;
  return json(res, ok ? 200 : 401, { ok });
}
