# 03 — Cover letter

**Free: 1 total. Premium: unlimited.** Depends on [00-foundation](00-foundation.md).

## User story
For a saved job, I click **Write cover letter**, choose a tone, and get a letter that uses real details from my resume (projects, results, tools) connected to what this job asks for. I can edit it right there, regenerate it, and copy or download it.

## What makes it better than a chat box
- It already has my resume and the job, so there's nothing to paste.
- It must cite at least 2 **specific** items from my resume (a project name, a result, a tool) and connect each to a requirement in the posting.
- No filler phrases: the prompt bans "I am writing to express my interest", "I believe I would be a great fit", "passionate", "dynamic" and similar clichés.
- 250–350 words, 3–4 paragraphs.

## AI call (through `generateJSON`)
Input: the resume text, the job description, the company, the role, the tone (`professional` | `warm` | `confident`) and an optional note from the user (up to 300 characters, e.g. "I used their product at my last job").

Output:
```json
{
  "letter": "Full text with \n\n between paragraphs",
  "evidence": [ { "resume_detail": "Cut page load time by 40% at Acme", "job_requirement": "Performance optimisation" } ]
}
```
After the call, our code:
- rejects the result (and retries once) if `evidence` has fewer than 2 items,
- runs a banned-phrase check,
- checks the length is 200–400 words.

## API
`POST /api/career/jobs/:id/cover-letter` with body `{ resumeId, tone, note? }`

Middleware: `aiRateLimit`, `auth`, `planLimit("cover_letter", 1)`.

Saves a `job_outputs` row with `kind = 'cover_letter'`. Manual edits are saved with `PATCH /api/career/outputs/:id` using body `{ letter }` (at most 5,000 characters), stored in `data.letter`; the AI's original is kept in `data.original`.

## UI — "Cover letter" tab in `JobDetail.jsx`
- Tone selector (3 chips), an optional note field, and a **Generate** button.
- The letter appears in an editable text area and autosaves 1 second after typing stops.
- **Why this works** panel: lists the `evidence` pairs, so the user sees the letter is grounded in their real experience.
- Buttons: **Copy**, **Download .txt**, **Regenerate** (counts toward the plan limit).

## How to verify
- [ ] The letter mentions at least 2 concrete details that exist in the resume.
- [ ] None of the banned phrases appear across 5 generated letters.
- [ ] Word count is always 200–400.
- [ ] Edits are still there after a page reload.
- [ ] A free user can generate 1 letter, then sees the upgrade message.
