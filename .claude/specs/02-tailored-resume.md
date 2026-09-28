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


# in depth feature requirement

I would build it as an AI Resume Optimizer / Live Resume Tailor rather than letting Gemini rewrite the entire resume every time.

1. The user experience

Imagine this screen:

┌─────────────────────────────────────────────────────────────┐
│              AI Resume Tailor                               │
├───────────────────────┬─────────────────────────────────────┤
│ JOB DESCRIPTION       │ LIVE RESUME                         │
│                       │                                     │
│ [Paste JD here...]    │ John Doe                           │
│                       │ Software Engineer                   │
│                       │                                     │
│                       │ EXPERIENCE                          │
│                       │ ───────────────────                 │
│                       │ Software Developer                  │
│                       │                                     │
│                       │ Built REST APIs using Node.js...    │
│                       │                                     │
│                       │ [AI suggestion highlighted]         │
│                       │                                     │
│                       │ Skills                               │
│                       │ React • Node • PostgreSQL           │
│                       │                                     │
├───────────────────────┴─────────────────────────────────────┤
│ AI Suggestions                                              │
│                                                             │
│ ✓ Add "PostgreSQL" to Skills                                │
│ ✓ Strengthen backend experience                             │
│ ✓ Mention REST API development                              │
│ ⚠ Missing: Docker                                         │
│                                                             │
│ [Accept All]                    [Export Resume]              │
└─────────────────────────────────────────────────────────────┘

The important part is that AI doesn't blindly rewrite everything.

2. The architecture I recommend

Build it as a structured resume editor.

Don't store the resume as one giant string.

Convert it into something like:

{
  personal: {
    name: "John Doe",
    email: "...",
    phone: "..."
  },

  summary: "...",

  experience: [
    {
      company: "ABC",
      role: "Software Engineer",
      bullets: [
        "Built REST APIs using Node.js",
        "Worked with PostgreSQL"
      ]
    }
  ],

  skills: [
    "JavaScript",
    "React",
    "Node.js"
  ],

  education: [],
  projects: [],
  certifications: []
}

This is the foundation of the whole feature.

3. Don't ask Gemini to return HTML

This is a very important design decision.

Avoid:

"Rewrite my resume and give me HTML."

Instead ask Gemini to return structured edit operations.

For example:

{
  "changes": [
    {
      "section": "experience",
      "itemId": "exp_1",
      "type": "replace",
      "target": "Built APIs",
      "replacement": "Built scalable REST APIs using Node.js and PostgreSQL"
    }
  ]
}

Or:

{
  "changes": [
    {
      "section": "skills",
      "type": "add",
      "value": "PostgreSQL",
      "reason": "Required by job description"
    }
  ]
}

Now your application controls the resume.

Gemini provides suggestions, not the actual UI.

4. The AI pipeline

Your feature should work like this:

                 USER
                   │
                   ↓
             Paste Job
                   │
                   ↓
          Job Description
             Extraction
                   │
                   ↓
         Job Requirement JSON
                   │
                   │
Resume ────────────┤
                   ↓
          Resume + Job Analysis
                   │
                   ↓
          Generate Suggestions
                   │
                   ↓
         Structured Edit Operations
                   │
                   ↓
        Frontend applies changes
                   │
                   ↓
             Live Preview
5. First AI call: understand the job

When the user pastes:

We are looking for a Full Stack Developer...

Requirements:

React
Node.js
PostgreSQL
Docker
REST APIs
AWS

Don't immediately rewrite the resume.

First extract structured requirements:

{
  "role": "Full Stack Developer",

  "requiredSkills": [
    "React",
    "Node.js",
    "PostgreSQL",
    "Docker",
    "REST APIs"
  ],

  "preferredSkills": [
    "AWS"
  ],

  "responsibilities": [
    "Build REST APIs",
    "Develop frontend applications",
    "Deploy applications"
  ],

  "keywords": [
    "React",
    "Node.js",
    "PostgreSQL",
    "Docker",
    "AWS",
    "REST API"
  ]
}

This result can also be cached.

6. Second AI operation: compare resume vs JD

Now compare:

RESUME
        +
JOB REQUIREMENTS
        ↓
MATCH ENGINE

Result:

{
  "matchedSkills": [
    "React",
    "Node.js",
    "REST APIs"
  ],

  "missingSkills": [
    "Docker",
    "AWS"
  ],

  "weakAreas": [
    "PostgreSQL experience is present but not prominent"
  ],

  "keywordOpportunities": [
    "REST API",
    "PostgreSQL",
    "Docker"
  ]
}

