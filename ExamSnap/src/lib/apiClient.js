// Same-origin API client. The app is served under /examsnap/ and reaches the Vercel functions
// via the proxy rewrite /examsnap/api/* → /api/* (ExamSnap vercel.json). So the base is the
// Vite BASE_URL ("/examsnap/") + "api/", keeping every request same-origin (CSP connect-src 'self').

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
