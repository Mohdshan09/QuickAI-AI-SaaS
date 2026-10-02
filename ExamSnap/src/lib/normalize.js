// Exam-name normalisation (spec §5): lowercase, replace punctuation/hyphens with spaces, drop
// year tokens and generic words, collapse spaces. Used to group demand and dedupe name variants
// (`ssc cgl`, `SSC-CGL 2026`, `cgl`). MIRRORED server-side in api/_lib/normalize.js — the two
// must stay identical so a client-computed normal form matches the server's.

const STOPWORDS = new Set([
  "exam", "exams", "recruitment", "notification", "notice", "online", "application", "form",
]);

export function normalizeExamName(name) {
  if (!name) return "";
  return String(name)
    .toLowerCase()
    // punctuation, hyphens and underscores → space
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    // standalone 4-digit year tokens (1900–2099)
    .replace(/\b(?:19|20)\d{2}\b/g, " ")
    .split(/\s+/)
    .filter((w) => w && !STOPWORDS.has(w))
    .join(" ")
    .trim();
}
