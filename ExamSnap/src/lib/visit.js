// Fire one visit ping per browser session for the analytics counter. Fire-and-forget: failures
// (offline, no backend in dev) are ignored. The owner's own browser is flagged so it's excluded
// server-side. Sends only the anonymous id — no image or personal data.
import { getAnonId } from "./anonId.js";
import { isAdminBrowser } from "./admin.js";
import { API_BASE } from "./apiClient.js";

const SESSION_KEY = "examsnap:visited";

export function pingVisit() {
  if (typeof window === "undefined") return;
  try {
    if (sessionStorage.getItem(SESSION_KEY)) return; // once per session
    sessionStorage.setItem(SESSION_KEY, "1");
  } catch {
    /* sessionStorage blocked — fall through and still ping once per load */
  }
  try {
    fetch(API_BASE + "visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ anonId: getAnonId(), isAdmin: isAdminBrowser() }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* ignore */
  }
}
