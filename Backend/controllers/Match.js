import sql from "../config/Neon.js";
import { generateJSON } from "../config/ai.js";
import { SERVICES } from "../config/aiServices.js";
import { matchKeywords, coverage } from "../lib/keywords.js";

// weights must sum to 1
const WEIGHTS = { required: 0.45, nice: 0.15, experience: 0.2, relevance: 0.2 };
const rating = (n) => Math.max(0, Math.min(4, Number(n) || 0)) * 25; // 0..4 -> 0..100

const notFound = (res) =>
  res.status(404).json({ success: false, message: "Not found." });

// Score history for a job (oldest first) — one point per stored match.
const historyFor = (jobId) => sql`
  SELECT (data->>'score')::int AS score, created_at
  FROM job_outputs WHERE job_id = ${jobId} AND kind = 'match'
  ORDER BY created_at ASC
`;

// --- AI call 1: pull the requirements out of the posting (cached per job) ---
export const extractRequirements = (description, track = {}) =>
  generateJSON({
    service: SERVICES.JD_ANALYSIS,
    userId: track.userId,
    meta: { jobId: track.jobId },
    maxTokens: 1500,
    validate: (o) => Array.isArray(o.keywords),
    prompt: `Extract the concrete requirements from this job posting.

Return JSON:
{
  "role_level": "junior" | "mid" | "senior" | "lead",
  "keywords": [
    { "term": "React", "aliases": ["react.js","reactjs"], "importance": "required" | "nice" }
  ]
}

Rules:
- Only skills, tools, technologies, certifications and domain terms that appear in or are clearly required by the posting.
- No soft skills ("team player", "communication").
- "aliases" are common spellings/abbreviations of the term (lowercase). Include an empty array if none.
- "importance": "required" if the posting treats it as a must-have, otherwise "nice".
- At most 25 keywords, most important first.

Job posting:
"""
${description}
"""`,
  });

// --- AI call 2: judge the resume against the posting -----------------------
const judgeResume = (resumeText, description, track = {}) =>
  generateJSON({
    service: SERVICES.MATCH_ANALYSIS,
    userId: track.userId,
    meta: { jobId: track.jobId, resumeId: track.resumeId },
    maxTokens: 2200,
    validate: (o) =>
      "experience_fit" in o && "role_relevance" in o && Array.isArray(o.weak_bullets),
    prompt: `Compare this resume to the job posting and explain the fit — don't just score it.

Return JSON:
{
  "experience_fit": 0,     // 0-4: does the candidate's years/seniority fit the role?
  "role_relevance": 0,     // 0-4: how relevant is their past work to this role?
  "summary": "Two plain sentences on the overall fit.",
  "experience_gap": "One plain sentence on the seniority/experience gap (e.g. 'Posting wants a senior with 5+ years; resume shows ~2 years, mid-level.'). Empty string if the candidate clearly meets the level.",
  "experience_note": "One plain sentence explaining the experience_fit rating.",
  "relevance_note": "One plain sentence explaining the role_relevance rating (how related past roles are).",
  "partial_terms": ["Term from the posting the resume only PARTIALLY or INDIRECTLY evidences (adjacent tools, related but not the exact skill). Use the posting's own wording."],
  "gap_advice": [
    { "skill": "exact term from the posting the resume lacks or only partly shows",
      "action": "one concrete, specific step to close this gap (a project to build, a phrasing to add, a cert/course), inventing no fake experience" }
  ],
  "weak_bullets": [
    { "original": "EXACT sentence copied from the resume",
      "issue": "why it's weak (e.g. no measurable result)",
      "suggestion": "a stronger rewrite, inventing nothing" }
  ]
}

Rules:
- "original" MUST be copied verbatim from the resume text. Do not paraphrase it.
- At most 5 weak_bullets, the weakest first.
- "partial_terms": skills the posting asks for that the resume touches on but does not clearly demonstrate. Do NOT list skills that are fully present, and do NOT list skills with no evidence at all. Use the exact term from the posting. At most 8.
- "gap_advice": one entry for each important skill the resume is missing or only partially shows, with a practical action. Use the exact posting term for "skill". At most 8.
- Ratings are integers 0-4. All note fields are plain English, no markdown.

Resume:
"""
${resumeText}
"""

Job posting:
"""
${description}
"""`,
  });

