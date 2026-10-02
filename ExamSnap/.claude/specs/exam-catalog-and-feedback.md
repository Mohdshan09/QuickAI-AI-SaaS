# ExamSnap — Exam Catalog, Community Specs & Feedback Loop

**Status:** Draft v1
**Applies to:** Launch (verified catalog + unlisted flow) and ongoing operations
**New dependency:** a minimal backend (Vercel serverless functions + NeonDB, raw SQL, no ORM)
**Privacy rule (unchanged):** no images, no names, no personal data ever leave the device. The backend stores only exam names, spec numbers, outcomes and anonymous IDs.

---

## 1. Goals

1. Launch with a small set of **fully verified** exams instead of many placeholder specs
2. Let users process **any** exam through Custom mode, and learn from what they enter
3. Use real outcomes ("the portal accepted my file") as evidence for which specs work
4. Catch wrong or outdated specs quickly through rejection reports
5. Turn demand data into a simple weekly routine: verify the most requested exams next

### Key principle
**Verification comes from outcomes and official notifications, never from entries alone.** A user-entered spec never becomes a preset automatically.

---

## 2. Launch catalog

- Launch with **3–4 verified exams**, chosen by search demand, e.g. SSC CGL, SSC GD, one IBPS exam, RRB NTPC
- Each verified exam has: official notification link, page number noted, `lastVerified` date
- All placeholder/unverified specs from Phase 1 are **removed** from the catalog, prerendering and sitemap
- Verified specs stay in the static `exams.json` (needed for build-time SEO prerendering and offline use)
- Promoting an exam to verified = add it to `exams.json` and redeploy

---

## 3. Exam statuses

| Status | How it gets there | Visible to users | SEO page |
|---|---|---|---|
| `requested` | Someone typed the name | No (demand list only) | No |
| `community` | Meets promotion rules (section 6) | Yes, with label "Reported working by N users" and a "not officially verified" note | No |
| `verified` | Owner checked the official notification | Yes, normal preset | Yes |
| `flagged` | Rejection reports exceed threshold | Community: hidden. Verified: shown with "Under review" note | Verified keeps page with notice |

---

## 4. User flow

### 4.1 Search
- **FR-C1** Single search box with autocomplete.
- **FR-C2** Verified exams come from local `exams.json` (works offline). Community exams come from the API (online only).
- **FR-C3** Fuzzy matching and "Did you mean SSC CGL?" suggestions to avoid duplicates (`ssc cgl`, `SSC-CGL 2026`, `cgl`).
- **FR-C4** Results show status clearly: verified badge vs community label.

### 4.2 Unlisted exam
- **FR-C5** If nothing matches: "Not listed? Enter the exam name" → free-text name.
- **FR-C6** Opens Custom mode: per document, user enters width, height, min KB, max KB. Optional field: link to the official notification.
- **FR-C7** Inline help: "Find these in the 'How to apply' section of the official notification."
- **FR-C8** Processing works exactly like a listed exam.
- **FR-C9** On download, send an exam request + spec submission to the API (section 7). If offline, queue in IndexedDB and send when back online.

### 4.3 Community exam
- **FR-C10** Selecting a community exam pre-fills Custom mode with the community spec. User can edit values before processing.
- **FR-C11** Clear note: "These sizes are reported by other users and not officially verified. Check your notification."

---

## 5. Name normalization

```
normalize(name):
  lowercase
  replace punctuation and hyphens with space
  remove year tokens (e.g. 2025, 2026) and words like "exam", "recruitment", "notification"
  collapse spaces, trim
```

- `exam_aliases` table maps normalized aliases to one exam (`cgl` → SSC CGL)
- Fuzzy matching with the `pg_trgm` extension (available on Neon) for API-side suggestions
- Unmatched names are grouped by normalized name in the demand list

---

## 6. Promotion and demotion rules

All thresholds are config values, tuned over time.

### Spec identity
Submissions match when every document has identical width, height, min KB and max KB. Store a `spec_hash` of the normalized values.

### Requested → Community
All of:
- At least **3 distinct submitters** with the same `spec_hash`
- At least **3 "accepted" outcomes** for that `spec_hash`
- Rejection rate for that `spec_hash` below **20%**

If multiple spec hashes exist for one exam, only the one meeting the rules is promoted.

### Community → Verified
Manual only. Owner checks the official notification (the submitted notification links help), then adds the exam to `exams.json`.

### Demotion / flagging
- Community spec: rejection rate above **30%** with at least **3 rejections** → `flagged`, hidden from search
- Verified spec: **3+ rejections within 7 days** → `flagged`, owner alerted, exam shown with "Under review"

