// Build the tailored resume by applying ACCEPTED edits onto the full original
// resume text. We start from the complete resume and only swap in accepted
// rewrites (first exact occurrence of each), so nothing is ever dropped.
export function applyTailored(data, accepted = {}) {
  let text = data?.resumeText || "";
  for (const c of data?.changes || []) {
    if (accepted[c.id] === false) continue; // rejected → keep original
    const idx = text.indexOf(c.original);
    if (idx !== -1) {
      text = text.slice(0, idx) + c.tailored + text.slice(idx + c.original.length);
    }
  }
  return text;
}

export const acceptedCount = (data, accepted = {}) =>
  (data?.changes || []).filter((c) => accepted[c.id] !== false).length;

// Apply accepted edits onto the structured resume model (for the deterministic
// renderer). Edits match by verbatim text, since the parser copies text as-is.
export function applyToStructured(structured, changes = [], accepted = {}) {
  if (!structured) return null;
  const s = JSON.parse(JSON.stringify(structured));
  const map = new Map(
    (changes || [])
      .filter((c) => accepted[c.id] !== false && c.original)
      .map((c) => [c.original.trim(), c.tailored])
  );
  const rep = (t) => (t && map.has(String(t).trim()) ? map.get(String(t).trim()) : t);

  if (typeof s.summary === "string") s.summary = rep(s.summary);
  (s.experience || []).forEach((e) => (e.bullets || []).forEach((b) => (b.text = rep(b.text))));
  (s.projects || []).forEach((p) => (p.bullets || []).forEach((b) => (b.text = rep(b.text))));
  (s.education || []).forEach((e) => {
    if (typeof e.text === "string") e.text = rep(e.text); // legacy shape
    if (typeof e.details === "string") e.details = rep(e.details);
  });
  (s.certifications || []).forEach((c) => {
    if (typeof c.text === "string") c.text = rep(c.text); // legacy shape
  });
  (s.other || []).forEach((o) => (o.lines = (o.lines || []).map(rep)));
  // Grouped skills: replace matching items (rarely edited, but keep consistent).
  (s.skills || []).forEach((g) => {
    if (Array.isArray(g.items)) g.items = g.items.map(rep);
  });
  return s;
}