This gives you the intelligence needed for the editor.

7. Third operation: generate edits

Now ask AI:

Based ONLY on information already present in the resume, suggest improvements that better align it with the job.

This restriction is very important.

Your AI should never invent:

❌ "Managed a team of 10 engineers"

if the user never said that.


Instead:

Existing:
"Built backend APIs."

Possible improvement:
"Built REST APIs using Node.js."


if Node.js and API development are actually supported by the user's resume.

8. Every suggestion should have a reason

This makes your product feel much more intelligent.

Example:

┌───────────────────────────────────────────┐
│ AI Suggestion                             │
├───────────────────────────────────────────┤
│ Replace                                   │
│                                           │
│ "Built backend APIs"                      │
│                                           │
│ with                                      │
│                                           │
│ "Built REST APIs using Node.js"           │
│                                           │
│ Reason                                    │
│ "REST APIs" and "Node.js" appear in the    │
│ job requirements.                         │
│                                           │
│ [Accept] [Reject]                          │
└───────────────────────────────────────────┘

This builds trust.

9. Live preview

This is where your feature becomes much more valuable.

Don't regenerate the entire PDF every time.

Create a Resume Document Model in React.

For example:

ResumeDocument
   │
   ├── PersonalInfo
   ├── Summary
   ├── Experience
   ├── Projects
   ├── Skills
   ├── Education
   └── Certifications

The preview renders this object.

When AI changes:

resume.experience[0].bullets[1]

your React UI immediately updates.

So:

AI suggestion
      ↓
State update
      ↓
React re-render
      ↓
Live resume preview

No PDF generation is required during editing.

10. Highlight AI changes

This is something I'd definitely implement.

Example:

Original:

Developed web applications using React.

AI suggestion:

Developed scalable web applications using React and REST APIs.

Show:

Developed scalable web applications
                    ↑
                 added

using React and REST APIs
             ↑
          optimized

You can visually distinguish:

Green → Added
Red → Removed
Yellow → Modified

The user can then decide:

Accept

or:

Reject

11. Never automatically overwrite the user's resume

Instead maintain:

Original Resume
      +
AI Suggestions
      ↓
User Decisions
      ↓
Final Resume

Internally:

{
  originalResume: {...},

  suggestions: [...],

  acceptedSuggestions: [...],

  rejectedSuggestions: [...],

  currentResume: {...}
}

This makes your system much safer.

12. Real-time does NOT mean Gemini on every keystroke

This is extremely important for your Gemini bill.

Don't do:

User types:

R
Re
Rea
Reac
React

→ Gemini
→ Gemini
→ Gemini
→ Gemini
→ Gemini

💀

Instead:

User changes job description
debounce 800–1500ms
        ↓
AI request

And ideally:

Analyze JD once
Job Description
      ↓
Extract requirements
      ↓
Cache result

Then use the structured requirements for subsequent operations.

13. Use a two-stage system

This is the architecture I'd recommend.

Stage 1 — Job Intelligence
Job Description
       ↓
Gemini
       ↓
JobProfile JSON

Cache it.

Stage 2 — Resume Optimization
Resume JSON
     +
JobProfile JSON
     ↓
Gemini
     ↓
Edit Suggestions

Then:

Suggestions
     ↓
React
     ↓
Live Preview

This prevents repeatedly sending the entire job description.

14. Your cache system becomes extremely useful here

You asked about caching earlier.

This feature is actually a perfect use case.

You can cache:

Job Description
        ↓
JobProfile

and:

Resume + JobProfile + PromptVersion
        ↓
Optimization Suggestions

So:

Same JD
+
Same Resume
+
Same AI configuration
=
Reuse suggestions

No Gemini call.

15. Your paid feature could be structured like this
Free
Paste job
        ↓
Basic match analysis
        ↓
See suggestions

But:

❌ Live AI optimization
❌ Export optimized resume
Paid
Paste Job
     ↓
AI analyzes
     ↓
Live optimization
     ↓
Accept/reject suggestions
     ↓
ATS optimization
     ↓
Formatting optimization
     ↓
Export PDF

That's a much clearer reason to pay.

16. Don't promise "beat ATS"

I'd position it as:

Optimize your resume for the specific job description.

Not:

"Guarantees ATS approval."

Your system can identify:

Keyword coverage
Skill alignment
Section relevance
Formatting issues
Missing job terminology
Experience relevance

