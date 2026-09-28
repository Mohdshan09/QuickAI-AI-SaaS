import { generateJSON } from "../config/ai.js";

// Parse a plain-text resume into a structured model we can render deterministically
// and target edits against. Copies text VERBATIM — it must never invent or drop
// content. Unknown sections go into `other` so nothing is lost.
export const parseResumeStructured = (resumeText) =>
  generateJSON({
    maxTokens: 6000,
    validate: (o) => o && typeof o === "object" && ("experience" in o || "other" in o || "summary" in o),
    prompt: `Convert this resume into structured JSON. Copy the text VERBATIM into the fields — do NOT rewrite, summarize, invent, or drop anything. Every line of the resume must appear somewhere in the output.

Return JSON (use empty arrays/strings when a part is absent):
{
  "personal": { "name": "", "contact": "one line: email · phone · location · links, copied verbatim" },
  "summary": "the summary/objective paragraph, verbatim, or ''",
  "skills": ["each skill exactly as written"],
  "experience": [
    { "id": "exp_1", "company": "", "role": "", "dates": "",
      "bullets": [ { "id": "exp_1_b1", "text": "bullet copied verbatim" } ] }
  ],
  "projects": [
    { "id": "proj_1", "name": "", "dates": "",
      "bullets": [ { "id": "proj_1_b1", "text": "verbatim" } ] }
  ],
  "education": [ { "id": "edu_1", "text": "the education entry, verbatim (degree, school, dates)" } ],
  "certifications": [ { "id": "cert_1", "text": "verbatim, including any URL/date" } ],
  "other": [ { "id": "other_1", "heading": "SECTION NAME as written", "lines": ["verbatim line", "..."] } ]
}

Rules:
- Verbatim copy only. No paraphrasing, no new content, no omissions.
- Put any section that doesn't fit the named buckets (e.g. Achievements, Publications, Interests, Languages) into "other" with its heading and lines.
- Give every experience/project bullet a unique id like "exp_1_b2".

Resume:
"""
${resumeText}
"""`,
  });

// Rough completeness guard: how much of the resume's word content survived the parse.
// Lets the caller fall back to plain-text rendering if the parser dropped too much.
export const structuredCoverage = (resumeText, structured) => {
  const collect = (v, acc) => {
    if (!v) return acc;
    if (typeof v === "string") acc.push(v);
    else if (Array.isArray(v)) v.forEach((x) => collect(x, acc));
    else if (typeof v === "object") Object.values(v).forEach((x) => collect(x, acc));
    return acc;
  };
  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const outWords = new Set(norm(collect(structured, []).join(" ")).split(" ").filter(Boolean));
  const inWords = norm(resumeText).split(" ").filter(Boolean);
  if (inWords.length === 0) return 1;
  const hit = inWords.filter((w) => outWords.has(w)).length;
  return hit / inWords.length;
};
