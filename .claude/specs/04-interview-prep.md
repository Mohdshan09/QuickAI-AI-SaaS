# 04 — Interview prep

**Premium only.** Depends on [00-foundation](00-foundation.md) and [01-match-score](01-match-score.md).

## User story
When a job moves to **Interviewing**, I open the prep tab and get the questions I'm most likely to face for this role, especially about the **gaps** between my resume and the job. For each one, I get a suggested answer built from my own experience, which I can practise and mark as ready.

## Question mix (10 questions)
| Type | Count | Source |
|---|---|---|
| Gap questions | 3 | The job's missing keywords and weak areas from the latest match output |
| Role and technical | 4 | The job's required keywords and role level |
| Behavioural | 2 | The posting's responsibilities, answered with the STAR method |
| Why this company / role | 1 | The company, the role, and the user's background |

If there's no match output yet, run the extraction step from spec 01 first and use the missing keywords from it.

## AI call (through `generateJSON`)
```json
{
  "questions": [
    { "type": "gap | technical | behavioural | motivation",
      "question": "You haven't used GraphQL. How would you get up to speed?",
      "why_asked": "The job requires GraphQL; your resume doesn't show it.",
      "answer_outline": ["Point 1", "Point 2", "Point 3"],
      "resume_evidence": ["Built REST APIs with Express at Acme"] }
  ]
}
```
- `answer_outline` is 3–5 short points, **not** a script to memorise.
- For gap questions, the outline must be honest: acknowledge the gap, name related experience, and give a concrete plan to learn.
- Our code checks every `resume_evidence` item appears in the resume text (the same check as spec 01's bullets) and drops any that don't.

## API
`POST /api/career/jobs/:id/interview-prep` with body `{ resumeId }`

Middleware: `aiRateLimit`, `auth`, `planLimit("interview", 0)`.

Saves a `job_outputs` row with `kind = 'interview'`. Progress is saved with `PATCH /api/career/outputs/:id` using body `{ ready: { "<index>": true } , notes: { "<index>": "..." } }`, stored in `data.ready` and `data.notes` (notes at most 1,000 characters each).

## UI — "Interview prep" tab in `JobDetail.jsx`
- Questions grouped by type; gap questions first, with a small "Gap" badge.
- Each question expands to show *why they'll ask*, the answer outline, the resume evidence, and a notes box.
- A **Ready** checkbox per question, and a progress bar at the top ("6 / 10 ready").
- When the job status changes to `interviewing` (spec 07) and no prep exists yet, show a banner: "Interview coming up? Prepare now."

## How to verify
- [ ] At least 3 questions target keywords missing from the resume.
- [ ] Every shown `resume_evidence` item exists word for word in the resume.
- [ ] Gap answers don't claim experience the user doesn't have.
- [ ] Ready ticks and notes are still there after a page reload.
- [ ] A free user sees the upgrade message; the API returns 403.
