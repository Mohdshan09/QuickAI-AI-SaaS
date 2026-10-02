// Anonymous ID (spec §7.4): a random UUID generated on first visit and kept in localStorage.
// Used ONLY to count distinct submitters for promotion rules — never linked to an account, IP,
// name or device. Resettable by clearing site data. If storage is blocked we return an
// ephemeral id so submissions still work (it just counts as a one-off submitter).

const KEY = "examsnap:anon";

function uuid() {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  } catch {
    /* fall through */
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function getAnonId() {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = uuid();
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return uuid();
  }
}
