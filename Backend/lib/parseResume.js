import { generateJSON } from "../config/ai.js";

export const RESUME_SCHEMA_VERSION = 2;

// Parse a plain-text resume into a structured model we can render deterministically
// and target edits against. Copies text VERBATIM — it must never invent or drop
// content. URLs become {label,url} link objects; skills are grouped; unknown
// sections go into `other` so nothing is lost.
const parse = (resumeText) =>
  generateJSON({
    maxTokens: 7000,
    validate: (o) => o && typeof o === "object" && ("experience" in o || "other" in o || "summary" in o),
    prompt: `Convert this resume into structured JSON. Copy text VERBATIM into the fields — do NOT rewrite, summarize, INVENT, or drop anything. Every line of the resume must appear somewhere in the output.

Return JSON (empty arrays/strings when a part is absent):
{
  "personal": {
    "name": "",
    "email": "",
    "phone": "",
    "location": "",
    "links": [ { "label": "LinkedIn|GitHub|Portfolio|…", "url": "https://…" } ]
  },
  "summary": "the summary/objective paragraph verbatim, or ''",
  "skills": [ { "group": "the category label as written (e.g. Languages, Frameworks, Databases); use 'Skills' if the resume doesn't group them", "items": ["each skill exactly as written"] } ],
  "experience": [
    { "id": "exp_1", "company": "", "role": "", "dates": "", "location": "",
      "tech": "tech-stack line for this role if present, else ''",
      "bullets": [ { "id": "exp_1_b1", "text": "bullet verbatim" } ] }
  ],
  "projects": [
    { "id": "proj_1", "name": "", "meta": "e.g. 'B.Tech Major Project' if present", "dates": "",
      "tech": "the technologies line if present, else ''",
      "links": [ { "label": "Live Demo|Source|View", "url": "https://…" } ],
      "bullets": [ { "id": "proj_1_b1", "text": "verbatim" } ] }
  ],
  "education": [ { "id": "edu_1", "institution": "", "degree": "", "dates": "", "details": "" } ],
  "certifications": [ { "id": "cert_1", "name": "", "issuer": "", "date": "", "link": { "label": "View Certificate", "url": "" } } ],
  "publications": [ { "id": "pub_1", "title": "", "venue": "", "date": "", "link": { "label": "View", "url": "" } } ],
  "other": [ { "id": "other_1", "heading": "SECTION NAME as written", "lines": ["verbatim line"] } ]
}

Rules:
- Verbatim copy only. NEVER invent skills, technologies, concepts, metrics, responsibilities or achievements. If it isn't in the resume, it must not appear.
- Every URL must go into a "url" field (with a short friendly "label"). Never leave a raw URL inside a text/bullet/skill field.
- Group skills by the categories the resume actually uses; if it lists them without groups, put them all in one group named "Skills".
- Put any unrecognized section (Achievements, Languages, Interests, Awards, …) into "other" with its heading and verbatim lines.
- Give every experience/project bullet a unique id like "exp_1_b2".

Resume:
"""
${resumeText}
"""`,
  });

// Keep only skills that actually appear in the source resume (case-insensitive),
// so the parser can never introduce a skill the user didn't list. Drops empty groups.
const guardSkills = (resumeText, skills) => {
  const hay = String(resumeText || "").toLowerCase();
  return (Array.isArray(skills) ? skills : [])
    .map((g) => ({
      group: g?.group || "Skills",
      items: (Array.isArray(g?.items) ? g.items : []).filter(
        (it) => typeof it === "string" && it.trim() && hay.includes(it.trim().toLowerCase())
      ),
    }))
    .filter((g) => g.items.length > 0);
};

export const parseResumeStructured = async (resumeText) => {
  const s = await parse(resumeText);
  s.skills = guardSkills(resumeText, s.skills);
  s.schemaVersion = RESUME_SCHEMA_VERSION;
  return s;
};

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
