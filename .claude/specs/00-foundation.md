# 00 — Foundation: resumes, jobs and the AI helper

Everything in specs 01–07 depends on this. Build it first.

## Goal
- A user uploads a resume **once**. Its text is saved and reused for every job.
- A user saves a **job** (company, role, posting text). Every result for that job (match score, tailored resume, cover letter, interview prep) hangs off it.
- One shared helper makes AI calls that return **validated JSON**, so the UI can show structured results.

## Database — `Backend/migrations/003_career_foundation.sql`

```sql
CREATE TABLE IF NOT EXISTS resumes (
  id          SERIAL PRIMARY KEY,
  user_id     TEXT        NOT NULL,
  title       TEXT        NOT NULL,          -- e.g. "Frontend resume v2"
  text        TEXT        NOT NULL,          -- extracted with pdf-parse
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS resumes_user_idx ON resumes (user_id);

CREATE TABLE IF NOT EXISTS jobs (
  id           SERIAL PRIMARY KEY,
  user_id      TEXT        NOT NULL,
  resume_id    INTEGER     REFERENCES resumes(id) ON DELETE SET NULL,
  company      TEXT        NOT NULL,
  role         TEXT        NOT NULL,
  description  TEXT        NOT NULL,         -- the pasted job posting
  url          TEXT,
  status       TEXT        NOT NULL DEFAULT 'saved'
               CHECK (status IN ('saved','applied','interviewing','offer','rejected')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS jobs_user_idx ON jobs (user_id);

-- One row per generated result, so history is kept (e.g. score 62 → 88)
CREATE TABLE IF NOT EXISTS job_outputs (
  id          SERIAL PRIMARY KEY,
  job_id      INTEGER     NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  resume_id   INTEGER     REFERENCES resumes(id) ON DELETE SET NULL,
  user_id     TEXT        NOT NULL,
  kind        TEXT        NOT NULL
              CHECK (kind IN ('match','tailored','cover_letter','interview')),
  data        JSONB       NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS job_outputs_job_idx ON job_outputs (job_id, kind, created_at DESC);
CREATE INDEX IF NOT EXISTS job_outputs_user_kind_idx ON job_outputs (user_id, kind);
```

Why store the resume **text** and not the PDF: every feature only needs the text, it avoids paying for file storage, and it avoids keeping personal documents longer than needed.

## Shared AI helper — `Backend/config/ai.js`
Move the `OpenAI` client out of `controllers/AIcontroller.js` into this file and export it (`AIcontroller.js` imports it from here instead). Add:

```js
// Calls Gemini and returns parsed JSON that matches `schema`, or throws
export const generateJSON = async ({ prompt, schema, name, maxTokens = 2000, temperature = 0 }) => { ... }
```
- Uses `model: "gemini-2.5-flash"`, `reasoning_effort: "none"`, and `response_format: { type: "json_schema", json_schema: { name, schema } }`.
- Parses the returned text with `JSON.parse`. If parsing fails or required fields are missing, retries once, then throws `Error("AI returned an invalid response")`.
- Before relying on it, test once that Gemini's OpenAI-compatible endpoint accepts `json_schema` for this model. If it doesn't, fall back to `response_format: { type: "json_object" }` and put the schema in the prompt.

## Plan limits helper — `Backend/middlewares/planLimit.js`
```js
// e.g. router.post("/jobs/:id/match", auth, planLimit("match", 3), createMatch)
export const planLimit = (kind, freeLimit) => async (req, res, next) => { ... }
```
- Premium users go straight through.
- Free users: `SELECT count(*) FROM job_outputs WHERE user_id = $1 AND kind = $2`. At or over `freeLimit`, respond `403 { success:false, message: "Free plan limit reached. Upgrade to continue." }`.
- `freeLimit = 0` means premium-only: free users are rejected straight away without a count query. This also works for features that don't store rows in `job_outputs` (e.g. headshots).
- Plan limits are counted in the database, not in Clerk `free_usage`. The old tools keep using `free_usage`.

## API — `Backend/routes/Career.js` mounted at `/api/career` in `server.js`

All routes sit behind the existing `requireAuth()`. Every query filters by `user_id`, so users can only see and change their own rows. Any `:id` that doesn't belong to the user returns 404, not 403.

| Method | Path | Purpose | Extra middleware |
|---|---|---|---|
| POST | `/resumes` | Upload a PDF, extract its text, save it | `aiRateLimit`, `uploadPdf.single("resume")` |
| GET | `/resumes` | List the user's resumes (no text) | — |
| DELETE | `/resumes/:id` | Delete a resume | — |
| POST | `/jobs` | Save a job | — |
| GET | `/jobs` | List jobs with their latest match score | — |
| GET | `/jobs/:id` | One job, its latest output of each kind and the score history | — |
| PATCH | `/jobs/:id` | Update status, resume_id or fields | — |
| DELETE | `/jobs/:id` | Delete a job and its outputs | — |

Reuse: `uploadPdf` from `config/multer.js`, `aiRateLimit` from `middlewares/rateLimit.js`, `auth` from `middlewares/auth.js`, `sql` from `config/Neon.js`, and the PDF parsing already used in `resumeReview` (`pdf-parse/lib/pdf-parse.js`).

Validation:
- Resume PDF: at most 5MB (multer already does this). Extracted text must be 200–30,000 characters; otherwise respond "Couldn't read text from this PDF. Is it a scanned image?"
- Job: `company` and `role` 1–120 characters; `description` 200–15,000 characters; `url` optional, must start with `http`.
- Plan counts: free users can have 1 resume and 5 jobs; premium 10 and unlimited.

The resume upload uses `aiRateLimit` because parsing costs CPU, even though it doesn't call AI.

## Frontend
- **New pages** under `Frontend/src/pages/career/`, added as `/ai` child routes in `Frontend/src/App.jsx`:
  - `Resumes.jsx` → `/ai/resumes`: upload and list resumes.
  - `Jobs.jsx` → `/ai/jobs`: list for now; becomes the board in spec 07.
  - `JobDetail.jsx` → `/ai/jobs/:id`: job info plus a tab for each feature: Match (01), Tailored resume (02), Cover letter (03), Interview prep (04).
- **API calls:** `Frontend/src/lib/careerApi.js` wraps axios and adds the Clerk token, so pages don't repeat header code.
- **Sidebar** (`Frontend/src/components/Sidebar.jsx`): new top section with Jobs, Resumes, Headshot and LinkedIn kit. The old tools move under an "Extras" heading.
- **First-time user:** if the user has no resume, `/ai/jobs` shows one clear step: "Upload your resume to get started".

## How to verify
- [ ] `npm run migrate` applies `003_career_foundation.sql`; running it again is a no-op.
- [ ] Upload a normal PDF resume → a row appears in `resumes` with readable text.
- [ ] Upload a scanned or image-only PDF → clear error, no row.
- [ ] Create, update and delete a job. Deleting a job removes its `job_outputs` rows.
- [ ] User A can't read, update or delete user B's resume or job (404 for each).
- [ ] A free user can't create a second resume or a sixth job.
- [ ] `generateJSON` returns a parsed object for a simple test schema.
- [ ] The old `/api/ai/*` tools still work after moving the OpenAI client into `config/ai.js`.
