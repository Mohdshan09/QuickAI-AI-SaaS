import sql from "../config/Neon.js";
import { generateJSON } from "../config/ai.js";
import { extractRequirements } from "./Match.js";
import { parseResumeStructured, structuredCoverage } from "../lib/parseResume.js";

// Parse a resume into structured JSON once and cache it on the row. Returns null
// (so the UI falls back to plain-text rendering) if parsing fails or drops too
// much content — we never risk showing an incomplete resume.
const ensureStructured = async (resume) => {
  if (resume.structured) return resume.structured;
  try {
    const parsed = await parseResumeStructured(resume.text);
    if (structuredCoverage(resume.text, parsed) < 0.6) return null;
    await sql`UPDATE resumes SET structured = ${parsed} WHERE id = ${resume.id}`;
    return parsed;
  } catch (e) {
    console.error("resume parse failed:", e.message);
    return null;
  }
};

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

// The model suggests SMALL EDITS to the EXISTING resume — it does not rewrite or
// restructure it. Each edit's "original" is a verbatim substring we can find and
// replace, so the exported resume stays complete and keeps every section.
const tailorAI = (resumeText, description, keywords) =>
  generateJSON({
    maxTokens: 3000,
    validate: (o) => Array.isArray(o.changes),
    prompt: `Tailor this resume to the job by suggesting a small set of targeted EDITS to the EXISTING resume. Do NOT rewrite or restructure the whole resume. Keep everything else exactly as it is.

Return JSON:
{
  "changes": [
    { "original": "EXACT text copied verbatim from the resume — a whole bullet line, the summary sentence(s), a role title line, or the skills line",
      "tailored": "the improved version: same facts, better aligned to the job",
      "reason": "why, under 12 words" }
  ]
}

Rules:
- Each "original" MUST be an exact, contiguous, verbatim copy of text from the resume (so it can be found and replaced). Copy it character-for-character.
- Edits may target: bullet lines, the summary, a role/title line, or the skills line (e.g. add a job keyword the resume already supports to the existing skills list).
- NEVER invent employers, titles, dates, numbers, degrees, or skills the resume doesn't show. Only rephrase/strengthen what is already there and surface supported keywords.
- Prefer these job keywords where the resume supports them: ${keywords.join(", ") || "(none)"}.
- Keep each edited line about the same length (bullets ≤ 2 lines), starting with a strong verb.
- Return at most 12 changes — the highest-impact ones. Do NOT include lines you aren't changing.

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

    // Keep only real, applicable edits: the "original" must be a verbatim
    // substring of the resume (so we can find & replace it and never show a
    // fabricated quote), and the tailored text must not invent numbers.
    const resumeDigits = new Set(digitRuns(resume.text));
    const seen = new Set();
    const changes = [];
    for (const c of out.changes || []) {
      if (!c || typeof c.original !== "string" || typeof c.tailored !== "string") continue;
      const original = c.original;
      if (!resume.text.includes(original)) continue; // must be verbatim & findable
      const tailored = c.tailored.trim();
      if (!tailored || tailored === original.trim()) continue; // no-op
      if (seen.has(original)) continue; // one edit per original
      seen.add(original);
      const g = guardNumbers(tailored, original, resumeDigits);
      changes.push({
        id: String(changes.length),
        original,
        tailored: g.text,
        reason: g.kept_original ? "" : c.reason ?? "",
        kept_original: g.kept_original,
      });
      if (changes.length >= 12) break;
    }

    // Structured form for the deterministic renderer (parsed once, cached).
    const structured = await ensureStructured(resume);

    const data = {
      resumeText: resume.text, // the full, untouched resume — the base we edit
      structured, // parsed model for pro rendering (null → plain-text fallback)
      changes,
      accepted: {}, // empty = every change accepted by default
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
