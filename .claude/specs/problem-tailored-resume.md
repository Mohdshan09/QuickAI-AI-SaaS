# Quick.AI Resume Optimizer

## Problems & Proposed Solutions

## 1. Problem Statement

The current AI resume optimization flow generates a new resume from the user's existing resume and job description.

The main problem is that the AI-generated resume can preserve much of the original information while still producing a worse final document.

The current output shows problems in:

* Resume formatting
* Section hierarchy
* Spacing
* Pagination
* Bullet formatting
* Content control
* AI-generated changes
* User control over changes
* PDF rendering
* Re-checking the optimized resume

The goal is **not to generate a completely new resume from scratch**.

The goal is:

> **Take the user's existing resume, understand the target job, suggest useful changes, let the user control those changes, and produce a professional optimized version without losing the original resume's structure or facts.**

---

# 2. Current Problems

## Problem 1 — AI Rebuilds the Entire Resume

### Current behavior

The current approach is close to:

```text
Original Resume
      ↓
Job Description
      ↓
Gemini
      ↓
New Resume
      ↓
PDF
```

This gives Gemini too much control.

The AI can unintentionally change:

* Content
* Structure
* Formatting
* Section order
* Spacing
* Page breaks
* Wording
* Resume length

### Solution

Gemini should act as a **resume editor**, not the resume renderer.

New flow:

```text
Original Resume
      +
Job Description
      ↓
Gemini
      ↓
Structured Suggestions
      ↓
User Accept / Reject
      ↓
Updated Resume JSON
      ↓
Resume Renderer
      ↓
PDF
```

Gemini should return structured changes instead of a complete HTML/PDF resume.

---

# 3. Problem — Resume Formatting Gets Worse

The generated resume can lose the visual hierarchy of the original document.

Important elements can become visually similar:

* Section headings
* Company names
* Job titles
* Dates
* Bullet points
* Project names
* Education
* Certifications

This makes the resume harder to scan.

### Solution

The application should own all formatting.

Gemini should never control:

* Font
* Font size
* Margins
* Line height
* Section spacing
* Bullet indentation
* Date alignment
* Page breaks
* Header layout

Create a deterministic resume renderer.

```text
Resume JSON
     ↓
Resume Template
     ↓
React Renderer
     ↓
Browser Preview
     ↓
PDF
```

The preview and PDF should use the same renderer.

---

# 4. Problem — Browser/PDF Metadata Appears in the Resume

The generated PDF currently contains information such as:

```text
9/28/26, 3:43 PM
Quick.AI - MohammadShan

localhost:5173/ai/jobs/11/print?resumeId=3
```

This is not part of the user's resume and should never appear in the exported document.

### Solution

The PDF generation system must explicitly disable browser headers and footers.

The final PDF should contain only the resume.

Remove:

* Browser URL
* Timestamp
* Page title
* Application route
* Browser-generated headers
* Browser-generated footers

---

# 5. Problem — AI Changes Are Not Transparent

A user should not have to trust that the AI made the correct changes.

For example, if the AI changes:

```text
Original:

Built REST APIs with Node.js and Express.js.
```

to:

```text
Built scalable REST APIs using Node.js and Express.js.
```

the user should be able to see:

* What changed
* Why it changed
* Which job requirement it matches

### Solution

Show every AI change as a suggestion.

Example:

```text
AI Suggestion

Original:
Built REST APIs with Node.js and Express.js.

Suggested:
Built scalable REST APIs using Node.js and Express.js.

Reason:
The job description emphasizes REST API development
and Node.js backend experience.

Matched keywords:
Node.js
REST APIs
Express.js

[Reject] [Accept]
```

---

# 6. Problem — AI Can Invent Information

Resume optimization must never create fake experience.

The AI should not add:

* Skills the user does not have
* Companies
* Job responsibilities
* Technologies
* Certifications
* Metrics
* Projects
* Job titles
* Achievements

For example:

If the job description contains:

