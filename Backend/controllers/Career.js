import fs from "fs";
import sql from "../config/Neon.js";
import pdf from "pdf-parse/lib/pdf-parse.js";

// ---- limits -------------------------------------------------------------
const RESUME_CAP = { free: 1, premium: 10 };
const JOB_CAP = { free: 5, premium: Infinity };

const RESUME_MIN = 200;
const RESUME_MAX = 30000;
const DESC_MIN = 200;
const DESC_MAX = 15000;

const JOB_STATUSES = ["saved", "applied", "interviewing", "offer", "rejected"];

// ---- helpers ------------------------------------------------------------
const badRequest = (res, message) =>
  res.status(400).json({ success: false, message });

const notFound = (res) =>
  res.status(404).json({ success: false, message: "Not found." });

const serverError = (res, error) => {
  console.error(error);
  res.status(500).json({ success: false, message: error.message });
};

const isText = (v, min, max) =>
  typeof v === "string" && v.trim().length >= min && v.length <= max;

// ---- resumes ------------------------------------------------------------
export const uploadResume = async (req, res) => {
  try {
    const { userId } = req.auth();
    const file = req.file;
    if (!file) return badRequest(res, "Please upload a PDF resume.");

    const title = isText(req.body.title, 1, 120)
      ? req.body.title.trim()
      : (file.originalname || "My resume").replace(/\.pdf$/i, "").slice(0, 120);

    const cap = RESUME_CAP[req.plan] ?? RESUME_CAP.free;
    const [{ count }] = await sql`
      SELECT count(*)::int AS count FROM resumes WHERE user_id = ${userId}
    `;
    if (count >= cap) {
      return res.status(403).json({
        success: false,
        message:
          req.plan === "premium"
            ? `You can store up to ${cap} resumes.`
            : "Free plan allows 1 resume. Upgrade to store more.",
      });
    }

    let text;
    try {
      const buffer = fs.readFileSync(file.path);
      text = (await pdf(buffer)).text?.trim() ?? "";
    } catch {
      return badRequest(res, "Couldn't read this PDF. Please try another file.");
    } finally {
      fs.promises.unlink(file.path).catch(() => {});
    }

    if (text.length < RESUME_MIN) {
      return badRequest(
        res,
        "Couldn't read text from this PDF. Is it a scanned image?"
      );
    }
    text = text.slice(0, RESUME_MAX);

    const [resume] = await sql`
      INSERT INTO resumes (user_id, title, text)
      VALUES (${userId}, ${title}, ${text})
      RETURNING id, title, created_at
    `;
    res.json({ success: true, resume });
  } catch (error) {
    serverError(res, error);
  }
};

export const listResumes = async (req, res) => {
  try {
    const { userId } = req.auth();
    const resumes = await sql`
      SELECT id, title, created_at
      FROM resumes WHERE user_id = ${userId}
      ORDER BY created_at DESC
    `;
    res.json({ success: true, resumes });
  } catch (error) {
    serverError(res, error);
  }
};

export const deleteResume = async (req, res) => {
  try {
    const { userId } = req.auth();
    const id = Number(req.params.id);
    const rows = await sql`
      DELETE FROM resumes WHERE id = ${id} AND user_id = ${userId} RETURNING id
    `;
    if (rows.length === 0) return notFound(res);
    res.json({ success: true });
  } catch (error) {
    serverError(res, error);
  }
};

// Create a resume from plain text (used by "Save & re-check" after tailoring).
export const createResumeFromText = async (req, res) => {
  try {
    const { userId } = req.auth();
    const title = isText(req.body.title, 1, 120) ? req.body.title.trim() : "Tailored resume";
    const text = typeof req.body.text === "string" ? req.body.text.trim() : "";

    if (text.length < RESUME_MIN)
      return badRequest(res, `Resume text must be at least ${RESUME_MIN} characters.`);

    const cap = RESUME_CAP[req.plan] ?? RESUME_CAP.free;
    const [{ count }] = await sql`
      SELECT count(*)::int AS count FROM resumes WHERE user_id = ${userId}
    `;
    if (count >= cap) {
      return res.status(403).json({
        success: false,
        message:
          req.plan === "premium"
            ? `You can store up to ${cap} resumes.`
            : "Free plan allows 1 resume. Upgrade to store more.",
      });
    }

    const [resume] = await sql`
      INSERT INTO resumes (user_id, title, text)
      VALUES (${userId}, ${title}, ${text.slice(0, RESUME_MAX)})
      RETURNING id, title, created_at
    `;
    res.json({ success: true, resume });
  } catch (error) {
    serverError(res, error);
  }
};

