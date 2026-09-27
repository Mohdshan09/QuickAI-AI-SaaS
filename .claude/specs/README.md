# QuickAI → Job-hunting assistant

## Why
Today QuickAI offers six general tools: article writer, blog titles, image generation, background removal, object removal and resume review. People can already do all of these for free in ChatGPT, Canva or remove.bg, so nothing makes them pick QuickAI.

The new direction is **one audience, one outcome: help job seekers get more interviews.** QuickAI should do things a blank chat box can't:

- **It remembers.** Resume versions, scores and applications are saved together instead of getting lost in old chats.
- **Structured results.** Scores, keyword lists and side-by-side changes instead of a wall of text.
- **One-time setup.** Upload a resume once and reuse it for every job.
- **Repeatable score.** The same resume and job always get (nearly) the same match score, so users can track progress. People screenshot and share "62% → 88%".

Homepage message: **"Get more interviews"**, not "8 AI tools".

## Audience
Active job seekers: students, recent graduates, people switching careers or jobs. They have an urgent problem, come back for every application, and a job is worth far more than a $10–20/month subscription.

## Build order

| # | Spec | Summary | Plan |
|---|---|---|---|
| 0 | [00-foundation.md](00-foundation.md) | Saved resumes, jobs, shared AI helper, new routes and pages | — |
| 1 | [01-match-score.md](01-match-score.md) | Resume vs. job posting match %, missing keywords, weak bullet points | Free: 4, Premium: unlimited |
| 2 | [02-tailored-resume.md](02-tailored-resume.md) | Rewrite bullet points for one job, side by side, export as PDF | Premium |
| 3 | [03-cover-letter.md](03-cover-letter.md) | Cover letter from the real resume plus the job posting | Free: 1, Premium: unlimited |
| 4 | [04-interview-prep.md](04-interview-prep.md) | Likely questions based on resume gaps, answers built from the user's experience | Premium |
| 5 | [05-headshot.md](05-headshot.md) | Professional headshot: remove background, studio background, LinkedIn crop | Premium |
| 6 | [06-linkedin-kit.md](06-linkedin-kit.md) | Headline, About section and skills from the resume | Free: 1, Premium: unlimited |
| 7 | [07-application-tracker.md](07-application-tracker.md) | Board of jobs by status, each holding its score, resume, letter and prep | Free |

Build 0 and 1 first and ship them. They are the reason people will choose QuickAI; everything after builds on them.

## Plans (Clerk)
The Clerk `premium` plan already exists and is checked in `Backend/middlewares/auth.js` (`req.plan`).

| | Free | Premium |
|---|---|---|
| Saved resumes | 1 | 10 |
| Tracked jobs | 5 | Unlimited |
| Match scores | 4 total | Unlimited |
| Cover letters | 1 total | Unlimited |
| LinkedIn kit | 1 total | Unlimited |
| Tailored resume, interview prep, headshot | — | Yes |

The per-user and whole-app rate limits in `Backend/middlewares/rateLimit.js` apply to every AI call on top of these plan limits.

## Existing tools
- **Background removal** becomes the core of the headshot tool (spec 05).
- **Resume review** is replaced by match score. Keep the old page until match score ships.
- **Article, blog titles, image generation, object removal** move to an "Extras" section at the bottom of the sidebar. Don't delete them; existing users have creations there.

## Conventions for all specs
- **Backend:** new code goes in `Backend/routes/Career.js` and `Backend/controllers/Career.js`, mounted at `/api/career`. Existing `/api/ai` code stays as it is.
- **Database:** every schema change is a new file in `Backend/migrations/`, applied with `npm run migrate`.
- **AI calls:** use `gemini-2.5-flash` with `reasoning_effort: "none"`, and ask for structured JSON output through the shared helper in spec 00.
- **Errors:** `{ success: false, message }` with a proper status code. The frontend shows `err.response?.data?.message || err.message` in a toast.
- **Validation:** check every input's type and length before calling any paid API.