```text
Kubernetes
Terraform
AWS
```

but the resume does not contain evidence of these skills, the AI must not simply add them.

### Solution

Implement a strict factual constraint:

> AI may only optimize, reorganize, or rewrite information supported by the user's resume.

If a job requirement is missing:

```text
Missing Skill

Kubernetes

This skill appears in the job description but
was not found in your resume.

[Do not add]
```

The system can identify the gap without fabricating experience.

---

# 7. Problem — Entire Resume Gets Rewritten Even When Only One Section Needs Changes

Not every job requires changes to the entire resume.

For example:

```text
Job Description
      ↓
Requires:
React
Next.js
TypeScript
```

The user's resume may already contain these skills.

Only a few experience bullets may need optimization.

### Solution

Use targeted changes.

Example:

```json
{
  "changes": [
    {
      "section": "experience",
      "itemId": "exp_1",
      "type": "replace",
      "original": "Built APIs using Node.js.",
      "suggested": "Built REST APIs using Node.js and Express.js.",
      "reason": "Better matches the job's backend API requirement."
    }
  ]
}
```

Do not regenerate the complete resume.

---

# 8. Problem — No Structured Resume Model

A resume should not be stored only as raw text.

### Solution

Convert the resume into structured JSON.

Example:

```json
{
  "personal": {
    "name": "Mohammad Shan",
    "email": "shanshaikh880@gmail.com",
    "phone": "+919109462934",
    "location": "PCMC, Pune",
    "linkedin": "..."
  },

  "summary": "...",

  "skills": {
    "languages": [],
    "frameworks": [],
    "databases": [],
    "concepts": []
  },

  "experience": [
    {
      "id": "exp_1",
      "company": "Zidio Development",
      "role": "Full Stack Developer Intern",
      "startDate": "Mar 2025",
      "endDate": "May 2025",
      "bullets": []
    }
  ],

  "projects": [],

  "education": [],

  "certifications": [],

  "publications": []
}
```

This becomes the source of truth.

---

# 9. Problem — No Accept/Reject Workflow

The user currently receives an AI-generated result instead of controlling individual modifications.

### Solution

Every AI suggestion should have a state:

```text
PENDING
ACCEPTED
REJECTED
```

Example:

```text
Suggestion 1
Status: ACCEPTED

Suggestion 2
Status: REJECTED

Suggestion 3
Status: PENDING
```

The user should be able to:

```text
[Accept]
[Reject]
```

for each suggestion.

Also provide:

```text
Accept All
Reject All
```

---

# 10. Problem — Original Resume Can Be Lost

The optimized resume should never overwrite the original resume.

### Solution

Use resume versions.

```text
Resume
│
├── Version 1
│   Original
│
├── Version 2
│   Optimized for Job A
│
└── Version 3
    Optimized for Job B
```

The original resume must remain unchanged.

This allows the user to create multiple job-specific versions.

---

# 11. Problem — Live Preview Should Not Require Gemini

"Live AI" should not mean sending a Gemini request every time the user changes something.

Bad implementation:

```text
User types
   ↓
Gemini
   ↓
Render

User types again
   ↓
Gemini
   ↓
Render
```

This increases:

* API cost
* Latency
* Duplicate requests
* Poor UX

### Solution

Use React state for live editing.

```text
Resume JSON
     ↓
React State
     ↓
Live Preview
```

When the user accepts a suggestion:

```javascript
setResume(updatedResume);
```

The preview updates immediately.

Gemini is only called when actual AI reasoning is required.

---

# 12. Problem — Job Description Analysis Gets Repeated

The same job description may be analyzed multiple times.

### Solution

Create a reusable Job Profile.

```text
Job Description
      ↓
Normalize
      ↓
SHA-256 Hash
      ↓
Check Cache
      ↓
Job Profile
```

Example:

