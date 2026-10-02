// Server-side input validation (spec §7.5). Pure functions → node-testable. Reject bad input
// before any DB write: dimensions 50–3000 px, KB 1–5000 (min may be 0 = no minimum), minKb ≤
// maxKb, text length caps, and notification URLs must be https.

function inRange(v, lo, hi) {
  return typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi;
}

/** @returns {string|null} an error message, or null if the document set is valid. */
export function validateSpecDocuments(documents) {
  if (!Array.isArray(documents) || documents.length === 0) return "documents required";
  if (documents.length > 10) return "too many documents";
  for (const d of documents) {
    if (!d || typeof d.type !== "string" || d.type.length > 40) return "invalid document type";
    if (d.width != null && !inRange(d.width, 50, 3000)) return "width out of range (50–3000px)";
    if (d.height != null && !inRange(d.height, 50, 3000)) return "height out of range (50–3000px)";
    const min = d.minKb ?? 0;
    const max = d.maxKb;
    if (!inRange(min, 0, 5000)) return "minKb out of range (0–5000)";
    if (max != null && !inRange(max, 1, 5000)) return "maxKb out of range (1–5000)";
    if (max != null && min > max) return "minKb greater than maxKb";
  }
  return null;
}

export function validateNotificationUrl(url) {
  if (url == null || url === "") return null;
  if (typeof url !== "string" || url.length > 500) return "notificationUrl too long";
  if (!/^https:\/\//i.test(url)) return "notificationUrl must be https";
  return null;
}

export function cap(str, n) {
  return str == null ? null : String(str).slice(0, n);
}
