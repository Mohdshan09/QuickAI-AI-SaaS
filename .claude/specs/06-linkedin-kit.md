# 06 — LinkedIn profile kit

**Free: 1 total. Premium: unlimited.** Depends on [00-foundation](00-foundation.md) (saved resumes).

## User story
I pick my resume and, optionally, the kind of role I'm targeting ("Frontend developer, remote"). I get a LinkedIn headline, an About section and a prioritised skills list, ready to paste into LinkedIn.

## Output rules
- **Headline:** 3 options, each at most 220 characters (LinkedIn's limit). Format: role, then a specialty, then proof (e.g. "Frontend Engineer · React & TypeScript · Cut load times 40% at Acme").
- **About:** 3 short paragraphs, at most 2,600 characters (LinkedIn's limit), written in the first person. It must mention at least 2 concrete results from the resume and end with what the user is looking for. It must not invent anything, just like spec 02.
- **Skills:** top 10, ordered by relevance to the target role. Only skills shown in the resume, plus up to 3 marked "worth adding if true".
- **Keywords for recruiters:** 5–8 search terms recruiters use for this role that already appear in the resume, so the user knows which words to keep prominent.

## AI call (through `generateJSON`)
```json
{
  "headlines": ["...", "...", "..."],
  "about": "...",
  "skills": [ { "name": "React", "in_resume": true } ],
  "recruiter_keywords": ["..."]
}
```
Our code enforces the character limits (truncate at a word boundary if needed) and removes any skill marked `in_resume: true` that doesn't appear in the resume text.

## Storage and API
The kit isn't tied to a job, so it's stored in the existing `creations` table with `content_type = 'linkedin-kit'` and `content` set to the JSON string. The dashboard (`Frontend/src/pages/Dashboard.jsx`) gets a new `CATEGORIES` entry.

`POST /api/career/linkedin-kit` with body `{ resumeId, target? }` (`target` at most 120 characters).

Middleware: `aiRateLimit`, `auth`, and a free-plan limit of 1. Count the user's `creations` rows with `content_type = 'linkedin-kit'`, following the `planLimit` pattern from spec 00.

## UI — `Frontend/src/pages/career/LinkedInKit.jsx` → `/ai/linkedin`
- Pick a resume, enter an optional target role, click **Generate**.
- **Headlines:** 3 cards, each with a character count and a **Copy** button.
- **About:** an editable text area with a live character count (`/ 2600`) and **Copy**.
- **Skills:** chips in order; "worth adding if true" skills get a dashed outline.
- A short "Where to paste this" guide with the 3 LinkedIn sections.

## How to verify
- [ ] Every headline is at most 220 characters; About is at most 2,600.
- [ ] About mentions at least 2 real results from the resume.
- [ ] No skill marked as in the resume is missing from the resume.
- [ ] Generating the kit makes it appear in a "LinkedIn Kit" section on the dashboard.
- [ ] A free user can generate once, then sees the upgrade message.