But you can't guarantee an employer's ATS outcome.

17. Formatting optimization

This should be a separate AI capability.

For example:

Current:

Experience
Software Engineer

• Developed stuff
• Worked on backend
• Made APIs

AI can recommend:

Experience
Software Engineer

• Developed REST APIs using Node.js and Express.
• Designed PostgreSQL database schemas for application workflows.
• Built backend services supporting frontend applications.

But formatting itself should be handled by your application.

AI should output something like:

{
  "formattingSuggestions": [
    {
      "type": "section_order",
      "suggestion": "Move Skills above Projects"
    },
    {
      "type": "bullet_length",
      "targetId": "exp_1_bullet_2",
      "suggestion": "Shorten bullet"
    }
  ]
}

Your frontend applies the formatting.

18. The really good version

Eventually, your editor could show:

┌────────────────────────────────────────────────────────────┐
│ Job Match: 72% → 91%                                      │
├───────────────────┬────────────────────────────────────────┤
│ AI Suggestions    │ Resume                                 │
│                   │                                         │
│ ✓ Skills +3       │ John Doe                                │
│ ✓ Keywords +6    │ Software Engineer                       │
│ ✓ 4 bullets      │                                         │
│ ✓ Summary        │ SUMMARY                                 │
│                   │ ─────────                               │
│ Missing           │ Experienced software engineer...        │
│ ⚠ Docker         │                                         │
│ ⚠ AWS            │ EXPERIENCE                              │
│                   │                                         │
│ [Accept All]      │ • Built REST APIs using Node.js...      │
│                   │   ↑ AI modified                         │
│                   │                                         │
│                   │ SKILLS                                 │
│                   │ React | Node | PostgreSQL | Docker      │
└───────────────────┴────────────────────────────────────────┘

And at the top:

Before       After
 72%   →      91%

The score should be based on a transparent set of matching criteria, not presented as a guarantee of ATS success.

19. Technical architecture for your stack

Given your JavaScript + NeonDB + no ORM setup, I'd use:

Frontend
React / Next.js
        │
        ↓
Resume Editor State
        │
        ↓
Node.js API
        │
 ┌──────┴─────────┐
 ↓                ↓
NeonDB          Gemini

Database:

users
resumes
resume_versions

job_postings
job_profiles

optimization_sessions
optimization_suggestions

analysis_artifacts
analysis_usage
20. Optimization session

I would introduce a new concept called:

OptimizationSession

Example:

Session
------------------------------
id
user_id
resume_id
job_posting_id
resume_version
job_profile_version
status
created_at
updated_at

Then:

User
 ↓
Resume
 ↓
Job
 ↓
Optimization Session
 ↓
AI Suggestions
 ↓
Accepted Changes
 ↓
Final Resume

This is cleaner than mixing optimization state with your normal resume data.

21. Suggestions table

For example:

CREATE TABLE optimization_suggestions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    session_id UUID NOT NULL,

    section TEXT NOT NULL,

    target_id TEXT,

    suggestion_type TEXT NOT NULL,

    original_content TEXT,

    suggested_content TEXT,

    reason TEXT,

    status TEXT NOT NULL DEFAULT 'PENDING',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

Status:

PENDING
ACCEPTED
REJECTED

Now you can track exactly what the user changed.

22. The killer feature: "Optimize for this job"

Don't make users manually select:

keywords
skills
formatting
summary
experience

Give them one button:

✨ Optimize Resume for This Job

Then the AI produces:

Job understanding
       ↓
Resume comparison
       ↓
Suggestions
       ↓
Live preview
       ↓
User approval
       ↓
Final resume

That's a very understandable product.

23. One feature I'd add later

After the user accepts changes:

Why did you make these changes?

The system can show:

Your original resume
        ↓
Job requirements
        ↓
Changes made
        ↓
Why they matter

For example:

Added PostgreSQL to your Skills section because it appears as a required skill in the job description and is already supported by your project experience.

This turns your SaaS from a "resume generator" into an AI career assistant.

The core principle

Build the editor around structured data + AI edit operations, not around AI-generated HTML/PDF.

Resume JSON
      +
Job Profile JSON
      ↓
Gemini
      ↓
Structured Suggestions
      ↓
User Accept / Reject
      ↓
React Resume State
      ↓
Live Preview
      ↓
PDF Export

That architecture will give you real-time UX, control over hallucinations, accept/reject editing, caching, version history, and much better Gemini cost control.
