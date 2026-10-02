// Marks THIS browser as the owner's, after a successful /api/admin-login. Used to (a) exclude the
// owner's own visits from the analytics counter and (b) keep the analytics page unlocked. Not
// security — just a local flag; the real check is the server comparing the email.

const KEY = "examsnap:isAdmin";

export function isAdminBrowser() {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function setAdminBrowser(on) {
  try {
    if (on) localStorage.setItem(KEY, "1");
    else localStorage.removeItem(KEY);
  } catch {
    /* storage blocked — ignore */
  }
}
