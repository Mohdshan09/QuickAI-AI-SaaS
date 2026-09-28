import sql from "../config/Neon.js";
import { generateJSON } from "../config/ai.js";
import { extractRequirements } from "./Match.js";

const notFound = (res) =>
  res.status(404).json({ success: false, message: "Not found." });

// All maximal digit runs in a string, e.g. "Cut latency 40% over 3 yrs" -> ["40","3"].
const digitRuns = (s) => String(s ?? "").match(/\d+/g) || [];

// Guardrail: a tailored line may only keep numbers that appear in the resume.
// If it introduces any number the resume doesn't have, fall back to the original.
const guardNumbers = (tailored, original, resumeDigits) => {
  const invented = digitRuns(tailored).some((n) => !resumeDigits.has(n));
  return invented
    ? { text: original, kept_original: true }
    : { text: tailored, kept_original: false };
};

const tailorAI = (resumeText, description, keywords) =>
  generateJSON({
    // A full-resume structured rewrite (every section, each bullet as
    // original+tailored+reason) is large; too low a cap truncates the JSON.
    maxTokens: 8000,
    validate: (o) => Array.isArray(o.sections),
    prompt: `Rewrite this resume so it is tailored to the job posting. Improve wording, reorder for relevance and surface experience that is already there — never invent anything.

Return JSON:
{
  "header": "The candidate's name and contact lines, copied VERBATIM from the top of the resume",
  "summary": { "original": "existing summary or ''", "tailored": "rewritten summary (OMIT this field if unchanged)" },
  "sections": [
    { "heading": "Experience — Company / Role (use the resume's own wording)",
      "bullets": [
        { "original": "EXACT bullet copied from the resume",
          "tailored": "rewritten bullet aimed at the job (OMIT if unchanged)",
          "reason": "why, under 12 words (OMIT if unchanged)" }
      ] }
  ],
  "skills": { "original": ["as listed in the resume"], "tailored": ["reordered / job-relevant, only skills the resume supports"] }
}

Rules:
- NEVER invent employers, job titles, dates, degrees, numbers or skills the resume doesn't show. Only rewrite, reorder and bring forward what is already there.
- Use these job keywords ONLY where the resume already supports them: ${keywords.join(", ") || "(none)"}.
- Keep each bullet to at most 2 lines and start it with a strong action verb.
- Keep every "reason" under 12 words.
- "original" fields MUST be copied verbatim from the resume.
- IMPORTANT — keep the response small: for any bullet or summary you DON'T change, output ONLY its "original" field and OMIT "tailored" and "reason" entirely. Only changed items include "tailored" (and "reason").
- Include EVERY content section of the resume (experience, projects, education, etc.), not just the ones you change, so the result is a complete resume.

Resume:
"""
${resumeText}
"""

Job posting:
"""
${description}
"""`,
  });

