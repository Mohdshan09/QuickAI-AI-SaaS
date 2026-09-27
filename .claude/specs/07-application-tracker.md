# 07 — Application tracker

**Free for everyone** (5 jobs on the free plan, unlimited on premium, per spec 00). This is what keeps users coming back. Depends on [00-foundation](00-foundation.md); gets richer as specs 01–04 are built.

## User story
I see all the jobs I'm pursuing on one board: **Saved → Applied → Interviewing → Offer / Rejected**. Each card shows the company, the role, my latest match score and what I've prepared. I drag cards between columns as things change. Clicking a card opens everything for that job in one place.

## Board — `Frontend/src/pages/career/Jobs.jsx` → `/ai/jobs`
- 5 columns, one per `jobs.status`. The column header shows its count.
- **Card:**
  - company and role,
  - a match score badge (latest `match` output; red/amber/green like spec 01, or "Not checked"),
  - small icons showing which outputs exist: tailored resume, cover letter, interview prep,
  - "Added 3 days ago" / "Applied 5 days ago".
- **Moving cards:** drag and drop between columns with `@dnd-kit/core`. On mobile, a status dropdown on each card instead. Moving sends `PATCH /api/career/jobs/:id { status }`; the UI updates straight away and reverts with a toast if the request fails.
- **Add job:** a button opens a form with company, role, posting URL (optional) and posting text (required). After saving, go to the job's detail page and offer "Check your match now".
- **Empty state:** "Add the first job you're applying for", plus one example card.
- **Nudges on cards** (computed in the frontend, nothing stored):
  - Saved for more than 3 days with no match check → "Check your match".
  - Moved to Interviewing with no prep → "Prepare for interview".
  - Applied more than 10 days ago → "Follow up?"

## Job detail — `Frontend/src/pages/career/JobDetail.jsx` → `/ai/jobs/:id`
- **Header:** company, role, status dropdown, link to the posting, resume in use.
- **Tabs:** Match (01) · Tailored resume (02) · Cover letter (03) · Interview prep (04) · Posting (the saved description, editable).
- Tabs for premium features show a locked state with an upgrade button for free users.

## API changes (on top of spec 00)
- `GET /api/career/jobs` returns each job with `latest_score` and `has_outputs` (an array of the `kind`s it has), in **one query** with `LEFT JOIN LATERAL` over `job_outputs`, not one query per card.
- `PATCH /api/career/jobs/:id` sets `updated_at = NOW()` on every change. Status-change dates show on cards.
- A new migration, `004_job_status_history.sql`, adds `applied_at TIMESTAMPTZ` and `interviewing_at TIMESTAMPTZ` to `jobs`. The PATCH handler sets them the first time the job enters those statuses (these drive the "Follow up?" nudge).

## Dashboard link
On `/ai` (`Frontend/src/pages/Dashboard.jsx`), add a row above the creation sections: jobs per status and the average match score, linking to `/ai/jobs`. It fits the "organised by category" layout already there.

## How to verify
- [ ] Dragging a card changes its status, and it survives a reload.
- [ ] A failed PATCH (e.g. backend stopped) moves the card back and shows a toast.
- [ ] Cards show the latest match score and correct output icons after running specs 01–04.
- [ ] The jobs list API makes one database query no matter how many jobs there are (check with a log of the query).
- [ ] Each nudge appears under its exact condition and not otherwise.
- [ ] A free user can't add a sixth job; the message offers an upgrade.
- [ ] On a phone-width screen, the board scrolls sideways and status can be changed with the dropdown.
