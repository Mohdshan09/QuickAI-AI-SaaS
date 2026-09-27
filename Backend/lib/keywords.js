// Deterministic keyword matching for the resume/job match score.
// Whole-word matching that keeps +, # and . that are part of a term
// (so "C++", "C#" and "Node.js" work) but does not let "Java" match
// inside "JavaScript".

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// A term matches when it is not flanked by another alphanumeric character.
const hasTerm = (haystackLower, term) => {
  const t = term.trim().toLowerCase();
  if (!t) return false;
  const re = new RegExp(`(?<![a-z0-9])${escapeRegex(t)}(?![a-z0-9])`, "i");
  return re.test(haystackLower);
};

/**
 * @param {string} resumeText
 * @param {Array<{term:string, aliases?:string[], importance?:string}>} keywords
 * @returns {{ matched: object[], missing: object[] }}
 */
export const matchKeywords = (resumeText, keywords) => {
  const hay = (resumeText || "").toLowerCase();
  const matched = [];
  const missing = [];
  for (const kw of keywords) {
    const forms = [kw.term, ...(kw.aliases || [])];
    const found = forms.some((f) => hasTerm(hay, f));
    (found ? matched : missing).push(kw);
  }
  return { matched, missing };
};

// Share of a keyword group found (0..1). Empty group counts as fully covered.
export const coverage = (matched, missing) => {
  const total = matched.length + missing.length;
  return total === 0 ? 1 : matched.length / total;
};
