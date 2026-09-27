# 02 — Tailored resume

**Premium only.** Depends on [00-foundation](00-foundation.md) and [01-match-score](01-match-score.md).

## User story
After seeing my match score, I click **Tailor my resume for this job**. I see my resume's bullet points on the left and rewritten versions on the right, aimed at this job. I accept or reject each change, then export the result as a PDF.

## Rules the AI must follow
- **Never invent anything.** No new employers, job titles, dates, degrees, numbers or skills the resume doesn't show. Rewrite wording, reorder, and bring forward relevant experience that's already there.
- Use the job's missing keywords **only where the resume already supports them**. Example: the resume mentions building "REST APIs with Express" and the job wants "Node.js", so "Node.js" can be used.
- Keep each bullet at most 2 lines and start it with a strong verb.

## AI call (through `generateJSON`)
Input: the resume text, the job description, and the cached requirements from the job's match output.

Output:
```json
{
  "summary": { "original": "...", "tailored": "..." },
  "sections": [
    { "heading": "Experience — Acme Corp",
      "bullets": [ { "original": "...", "tailored": "...", "reason": "Adds GraphQL, which the job requires" } ] }
  ],
  "skills": { "original": ["..."], "tailored": ["..."] }
}
```
After the call, **our code checks** that no `tailored` bullet contains a number that doesn't appear anywhere in the resume. Any bullet that fails keeps its original text and is flagged "kept original".

## API
`POST /api/career/jobs/:id/tailor` with body `{ resumeId }`

Middleware: `aiRateLimit`, `auth`, `planLimit("tailored", 0)` (premium only).

Saves a `job_outputs` row with `kind = 'tailored'`. Accepted and rejected choices are saved with `PATCH /api/career/outputs/:id` using body `{ accepted: { "<section>:<bullet index>": true|false } }`, stored in `data.accepted`.

## UI — "Tailored resume" tab in `JobDetail.jsx`
- Two columns: original and tailored. Changed words are highlighted in the tailored column (a simple word diff, e.g. the `diff` npm package's `diffWords`).
- Each bullet has ✓ and ✗ buttons. All are accepted by default.
- The `reason` shows in small grey text under each change.
- **Export PDF:** opens `/ai/jobs/:id/print`, a clean single-column resume with only the accepted versions, styled with `@media print`. It calls `window.print()` so the user can "Save as PDF". No PDF library is needed for version 1.
- **Re-check match with tailored version:** creates a new resume from the accepted text and runs spec 01. This closes the loop and shows the score going up.

## How to verify
- [ ] No tailored bullet adds a new employer, title, date or number (check 3 real resumes by hand).
- [ ] A bullet with an invented number falls back to the original and is marked "kept original".
- [ ] Accept/reject choices are still there after a page reload.
- [ ] The printed PDF contains only accepted text and fits a normal resume layout.
- [ ] Re-checking with the tailored version scores the same or higher than the original.
- [ ] A free user sees the upgrade message; the API returns 403.
