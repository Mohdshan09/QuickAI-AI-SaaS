// Server copy of exam-name normalisation. MUST stay identical to src/lib/normalize.js so a
// client-computed normal form matches the server's (used for demand grouping + variant dedupe).

const STOPWORDS = new Set([
  "exam", "exams", "recruitment", "notification", "notice", "online", "application", "form",
]);

export function normalizeExamName(name) {
  if (!name) return "";
  return String(name)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\b(?:19|20)\d{2}\b/g, " ")
    .split(/\s+/)
    .filter((w) => w && !STOPWORDS.has(w))
    .join(" ")
    .trim();
}