```json
{
  "role": "Full Stack Developer",
  "requiredSkills": [
    "React",
    "Node.js",
    "PostgreSQL"
  ],
  "preferredSkills": [
    "AWS",
    "Docker"
  ],
  "keywords": [
    "REST API",
    "authentication",
    "CI/CD"
  ]
}
```

The same Job Profile can be reused.

---

# 13. Problem — AI Cost Can Increase With Repeated Optimization

Vercel serverless functions should not be treated as a reliable in-memory cache.

Do not depend on:

```javascript
const cache = new Map();
```

because the cache can disappear when the serverless instance is recreated.

### Solution

Use Neon PostgreSQL as the persistent cache.

Recommended cache key:

```text
resumeHash
+
jobHash
+
model
+
promptVersion
+
analysisVersion
+
schemaVersion
```

Hash the combined value using SHA-256.

Example:

```text
cacheKey =
SHA256(
  resumeHash +
  jobHash +
  model +
  promptVersion +
  analysisVersion +
  schemaVersion
)
```

Store reusable AI results in PostgreSQL.

---

# 14. Problem — Duplicate Gemini Requests

Two users can request the same uncached analysis at almost the same time.

Without protection:

```text
User A → Cache Miss → Gemini
User B → Cache Miss → Gemini
```

This produces unnecessary Gemini usage.

### Solution

Use PostgreSQL locking.

Recommended approach:

```text
Request
   ↓
Check Cache
   ↓
Cache Miss
   ↓
Acquire PostgreSQL Advisory Lock
   ↓
Check Cache Again
   ↓
Still Missing?
   ↓
Gemini
   ↓
Save Result
   ↓
Release Lock
```

The second cache check is required.

---

# 15. Problem — No Clear Before/After Result

The user needs to understand whether optimization actually helped.

### Solution

Add the close-the-loop re-check.

```text
Initial Resume
      ↓
Match Analysis
      ↓
Score: 62
      ↓
AI Suggestions
      ↓
Accept Changes
      ↓
Create New Resume Version
      ↓
Re-run Match
      ↓
Score: 81
```

Show the changes clearly.

Example:

```text
Resume Match

Before       After

62%          81%

Keywords
7            11

Skills
6/10         9/10
```

The score should be presented as **Quick.AI's resume match score**, not as a guarantee of how an actual ATS will score the resume.

---

# 16. Problem — No Clear Difference Between Content Optimization and Formatting

The system should separate two different jobs.

### Content optimization

Handled by AI:

```text
Keywords
Experience wording
Skill relevance
Bullet improvements
Summary optimization
Job-specific emphasis
```

### Formatting optimization

Handled by the application:

```text
Font
Spacing
Margins
Section hierarchy
Bullet layout
Dates
Page breaks
Template
PDF rendering
```

This separation prevents AI from destroying the resume design.

---

# 17. Proposed V1 Architecture

```text
                         USER
                           │
                           ▼
                  Upload Resume / PDF
                           │
                           ▼
                    Resume Parser
                           │
                           ▼
                     Resume JSON
                           │
                           │
              ┌────────────┴────────────┐
              │                         │
              ▼                         ▼
       Resume Cache              Original Resume
              │
              │
              ▼
       Paste Job Description
              │
              ▼
         Normalize JD
              │
              ▼
           Job Hash
              │
              ▼
       Job Profile Cache
              │
              ▼
       Resume + Job Profile
              │
              ▼
            Gemini
              │
              ▼
      Structured Suggestions
              │
        ┌─────┴─────┐
        │           │
        ▼           ▼
      Accept      Reject
        │
        ▼
    Updated Resume
        │
        ▼
    React State
        │
        ▼
    Live Preview
        │
        ▼
  Save New Resume Version
        │
        ▼
    Re-run Match
        │
        ▼
 Before / After Score
        │
        ▼
      PDF Export
```

---

# 18. Suggested Database Structure

The initial system can use PostgreSQL without an ORM.

## resumes

```text
id
user_id
name
created_at
updated_at
```

## resume_versions

```text
id
resume_id
version_number
resume_json
source
created_at
```