---

## 7. Backend

### 7.1 Hosting
- Vercel serverless functions in the ExamSnap project (`ExamSnap/api/`)
- Add a rewrite in ExamSnap's `vercel.json`: `/examsnap/api/:path*` → `/api/:path*` (requests arrive via the Quick AI proxy under `/examsnap/`)
- Same origin as the app, so the CSP `connect-src 'self'` stays strict
- NeonDB via `@neondatabase/serverless` (suits serverless functions), parameterized queries only

### 7.2 Endpoints

| Method | Path | Body / query | Purpose |
|---|---|---|---|
| GET | `/api/exams/search` | `q` | Community exams + suggestions |
| POST | `/api/exam-requests` | `name` | Record demand |
| POST | `/api/spec-submissions` | `examName`, `documents[]`, `notificationUrl?` | Record custom spec |
| POST | `/api/outcomes` | `examRef`, `specHash`, `result`, `documentType?`, `portalError?` | Accepted / rejected report |
| POST | `/api/quality-feedback` | `examRef`, `documentType`, `rating` | Thumbs up/down at download |

`examRef` is an exam id (listed exams) or normalized name (unlisted).

### 7.3 Schema (SQL)

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE exams (
  id            SERIAL PRIMARY KEY,
  slug          TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL,
  normalized    TEXT UNIQUE NOT NULL,
  status        TEXT NOT NULL CHECK (status IN ('requested','community','verified','flagged')),
  spec          JSONB,                 -- promoted community spec
  spec_hash     TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX exams_normalized_trgm ON exams USING gin (normalized gin_trgm_ops);

CREATE TABLE exam_aliases (
  alias_normalized TEXT PRIMARY KEY,
  exam_id          INT REFERENCES exams(id) ON DELETE CASCADE
);

CREATE TABLE exam_requests (
  id            BIGSERIAL PRIMARY KEY,
  raw_name      TEXT NOT NULL CHECK (length(raw_name) <= 120),
  normalized    TEXT NOT NULL,
  exam_id       INT REFERENCES exams(id),
  anon_id       TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX exam_requests_normalized ON exam_requests (normalized);

CREATE TABLE spec_submissions (
  id               BIGSERIAL PRIMARY KEY,
  normalized       TEXT NOT NULL,
  exam_id          INT REFERENCES exams(id),
  documents        JSONB NOT NULL,      -- [{type,width,height,minKb,maxKb}]
  spec_hash        TEXT NOT NULL,
  notification_url TEXT CHECK (length(notification_url) <= 500),
  anon_id          TEXT NOT NULL,
  created_at       TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX spec_submissions_hash ON spec_submissions (normalized, spec_hash);

CREATE TABLE outcomes (
  id             BIGSERIAL PRIMARY KEY,
  normalized     TEXT NOT NULL,
  exam_id        INT REFERENCES exams(id),
  spec_hash      TEXT NOT NULL,
  result         TEXT NOT NULL CHECK (result IN ('accepted','rejected')),
  document_type  TEXT,
  portal_error   TEXT CHECK (length(portal_error) <= 300),
  anon_id        TEXT NOT NULL,
  created_at     TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX outcomes_hash ON outcomes (normalized, spec_hash, result);

CREATE TABLE quality_feedback (
  id             BIGSERIAL PRIMARY KEY,
  exam_ref       TEXT NOT NULL,
  document_type  TEXT NOT NULL,
  rating         SMALLINT NOT NULL CHECK (rating IN (-1, 1)),
  anon_id        TEXT NOT NULL,
  created_at     TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE rate_limits (
  key          TEXT NOT NULL,           -- hashed IP + endpoint
  window_start TIMESTAMPTZ NOT NULL,
  count        INT NOT NULL DEFAULT 1,
  PRIMARY KEY (key, window_start)
);
```

Use plain SQL migration files (node-pg-migrate or dbmate).

### 7.4 Anonymous ID
- Random UUID generated on first visit, stored in `localStorage`
- Used only to count **distinct submitters** for promotion rules
- Not linked to any account, IP, name or device identifier

### 7.5 Abuse protection
- **Rate limit:** per hashed IP per endpoint (e.g. 20 writes/hour). Hash the IP with a secret salt; never store raw IPs.
- **Validation (server-side):** width/height 50–3000 px, KB 1–5000, `minKb ≤ maxKb`, text length limits, notification URL must be `https://`
- **Honeypot field** in forms; silently drop submissions that fill it
- **Promotion requires distinct anon IDs and outcomes**, so a single person cannot promote a spec alone
- Outcome reports only accepted for a `spec_hash` the same anon ID actually processed (recorded locally at download)

### 7.6 Promotion job
- Vercel Cron (daily) runs the promotion and flagging rules (section 6) in SQL
- Writes status changes to `exams` and sends the owner an email or Telegram message for new community promotions and any flagged exam

---

## 8. Feedback loop

### 8.1 At download (quality)
- **FR-F1** After download: "Does this look right?" 👍 / 👎
- **FR-F2** 👎 opens optional quick reasons: blurry, too dark, cropped wrong, background not white, other

### 8.2 On next visit (outcome)
- **FR-F3** On download, store locally: `{ examRef, specHash, documentTypes, downloadedAt }`
- **FR-F4** On a later visit between 1 hour and 14 days after download, show: "Did the SSC CGL portal accept your files?" **Yes / No / Haven't uploaded yet**
- **FR-F5** "No" opens the rejection form: which document, portal error message (free text, max 300 chars, with a note not to include personal details)
- **FR-F6** "Haven't uploaded yet" asks again on the next visit; after two dismissals, stop asking
- **FR-F7** Clear the stored record once answered

### 8.3 Always available
- **FR-F8** "File rejected?" link on every exam page and in the footer, opening the same rejection form

### 8.4 What users see after reporting
- **FR-F9** Rejection reported → show the official notification link, suggest the checker mode, and say "Thanks, we'll review this exam's sizes."

---

## 9. Owner workflow (weekly routine)

1. Check flagged exams first (verified exams under review take priority)
2. Open the demand list: requested exams sorted by distinct requesters in the last 30 days
3. Verify the top 2–3 using the official notification (submitted notification links help)
4. Add verified exams to `exams.json`, redeploy, confirm the new SEO pages
5. Check new official notifications for already-verified exams and update `lastVerified`
6. Review rejection messages for patterns (e.g. one portal rejects grayscale)

Start with SQL queries saved in a `queries/` folder. A simple admin page can come later.

### Useful queries
- Demand list: `exam_requests` grouped by `normalized`, count distinct `anon_id`, last 30 days
- Spec consensus: `spec_submissions` grouped by `normalized, spec_hash`, count distinct `anon_id`
- Outcome health: `outcomes` grouped by `normalized, spec_hash, result`

---

## 10. Privacy

- Backend stores: exam names, spec numbers, notification links, outcomes, short portal error text, anonymous IDs, hashed IPs for rate limiting
- Backend never stores: images, user names, raw IPs, emails, device identifiers
- Privacy policy updated to describe exactly this
- Anonymous ID can be reset by clearing site data; mention this in the privacy policy

---

## 11. Metrics

| Metric | Purpose |
|---|---|
| Requests per unlisted exam (distinct users) | What to verify next |
| Custom mode usage vs listed exam usage | How much the catalog covers |
| Acceptance rate per verified exam | Spec health |
| Outcome response rate | Whether the next-visit prompt works |
| 👍 / 👎 ratio per document type | Quality issues by document |
| Time from first request to verified | Speed of the weekly routine |

---

## 12. Acceptance criteria

- [ ] Only verified exams are prerendered and in the sitemap
- [ ] Unlisted exam name + custom spec recorded on download; queued and sent later when offline
- [ ] Name variants (`ssc cgl`, `SSC-CGL 2026`, `cgl`) resolve to the same exam
- [ ] A spec reaches `community` only when all promotion rules pass, with distinct anon IDs
- [ ] One anon ID submitting repeatedly cannot promote a spec
- [ ] Community exams are clearly labeled and editable before processing
- [ ] Verified exam with 3+ rejections in 7 days is flagged and the owner is notified
- [ ] Next-visit outcome prompt appears once in the 1 hour – 14 day window and stops after answer or two dismissals
- [ ] Rate limits and server-side validation reject bad input
- [ ] No image data, names or raw IPs in any table (verified by inspecting the database)
- [ ] CSP still restricts network requests to the same origin

---

## 13. Risks

| Risk | Mitigation |
|---|---|
| Wrong user-entered specs spread to others | Never auto-promote to verified; community needs matching specs + accepted outcomes; clear labels |
| Fake submissions to promote a spec | Distinct anon IDs, outcome requirement, rate limits, owner notified on every promotion |
| Low outcome response rate | Next-visit prompt plus permanent "File rejected?" link; tune timing |
| Users paste personal details in error text | Length limit, warning near the field, owner can delete entries |
| Backend breaks the privacy claim | Strict schema, no image endpoints, privacy policy states exactly what is stored |
| Weekly routine slips | Demand list and flagged list as saved queries; owner alerts for flags |
