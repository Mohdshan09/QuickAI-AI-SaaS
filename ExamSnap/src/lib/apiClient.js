// Same-origin API client. Requests go to the Vite base + "api/" — "/api/" when the app is a
// domain root, "/examsnap/api/" when it is mounted in a subfolder (see scripts/site.mjs) —
// keeping every request same-origin (CSP connect-src 'self').

export const API_BASE = `${import.meta.env.BASE_URL || "/"}api/`;

export async function postJson(endpoint, body) {
  const res = await fetch(API_BASE + endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API ${endpoint} failed: ${res.status}`);
  return res.json().catch(() => ({}));
}

/** Fetch JSON from an ExamSnap API endpoint. */
export async function getJson(endpoint) {
  const res = await fetch(API_BASE + endpoint);
  if (!res.ok) throw new Error(`API ${endpoint} failed: ${res.status}`);
  return res.json().catch(() => ({}));
}