export const createTailor = async (req, res) => {
  try {
    const { userId } = req.auth();
    const jobId = Number(req.params.id);
    const { resumeId, force } = req.body;

    const [job] = await sql`
      SELECT * FROM jobs WHERE id = ${jobId} AND user_id = ${userId}
    `;
    if (!job) return notFound(res);

    const [resume] = await sql`
      SELECT * FROM resumes WHERE id = ${Number(resumeId)} AND user_id = ${userId}
    `;
    if (!resume) return res.status(400).json({ success: false, message: "Resume not found." });

    // Reuse the saved tailored result for this exact (job, resume) unless the
    // user explicitly asks for a fresh one — same policy as match.
    if (!force) {
      const [existing] = await sql`
        SELECT data, created_at FROM job_outputs
        WHERE job_id = ${jobId} AND resume_id = ${resume.id} AND kind = 'tailored'
        ORDER BY created_at DESC LIMIT 1
      `;
      if (existing) {
        return res.json({
          success: true,
          tailored: existing.data,
          analyzedAt: existing.created_at,
          cached: true,
        });
      }
    }

    // Reuse requirements extracted for the match (keeps the keyword target
    // consistent with the score); fall back to extracting them if none yet.
    const [cached] = await sql`
      SELECT data FROM job_outputs
      WHERE job_id = ${jobId} AND kind = 'match'
      ORDER BY created_at ASC LIMIT 1
    `;
    const requirements =
      cached?.data?.requirements ?? (await extractRequirements(job.description));
    const keywords = (requirements.keywords || []).map((k) => k.term);

    const out = await tailorAI(resume.text, job.description, keywords);

    // Deterministic guardrail + normalize. An omitted/empty "tailored" (or one
    // equal to the original) means the model left the line unchanged.
    const resumeDigits = new Set(digitRuns(resume.text));
    const norm = (originalRaw, tailoredRaw, reasonRaw) => {
      const original = originalRaw ?? "";
      const t = (tailoredRaw ?? "").trim();
      if (!t || t === original.trim()) {
        return { original, tailored: original, reason: "", kept_original: false };
      }
      const g = guardNumbers(t, original, resumeDigits);
      return {
        original,
        tailored: g.text,
        reason: g.kept_original ? "" : reasonRaw ?? "",
        kept_original: g.kept_original,
      };
    };

    const s = norm(out.summary?.original, out.summary?.tailored, "");
    const summary = { original: s.original, tailored: s.tailored, kept_original: s.kept_original };
    const sections = (out.sections || []).map((sec) => ({
      heading: sec.heading || "",
      bullets: (sec.bullets || []).map((b) => norm(b.original, b.tailored, b.reason)),
    }));
    const skills = {
      original: Array.isArray(out.skills?.original) ? out.skills.original : [],
      tailored: Array.isArray(out.skills?.tailored) ? out.skills.tailored : [],
    };

    const data = {
      header: out.header || "",
      summary,
      sections,
      skills,
      accepted: {}, // empty = everything accepted by default
    };

    const [inserted] = await sql`
      INSERT INTO job_outputs (job_id, resume_id, user_id, kind, data)
      VALUES (${jobId}, ${resume.id}, ${userId}, 'tailored', ${data})
      RETURNING created_at
    `;

    res.json({ success: true, tailored: data, analyzedAt: inserted.created_at, cached: false });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Read the saved tailored result for a (job, resume) pair — no AI, no limit.
export const getTailor = async (req, res) => {
  try {
    const { userId } = req.auth();
    const jobId = Number(req.params.id);
    const resumeId = Number(req.query.resumeId);

    const [job] = await sql`
      SELECT id FROM jobs WHERE id = ${jobId} AND user_id = ${userId}
    `;
    if (!job) return notFound(res);

    let tailored = null;
    let analyzedAt = null;
    if (Number.isInteger(resumeId) && resumeId > 0) {
      const [row] = await sql`
        SELECT data, created_at FROM job_outputs
        WHERE job_id = ${jobId} AND resume_id = ${resumeId} AND kind = 'tailored' AND user_id = ${userId}
        ORDER BY created_at DESC LIMIT 1
      `;
      tailored = row?.data ?? null;
      analyzedAt = row?.created_at ?? null;
    }

    res.json({ success: true, tailored, analyzedAt });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Toggle one bullet's accept/reject, stored in the tailored output's data.accepted.
export const setTailorAccept = async (req, res) => {
  try {
    const { userId } = req.auth();
    const jobId = Number(req.params.id);
    const { resumeId, key, accepted } = req.body;

    if (typeof key !== "string" || key.length === 0 || key.length > 120)
      return res.status(400).json({ success: false, message: "Invalid change key." });

    const [row] = await sql`
      SELECT id, data FROM job_outputs
      WHERE job_id = ${jobId} AND resume_id = ${Number(resumeId)}
        AND kind = 'tailored' AND user_id = ${userId}
      ORDER BY created_at DESC LIMIT 1
    `;
    if (!row) return notFound(res);

    const nextAccepted = { ...(row.data.accepted || {}), [key]: !!accepted };
    const merged = { ...row.data, accepted: nextAccepted };
    await sql`UPDATE job_outputs SET data = ${merged} WHERE id = ${row.id}`;

    res.json({ success: true, accepted: nextAccepted });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};