// ---- jobs ---------------------------------------------------------------
export const createJob = async (req, res) => {
  try {
    const { userId } = req.auth();
    const { company, role, description, url, resumeId } = req.body;

    if (!isText(company, 1, 120)) return badRequest(res, "Company is required (max 120 chars).");
    if (!isText(role, 1, 120)) return badRequest(res, "Role is required (max 120 chars).");
    if (!isText(description, DESC_MIN, DESC_MAX))
      return badRequest(res, `Job description must be ${DESC_MIN}-${DESC_MAX} characters.`);
    if (url != null && !/^https?:\/\//.test(url))
      return badRequest(res, "URL must start with http.");

    const cap = JOB_CAP[req.plan] ?? JOB_CAP.free;
    if (cap !== Infinity) {
      const [{ count }] = await sql`
        SELECT count(*)::int AS count FROM jobs WHERE user_id = ${userId}
      `;
      if (count >= cap)
        return res.status(403).json({
          success: false,
          message: "Free plan allows 5 tracked jobs. Upgrade for unlimited.",
        });
    }

    // resume_id, if given, must belong to the user
    let resume_id = null;
    if (resumeId != null) {
      const [owned] = await sql`
        SELECT id FROM resumes WHERE id = ${Number(resumeId)} AND user_id = ${userId}
      `;
      if (!owned) return badRequest(res, "Resume not found.");
      resume_id = owned.id;
    }

    const [job] = await sql`
      INSERT INTO jobs (user_id, resume_id, company, role, description, url)
      VALUES (${userId}, ${resume_id}, ${company.trim()}, ${role.trim()}, ${description}, ${url ?? null})
      RETURNING *
    `;
    res.json({ success: true, job });
  } catch (error) {
    serverError(res, error);
  }
};

export const listJobs = async (req, res) => {
  try {
    const { userId } = req.auth();
    // one query: each job with its latest match score and which output kinds exist
    const jobs = await sql`
      SELECT j.id, j.company, j.role, j.status, j.url, j.resume_id,
             j.created_at, j.updated_at,
             m.score AS latest_score,
             COALESCE(k.kinds, '{}') AS has_outputs
      FROM jobs j
      LEFT JOIN LATERAL (
        SELECT (data->>'score')::int AS score
        FROM job_outputs
        WHERE job_id = j.id AND kind = 'match'
        ORDER BY created_at DESC LIMIT 1
      ) m ON true
      LEFT JOIN LATERAL (
        SELECT array_agg(DISTINCT kind) AS kinds
        FROM job_outputs WHERE job_id = j.id
      ) k ON true
      WHERE j.user_id = ${userId}
      ORDER BY j.updated_at DESC
    `;
    res.json({ success: true, jobs });
  } catch (error) {
    serverError(res, error);
  }
};

export const getJob = async (req, res) => {
  try {
    const { userId } = req.auth();
    const id = Number(req.params.id);
    const [job] = await sql`
      SELECT * FROM jobs WHERE id = ${id} AND user_id = ${userId}
    `;
    if (!job) return notFound(res);

    // latest output of each kind
    const latest = await sql`
      SELECT DISTINCT ON (kind) kind, id, data, resume_id, created_at
      FROM job_outputs WHERE job_id = ${id}
      ORDER BY kind, created_at DESC
    `;
    const outputs = {};
    for (const row of latest) outputs[row.kind] = row;

    // score history (oldest first)
    const history = await sql`
      SELECT (data->>'score')::int AS score, created_at
      FROM job_outputs WHERE job_id = ${id} AND kind = 'match'
      ORDER BY created_at ASC
    `;

    res.json({ success: true, job, outputs, scoreHistory: history });
  } catch (error) {
    serverError(res, error);
  }
};

export const updateJob = async (req, res) => {
  try {
    const { userId } = req.auth();
    const id = Number(req.params.id);
    const [job] = await sql`
      SELECT * FROM jobs WHERE id = ${id} AND user_id = ${userId}
    `;
    if (!job) return notFound(res);

    const { status, resumeId, company, role, description, url } = req.body;

    if (status !== undefined && !JOB_STATUSES.includes(status))
      return badRequest(res, "Invalid status.");
    if (company !== undefined && !isText(company, 1, 120))
      return badRequest(res, "Company is required (max 120 chars).");
    if (role !== undefined && !isText(role, 1, 120))
      return badRequest(res, "Role is required (max 120 chars).");
    if (description !== undefined && !isText(description, DESC_MIN, DESC_MAX))
      return badRequest(res, `Job description must be ${DESC_MIN}-${DESC_MAX} characters.`);
    if (url !== undefined && url !== null && !/^https?:\/\//.test(url))
      return badRequest(res, "URL must start with http.");

    let resume_id = job.resume_id;
    if (resumeId !== undefined) {
      if (resumeId === null) {
        resume_id = null;
      } else {
        const [owned] = await sql`
          SELECT id FROM resumes WHERE id = ${Number(resumeId)} AND user_id = ${userId}
        `;
        if (!owned) return badRequest(res, "Resume not found.");
        resume_id = owned.id;
      }
    }

    const [updated] = await sql`
      UPDATE jobs SET
        status      = ${status ?? job.status},
        resume_id   = ${resume_id},
        company     = ${company ?? job.company},
        role        = ${role ?? job.role},
        description = ${description ?? job.description},
        url         = ${url === undefined ? job.url : url},
        updated_at  = NOW()
      WHERE id = ${id} AND user_id = ${userId}
      RETURNING *
    `;
    res.json({ success: true, job: updated });
  } catch (error) {
    serverError(res, error);
  }
};

export const deleteJob = async (req, res) => {
  try {
    const { userId } = req.auth();
    const id = Number(req.params.id);
    const rows = await sql`
      DELETE FROM jobs WHERE id = ${id} AND user_id = ${userId} RETURNING id
    `;
    if (rows.length === 0) return notFound(res);
    res.json({ success: true });
  } catch (error) {
    serverError(res, error);
  }
};
