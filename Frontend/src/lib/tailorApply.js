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