Possible `source` values:

```text
ORIGINAL
AI_OPTIMIZED
USER_EDITED
```

## job_postings

```text
id
user_id
title
raw_description
normalized_description
job_hash
created_at
```

## job_profiles

```text
id
job_hash
profile_json
model
prompt_version
created_at
```

## optimization_sessions

```text
id
user_id
resume_id
resume_version_id
job_posting_id
status
created_at
updated_at
```

## optimization_suggestions

```text
id
session_id
section
target_id
suggestion_type
original_content
suggested_content
reason
matched_keywords
status
created_at
```

Possible status:

```text
PENDING
ACCEPTED
REJECTED
```

## analysis_artifacts

```text
id
cache_key
resume_hash
job_hash
model
prompt_version
analysis_version
schema_version
result
input_tokens
output_tokens
estimated_cost
created_at
expires_at
```

---

# 19. V1 Product Flow

The user experience should be:

### Step 1 — Upload Resume

```text
Upload Resume
      ↓
Parse
      ↓
Resume Preview
```

### Step 2 — Paste Job Description

```text
Paste Job Description
      ↓
Analyze Job
```

### Step 3 — Show Match

```text
Resume Match: 62%

Matched:
✓ React
✓ Node.js
✓ PostgreSQL

Missing:
○ Docker
○ AWS
```

### Step 4 — Optimize

```text
Optimize Resume
```

AI generates targeted suggestions.

### Step 5 — Review Suggestions

```text
3 Suggestions

[Accept] Improve experience bullet
[Reject] Change summary
[Accept] Reorder skills
```

### Step 6 — Live Preview

The resume updates immediately.

### Step 7 — Save Version

```text
Save as:

"Full Stack Developer - Company X"
```

### Step 8 — Re-check

```text
Before: 62%
After: 81%
```

### Step 9 — Export

```text
Download PDF
```

---

# 20. V1 Priorities

Implement in this order.

## P0 — Critical

* Structured Resume JSON
* Stable resume renderer
* Professional PDF generation
* Remove browser metadata
* Preserve original resume
* Job description analysis
* Structured Gemini suggestions
* Accept / Reject changes

## P1 — Core Product

* Live preview
* Resume versioning
* Job Profile caching
* Optimization caching
* Match re-check
* Before/after comparison
* PDF export

## P2 — Cost & Reliability

* SHA-256 cache keys
* PostgreSQL cache
* PostgreSQL advisory locks
* Idempotency keys
* Gemini token tracking
* Estimated AI cost tracking
* Cache hit tracking

---

# 21. What Gemini Should Return

Gemini should return structured JSON similar to:

```json
{
  "summary": {
    "overallAssessment": "...",
    "matchAreas": [],
    "gaps": []
  },

  "changes": [
    {
      "id": "change_001",
      "section": "experience",
      "targetId": "exp_001",
      "type": "replace",
      "originalContent": "...",
      "suggestedContent": "...",
      "reason": "...",
      "matchedKeywords": [
        "Node.js",
        "REST APIs"
      ]
    }
  ],

  "missingSkills": [
    {
      "skill": "Docker",
      "reason": "Required by the job description but not supported by the resume."
    }
  ]
}
```

Gemini must return **data**, not HTML.

---

# 22. Final Product Principle

The most important architectural rule for the Resume Optimizer is:

```text
AI decides WHAT should change.
Application decides HOW it should look.
User decides WHETHER the change is accepted.
```

Therefore:

```text
Gemini
  ↓
What should change?
        ↓
Quick.AI
  ↓
How should it be rendered?
        ↓
User
  ↓
Should this change be accepted?
```

This keeps the resume:

* Factually grounded
* User-controlled
* Consistent
* Professional
* Editable
* Cacheable
* Cost-efficient
* Exportable

The objective is not to create a completely different AI-generated resume.

> **Quick.AI should make the user's existing resume more relevant to a specific job while preserving the user's actual experience and a professional resume layout.**