export const createMatch = async (req, res) => {
  try {
    const userId = req.user.id;
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

    // By default we reuse the saved analysis for this exact (job, resume): the
    // report is meant to be read and acted on, not re-rolled on every click, and
    // reusing it keeps the score stable and costs nothing. A fresh run happens
    // only for a resume not yet matched here (an updated version) OR when the
    // user explicitly asks with `force` (a deliberate, quota-counted re-analyze).
    if (!force) {
      const [existing] = await sql`
        SELECT data, created_at FROM job_outputs
        WHERE job_id = ${jobId} AND resume_id = ${resume.id} AND kind = 'match'
        ORDER BY created_at DESC LIMIT 1
      `;
      if (existing) {
        return res.json({
          success: true,
          match: existing.data,
          analyzedAt: existing.created_at,
          cached: true,
          history: await historyFor(jobId),
        });
      }
    }

    // reuse the requirements extracted on the first match for this job, so the
    // score stays comparable as the resume changes
    const [cached] = await sql`
      SELECT data FROM job_outputs
      WHERE job_id = ${jobId} AND kind = 'match'
      ORDER BY created_at ASC LIMIT 1
    `;
    const requirements =
      cached?.data?.requirements ??
      (await extractRequirements(job.description, { userId, jobId }));

    const judged = await judgeResume(resume.text, job.description, {
      userId,
      jobId,
      resumeId: resume.id,
    });

    // deterministic keyword coverage
    const required = requirements.keywords.filter((k) => k.importance === "required");
    const nice = requirements.keywords.filter((k) => k.importance !== "required");
    const reqRes = matchKeywords(resume.text, required);
    const niceRes = matchKeywords(resume.text, nice);

    const breakdown = {
      required: Math.round(coverage(reqRes.matched, reqRes.missing) * 100),
      nice: Math.round(coverage(niceRes.matched, niceRes.missing) * 100),
      experience: rating(judged.experience_fit),
      relevance: rating(judged.role_relevance),
    };
    const score = Math.max(
      0,
      Math.min(
        100,
        Math.round(
          breakdown.required * WEIGHTS.required +
            breakdown.nice * WEIGHTS.nice +
            breakdown.experience * WEIGHTS.experience +
            breakdown.relevance * WEIGHTS.relevance
        )
      )
    );

    // never show fabricated resume quotes
    const resumeLower = resume.text.toLowerCase();
    const weak_bullets = (judged.weak_bullets || [])
      .filter((b) => b.original && resumeLower.includes(b.original.trim().toLowerCase()))
      .slice(0, 5);

    // Skill buckets for the explanation. The score is unchanged: it still uses
    // the deterministic matched/missing coverage above. "partial" is a
    // display-only reclassification of some missing terms the AI judged to be
    // indirectly evidenced, so users see WHY, not just a number.
    const matchedTerms = [...reqRes.matched, ...niceRes.matched].map((k) => k.term);
    const missingTerms = [...reqRes.missing, ...niceRes.missing].map((k) => k.term);
    const partialSet = new Set(
      (Array.isArray(judged.partial_terms) ? judged.partial_terms : []).map((t) =>
        String(t).trim().toLowerCase()
      )
    );
    const partial = missingTerms.filter((t) => partialSet.has(t.toLowerCase()));
    const partialLower = new Set(partial.map((t) => t.toLowerCase()));
    const missing = missingTerms.filter((t) => !partialLower.has(t.toLowerCase()));

    // Skill gap analysis: one actionable entry per missing/partial skill, tied
    // to the deterministic buckets and the posting's required/nice importance.
    const importanceOf = new Map(
      requirements.keywords.map((k) => [k.term.toLowerCase(), k.importance === "required" ? "required" : "nice"])
    );
    const adviceOf = new Map(
      (Array.isArray(judged.gap_advice) ? judged.gap_advice : [])
        .filter((g) => g && g.skill)
        .map((g) => [String(g.skill).trim().toLowerCase(), String(g.action || "").trim()])
    );
    const gapEntry = (skill, status) => ({
      skill,
      status, // "missing" | "partial"
      importance: importanceOf.get(skill.toLowerCase()) || "nice",
      action:
        adviceOf.get(skill.toLowerCase()) ||
        (status === "partial"
          ? `Make your ${skill} experience explicit with a concrete example or result.`
          : `Add evidence of ${skill} — a project, course or bullet that shows it.`),
    });
    const rank = (g) => (g.importance === "required" ? 0 : 2) + (g.status === "missing" ? 0 : 1);
    const skill_gaps = [
      ...missing.map((s) => gapEntry(s, "missing")),
      ...partial.map((s) => gapEntry(s, "partial")),
    ].sort((a, b) => rank(a) - rank(b));

    // Personalized improvement plan: a prioritized, actionable checklist
    // synthesized from the bullets, skill gaps and experience gap. Each item is
    // grounded in the analysis (no extra AI call) and carries a stable id so its
    // completion state can be tracked in `data.progress`.
    const PRIORITY = { High: 0, Medium: 1, Low: 2 };
    const plan = [];
    if (weak_bullets.length > 0) {
      plan.push({
        id: "bullets",
        title: `Improve ${weak_bullets.length} resume bullet${weak_bullets.length > 1 ? "s" : ""}`,
        priority: "High",
        type: "resume",
        requirement: "Resume quality",
        why: "Clear, quantified bullets make your existing experience read stronger for this role.",
        what: 'Rewrite the flagged bullets using the suggestions in "Improve these bullet points".',
      });
    }
    if (judged.experience_gap) {
      plan.push({
        id: "experience",
        title: "Prepare for experience-level questions",
        priority: "High",
        type: "skill",
        requirement: "Seniority / experience",
        why: judged.experience_gap,
        what: "Prepare concrete examples that show scope, ownership and impact, and address the level gap in your summary.",
      });
    }
    for (const g of skill_gaps) {
      const isPartial = g.status === "partial";
      const priority =
        g.importance === "required"
          ? isPartial
            ? "Medium"
            : "High"
          : isPartial
          ? "Low"
          : "Medium";
      plan.push({
        id: `gap:${g.skill.toLowerCase()}:${g.status}`,
        title: isPartial ? `Make ${g.skill} experience explicit` : `Learn ${g.skill}`,
        priority,
        type: isPartial ? "resume" : "skill",
        requirement: g.skill,
        why: isPartial
          ? `The posting expects ${g.skill}; your resume only hints at it, so a recruiter may miss it.`
          : `${g.skill} is ${g.importance === "required" ? "required" : "listed"} for this role and isn't shown in your resume.`,
        what: g.action,
      });
    }
    plan.sort((a, b) => PRIORITY[a.priority] - PRIORITY[b.priority]);

    // Plain-English reasoning behind each factor of the score.
    const explanations = {
      required: `${reqRes.matched.length} of ${required.length} required skills found in your resume.`,
      nice: `${niceRes.matched.length} of ${nice.length} nice-to-have skills found.`,
      experience:
        judged.experience_note ||
        (judged.experience_gap ? judged.experience_gap : "Your experience level fits this role."),
      relevance: judged.relevance_note || "",
    };

    const data = {
      score,
      breakdown,
      matched: matchedTerms,
      partial,
      missing,
      requirements,
      summary: judged.summary || "",
      experience_gap: judged.experience_gap || "",
      explanations,
      skill_gaps,
      plan,
      progress: {},
      weak_bullets,
    };

    const [inserted] = await sql`
      INSERT INTO job_outputs (job_id, resume_id, user_id, kind, data)
      VALUES (${jobId}, ${resume.id}, ${userId}, 'match', ${data})
      RETURNING created_at
    `;
    await sql`
      UPDATE jobs SET resume_id = ${resume.id}, updated_at = NOW()
      WHERE id = ${jobId} AND user_id = ${userId}
    `;

    res.json({
      success: true,
      match: data,
      analyzedAt: inserted.created_at,
      cached: false,
      history: await historyFor(jobId),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Read a stored analysis for a (job, resume) pair — no AI call, no plan limit.
// Lets the UI show a cached report when the user picks a resume, instead of
// regenerating it every time.
export const getMatch = async (req, res) => {
  try {
    const userId = req.user.id;
    const jobId = Number(req.params.id);
    const resumeId = Number(req.query.resumeId);

    const [job] = await sql`
      SELECT id FROM jobs WHERE id = ${jobId} AND user_id = ${userId}
    `;
    if (!job) return notFound(res);

    let match = null;
    let analyzedAt = null;
    if (Number.isInteger(resumeId) && resumeId > 0) {
      const [row] = await sql`
        SELECT data, created_at FROM job_outputs
        WHERE job_id = ${jobId} AND resume_id = ${resumeId} AND kind = 'match' AND user_id = ${userId}
        ORDER BY created_at DESC LIMIT 1
      `;
      match = row?.data ?? null;
      analyzedAt = row?.created_at ?? null;
    }

    res.json({ success: true, match, analyzedAt, history: await historyFor(jobId) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Toggle one improvement-plan item's completion, stored in the match's data.
export const setMatchProgress = async (req, res) => {
  try {
    const userId = req.user.id;
    const jobId = Number(req.params.id);
    const { resumeId, itemId, done } = req.body;

    if (typeof itemId !== "string" || itemId.length === 0 || itemId.length > 120)
      return res.status(400).json({ success: false, message: "Invalid plan item." });

    const [row] = await sql`
      SELECT id, data FROM job_outputs
      WHERE job_id = ${jobId} AND resume_id = ${Number(resumeId)}
        AND kind = 'match' AND user_id = ${userId}
      ORDER BY created_at DESC LIMIT 1
    `;
    if (!row) return notFound(res);

    const progress = { ...(row.data.progress || {}), [itemId]: !!done };
    const merged = { ...row.data, progress };
    await sql`UPDATE job_outputs SET data = ${merged} WHERE id = ${row.id}`;

    res.json({ success: true, progress });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};
