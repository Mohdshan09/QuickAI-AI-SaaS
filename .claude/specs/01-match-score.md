# 01 — Resume vs. job match score

**The main feature.** It's the reason people choose QuickAI over a chat box. Depends on [00-foundation](00-foundation.md).

## User story
As a job seeker, I pick one of my saved resumes and a saved job, and within a few seconds I see:
- a **match score** out of 100,
- the job's **keywords I'm missing**,
- my **weakest bullet points**, each with a concrete suggestion.

I can fix my resume, upload the new version, run the match again and watch the score go up.

## Why the score must be repeatable
If the same resume and job give 71, then 64, then 78, users stop trusting the product. So most of the score is computed **by our code**, not guessed by the AI:

1. The AI **extracts** requirements from the job posting (a list of skills and keywords, each marked required or nice-to-have). Extraction is far more stable than asking an AI to give a score.
2. **Our code** checks which of those keywords appear in the resume text. This is deterministic.
3. The AI **rates** a few things code can't judge (experience level, how relevant past roles are), each on a small fixed scale.
4. **Our code** combines everything with fixed weights.

The AI calls use `temperature: 0`. The extracted requirements are **cached per job** (in the job's first `match` output), so re-running a match after editing the resume only changes the resume side of the comparison.

## Score formula
| Part | Weight | How it's measured |
|---|---|---|
| Required keywords | 45% | Share of required keywords found in the resume |
| Nice-to-have keywords | 15% | Share of nice-to-have keywords found |
| Experience fit | 20% | AI rating 0–4 → 0, 25, 50, 75, 100 |
| Role relevance | 20% | AI rating 0–4 → 0, 25, 50, 75, 100 |

`score = round(sum of part × weight)`, clamped to 0–100.

Keyword matching (`Backend/lib/keywords.js`):
- Lowercase both texts and strip punctuation, except `+`, `#` and `.` inside words (so `C++`, `C#`, `Node.js` still match).
- Each extracted keyword comes with `aliases` from the AI (e.g. `JavaScript` → `["js","javascript"]`). A match on any alias counts.
- Match whole words only, so `Java` must not match inside `JavaScript`.

## AI calls (through `generateJSON` from spec 00)

**Call 1: extract requirements** (skipped when the job already has them cached)
```json
{
  "role_level": "junior | mid | senior | lead",
  "keywords": [
    { "term": "React", "aliases": ["react.js","reactjs"], "importance": "required" }
  ]
}
```
At most 25 keywords. Prompt: only skills, tools, certifications and domain terms that literally appear in or are clearly required by the posting; no soft skills like "team player".

**Call 2: judge the resume against the job**
```json
{
  "experience_fit": 0,
  "role_relevance": 0,
  "summary": "Two sentences in plain English.",
  "weak_bullets": [
    { "original": "exact text from the resume", "issue": "No measurable result", "suggestion": "Rewritten bullet" }
  ]
}
```
At most 5 `weak_bullets`. After the call, **our code drops** any bullet whose `original` doesn't appear in the resume text, so we never show made-up quotes.

## API
`POST /api/career/jobs/:id/match` with body `{ resumeId }`

Middleware: `aiRateLimit`, `auth`, `planLimit("match", 3)`.

Steps:
1. Load the job and resume, both filtered by `user_id` (404 if either is missing).
2. Load cached requirements from this job's earliest `match` output, or run call 1.
3. Run call 2.
4. Compute keyword coverage and the score.
5. Insert into `job_outputs` with `kind = 'match'`, `resume_id`, and `data`:
   ```json
   { "score": 74, "breakdown": { "required": 80, "nice": 50, "experience": 75, "relevance": 75 },
     "matched": ["React"], "missing": ["GraphQL"], "requirements": { ... }, "summary": "...", "weak_bullets": [...] }
   ```
6. Set the job's `resume_id` to this resume.
7. Respond `{ success: true, match: data, history: [{ score, created_at }] }`.

`GET /api/career/jobs/:id` (spec 00) already returns the latest match and the score history.

## UI — "Match" tab in `JobDetail.jsx`
- **Top:** a big score ring (0–100) coloured red below 50, amber for 50–74, green for 75 and up. Next to it: "Last checked with *Frontend resume v2*" and a **Re-check** button with a resume picker.
- **Score history:** a small line of past scores (62 → 71 → 88) once there are two or more.
- **Breakdown:** four bars (required keywords, nice-to-have, experience, relevance).
- **Keywords:** green chips for matched and red chips for missing, required ones first.
- **Improve these bullets:** a card per weak bullet showing the original (struck through), the issue and the suggestion, with a **Copy** button.
- **Share:** a "Copy result" button producing text like `My resume now matches Frontend Engineer at Acme 88% — via QuickAI`. This is free marketing.
- **Loading:** a skeleton with "Reading the job posting… Comparing your resume…" (about 5–10 seconds).
- **Free user at the limit:** instead of the button, "You've used your 4 free match checks. Upgrade for unlimited." linking to the plans section.

## How to verify
- [ ] The same resume and job run 3 times give scores within ±3 points.
- [ ] A resume that clearly fits the job scores higher than one that clearly doesn't (build one test pair by hand).
- [ ] Adding a missing keyword to the resume, re-uploading and re-checking raises the score, and history shows both.
- [ ] Every `weak_bullets.original` shown in the UI exists word for word in the resume text.
- [ ] `C++`, `C#` and `Node.js` match correctly; `Java` doesn't match "JavaScript".
- [ ] A free user gets exactly 4 checks, then a 403 with the upgrade message; premium is unlimited.
- [ ] Another user's job or resume ID returns 404.
- [ ] The 5-per-minute rate limit still applies.
