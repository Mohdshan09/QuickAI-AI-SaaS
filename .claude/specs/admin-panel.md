# Admin Module — V1 Requirements

## 1. Objective

Build a production-ready **Admin Module V1** for the AI SaaS.

The Admin Module should allow administrators to monitor and manage:

* Users
* User activity
* AI usage
* AI service usage
* AI model usage
* Token consumption
* AI cost
* Credits
* Usage limits
* Failed AI requests
* System activity
* Admin actions

The primary goal is to give the admin a clear answer to:

> **Who is using the platform, what are they using, how much AI are they consuming, and how much does that usage cost?**

---

# 2. V1 Architecture Principle

V1 must remain simple.

### Do NOT introduce Redis or any external caching infrastructure.

Do not add:

* Redis
* Redis cache
* Redis-based rate limiting
* Redis-based session storage
* Redis queues
* Redis cache analytics
* Any external cache service

All persistent application data must use the existing PostgreSQL/NeonDB database.

The architecture should remain:

```text
User
  ↓
Application Service
  ↓
AI Service Layer
  ↓
Gemini
  ↓
Usage Tracking
  ↓
PostgreSQL
  ↓
Admin Analytics
```

The system should be designed so that a caching layer can be added in a future version without rewriting the individual AI services.

---

# 3. Core Architecture Principle

Every AI operation must be tracked through one centralized AI service/usage layer.

Do NOT implement independent usage tracking inside each feature.

Examples of AI features:

```text
Resume Parsing
Job Description Analysis
Resume Optimization
Resume Re-check
Cover Letter Generation
AI Interview
Other AI Features
```

All of them must eventually go through:

```text
Application Feature
      ↓
AI Service Layer
      ↓
AI Provider
      ↓
Usage Tracking
      ↓
Cost Calculation
      ↓
PostgreSQL
```

This ensures that every AI request is accounted for consistently.

---

# 4. Admin Dashboard

Create an Admin Dashboard showing an overall system summary.

## KPI Cards

### Users

* Total users
* Active users
* New users today
* New users this week
* New users this month
* Suspended users

### AI Usage

* Total AI requests
* Successful requests
* Failed requests
* Total tokens
* Average tokens/request

### AI Cost

* Total AI cost
* Cost today
* Cost this week
* Cost this month
* Average cost/request
* Average cost/user

### Credits

* Total credits consumed
* Credits remaining
* Users approaching limits
* Users exceeding limits

---

# 5. Usage Overview

Provide usage analytics over time.

Supported filters:

* Today
* Last 7 days
* Last 30 days
* Last 90 days
* Custom date range

## AI Requests

Display:

* Requests per day
* Successful requests
* Failed requests

## Token Usage

Display:

* Input tokens
* Output tokens
* Total tokens

## AI Cost

Display:

* Daily cost
* Weekly cost
* Monthly cost

## Active Users

Display:

* Daily active users
* Weekly active users
* Monthly active users

---

# 6. AI Service Usage

Track usage separately for each AI service.

Initial services:

```text
RESUME_PARSING
JOB_DESCRIPTION_ANALYSIS
RESUME_OPTIMIZATION
RESUME_RECHECK
COVER_LETTER
AI_INTERVIEW
OTHER
```

The service list should be centralized and configurable.

For each service display:

* Total requests
* Successful requests
* Failed requests
* Unique users
* Input tokens
* Output tokens
* Total tokens
* Total cost
* Average cost/request
* Average response time

Example:

```text
Resume Optimization

Requests:        1,248
Successful:      1,231
Failed:             17

Input Tokens:    1.2M
Output Tokens:   320K
Total Tokens:    1.52M

AI Cost:         $4.82
Avg Cost/Req:    $0.0038
```

---

# 7. AI Model Usage

Track usage by AI provider and model.

Example:

```text
Provider    Model       Requests    Tokens    Cost
Gemini      Model A       2,430      4.2M    $8.31
Gemini      Model B         820      1.1M    $2.42
```

For every model track:

* Provider
* Model
* Requests
* Successful requests
* Failed requests
* Input tokens
* Output tokens
* Total tokens
* Cost
* Average cost/request
* Average latency

---

# 8. AI Model Pricing

AI pricing must NOT be hardcoded throughout the application.

Maintain centralized pricing configuration.

Example:

```text
Provider: Gemini
Model: gemini-model-name

Input Price:
$X / 1M tokens

Output Price:
$Y / 1M tokens

Effective From:
YYYY-MM-DD
```

When calculating historical costs, store the pricing information used for that request.

This prevents historical reports from changing when provider pricing changes later.

---

# 9. AI Request Log

Every AI request must create an AI usage record.

Suggested fields:

```text
requestId
userId
service
provider
model

status

startedAt
completedAt
durationMs

inputTokens
outputTokens
totalTokens

inputCost
outputCost
totalCost

promptVersion
analysisVersion
schemaVersion

errorCode
errorMessage
```

Do not store sensitive prompts or complete AI responses by default.

The request log is primarily for:

* Usage tracking
* Cost tracking
* Debugging
* Monitoring
* Analytics
* Billing/credit accounting

---

# 10. AI Request Details

Admin should be able to open an individual AI request.

Display:

## Request Information

* Request ID
* User
* Service
* Timestamp
* Status
* Duration

## AI Information

* Provider
* Model
* Prompt version
* Analysis version
* Schema version

## Token Information

* Input tokens
* Output tokens
* Total tokens

## Cost

* Input cost
* Output cost
* Total cost

## Error

For failed requests:

* Error code
* Error category
* Sanitized error message

Never expose:

* API keys
* Authentication tokens
* Provider secrets

---

# 11. User Management

Create an admin user management page.

Display:

```text
User
Email
Created At
Last Active
Status
Plan
Credits Used
Credits Remaining
AI Requests
AI Cost
```

Support:

* Search
* Pagination
* Sorting
* Filtering

Search by:

* Name
* Email
* User ID

Filters:

* Active
* Inactive
* Suspended
* Free
* Paid
* High usage
* High cost
* Near quota

---

# 12. User Activity

Create a user activity timeline.

Example:

```text
10:32 AM
Resume uploaded

10:33 AM
Resume parsed

10:34 AM
Job description analyzed

10:35 AM
Resume optimization requested

10:35 AM
Optimization completed

10:36 AM
PDF exported
```

Track application-level events such as:

```text
USER_REGISTERED
USER_LOGIN

RESUME_CREATED
RESUME_UPLOADED
RESUME_PARSED

JOB_CREATED
JOB_ANALYZED

OPTIMIZATION_STARTED
OPTIMIZATION_COMPLETED

RECHECK_STARTED
RECHECK_COMPLETED

PDF_EXPORTED

CREDIT_CONSUMED
CREDIT_REFUNDED
```

Application activity and AI request records should remain separate concepts.

---

# 13. User Usage Profile

Admin should be able to open a user and see a complete usage profile.

## Account

* User ID
* Email
* Created date
* Last active
* Plan
* Account status

## AI Usage

* Total AI requests
* Successful requests
* Failed requests
* Input tokens
* Output tokens
* Total tokens

## Cost

* Total AI cost
* Current month cost
* Current week cost

## Credits

* Credits consumed
* Credits remaining
* Current limit

## Service Breakdown

Example:

```text
Resume Parsing       12 requests
JD Analysis           8 requests
Optimization          7 requests
Recheck               3 requests
Cover Letter          2 requests
```

Also show the user's recent activity.

---

# 14. Cost Analytics

Create a dedicated Cost Analytics page.

Allow breakdown by:

## Time

* Hour
* Day
* Week
* Month

## User

```text
User A → $4.20
User B → $2.81
User C → $1.92
```

## Service

```text
Resume Optimization → $8.32
JD Analysis         → $3.21
Resume Parsing      → $1.42
Recheck             → $0.82
```

## Model

```text
Model A → $8.21
Model B → $4.13
```

## Provider

```text
Gemini → $12.34
```

---

# 15. Cost Calculation

Cost must always be calculated on the backend.

Never trust cost information coming from the frontend.

Formula:

```text
inputCost =
inputTokens / 1,000,000 × inputPrice

outputCost =
outputTokens / 1,000,000 × outputPrice

totalCost =
inputCost + outputCost
```

Store the calculated cost with the AI request.

Also store the pricing snapshot used for the calculation.

---

# 16. Credit System

If the SaaS uses credits, implement a proper credit ledger.

Every credit operation must create a ledger record.

Suggested fields:

```text
transactionId
userId
type
amount
balanceAfter
reason
service
referenceId
createdAt
```

Transaction types:

```text
INITIAL_GRANT
PURCHASE
CONSUMPTION
REFUND
ADMIN_ADJUSTMENT
BONUS
EXPIRATION
```

Example:

```text
+100  Initial credits
-5    Resume optimization
-1    Resume parsing
+5    Failed request refund
```

Do not rely only on the user's current balance to determine historical usage.

The ledger is the source of truth for credit transactions.

---

# 17. Credit Consumption Rules

When an AI service consumes credits:

```text
AI Request
   ↓
Validate user credits
   ↓
Reserve/consume credits
   ↓
Execute AI request
   ↓
Record AI usage
   ↓
If required, refund credits
```

Failed operations must have clearly defined refund behavior.

Do not silently consume credits without creating a ledger entry.

---

# 18. Usage Limits

Support configurable limits.

Limits can be defined at:

## User Level

```text
Max AI requests/day
Max AI requests/month
Max credits/month
Max AI cost/month
```

## Plan Level

Example:

```text
Free
10 AI requests/month

Pro
100 AI requests/month

Premium
500 AI requests/month
```

## Service Level

Example:

```text
Resume Parsing
10/month

Resume Optimization
20/month

AI Interview
50/month
```

The backend must enforce these limits.

The frontend should only display them.

---

# 19. Failed AI Requests

Create an AI Errors page.

Group failures by:

* Provider
* Model
* Service
* Error type
* Date

Error categories:

```text
RATE_LIMIT
TIMEOUT
INVALID_RESPONSE
SCHEMA_VALIDATION
PROVIDER_ERROR
AUTH_ERROR
NETWORK_ERROR
QUOTA_EXCEEDED
INTERNAL_ERROR
```

Display:

* Error count
* Affected users
* Service
* Model
* Last occurrence

---

# 20. AI Reliability Metrics

Track:

## Success Rate

```text
Successful Requests / Total Requests
```

## Failure Rate

```text
Failed Requests / Total Requests
```

## Average Latency

Average AI request duration.

## P95 Latency

Track P95 latency for important AI services.

## Cost per Successful Operation

Useful for understanding the actual cost of completed operations.

---

# 21. Usage Limits and Cost Alerts

V1 should support basic threshold monitoring.

Examples:

```text
Daily AI budget
Monthly AI budget
```

Show warnings when:

```text
50% consumed
75% consumed
90% consumed
100% consumed
```

Also highlight:

* Users approaching limits
* Users exceeding limits
* Services with unusually high usage
* Sudden usage increases

Advanced automated anomaly detection is not required for V1.

---

# 22. Top Usage Tables

Dashboard should show:

## Top Users by AI Cost

```text
User | Requests | Tokens | Cost
```

## Top Users by Requests

```text
User | Requests | Cost
```

## Top Services by Cost

```text
Service | Requests | Tokens | Cost
```

## Top Services by Usage

```text
Service | Requests | Users | Cost
```

## Most Expensive Requests

```text
Request ID | User | Service | Tokens | Cost
```

These are analytics views, not ranking users for punitive purposes.

---

# 23. Admin Audit Log

Every important admin action must be logged.

Examples:

```text
ADMIN_CHANGED_USER_PLAN
ADMIN_SUSPENDED_USER
ADMIN_ADJUSTED_CREDITS
ADMIN_CHANGED_USAGE_LIMIT
ADMIN_CHANGED_AI_PRICING
ADMIN_CHANGED_BUDGET
```

Suggested fields:

```text
auditId
adminId
action
targetType
targetId
metadata
ipAddress
userAgent
createdAt
```

Audit logs must be immutable.

---

# 24. Admin Roles

Support basic role-based access.

## Super Admin

Full access.

## Operations Admin

Can view:

* Users
* AI usage
* AI requests
* Costs
* Errors
* Activity

## Support Admin

Can view:

* Users
* User activity
* Usage
* Account information

Support Admin should not modify:

* AI pricing
* Budgets
* Usage limits
* Sensitive system configuration

---

# 25. Sensitive Data Protection

Admin pages must not expose sensitive information unnecessarily.

Never expose:

* API keys
* Provider secrets
* Passwords
* Authentication tokens

Do not display full resume content or full AI prompts/responses unless there is a specific future admin debugging requirement.

Prefer metadata such as:

```text
Request ID
Service
Model
Tokens
Cost
Status
Duration
```

---

# 26. Database Tables

V1 should use PostgreSQL/NeonDB as the persistent source of truth.

Recommended tables:

```text
users

ai_requests

ai_model_pricing

credit_ledger

activity_events

usage_limits

admin_audit_logs
```

Optional configuration tables can be introduced if required by the existing application architecture.

Do not create Redis-specific tables or infrastructure.

---

# 27. AI Request Correlation

Every AI operation should have a traceable request ID.

Recommended fields:

```text
requestId
userId
service
provider
model
```

Where applicable, also associate:

```text
resumeId
jobId
optimizationSessionId
```

This allows the admin to investigate a complete operation.

Example:

```text
User
 ↓
Optimization Session
 ↓
AI Request
 ↓
Gemini
 ↓
Result
```

The admin should be able to trace the AI request back to the user and feature that generated it.

---

# 28. API Design

Admin APIs must be separate from normal user APIs.

Example:

```text
/api/admin/dashboard

/api/admin/users
/api/admin/users/:id
/api/admin/users/:id/activity
/api/admin/users/:id/usage

/api/admin/ai/requests
/api/admin/ai/requests/:id
/api/admin/ai/services
/api/admin/ai/models
/api/admin/ai/errors

/api/admin/costs
/api/admin/credits
/api/admin/credits/ledger

/api/admin/usage-limits

/api/admin/audit-logs
```

Every admin API must verify:

1. Authentication
2. Admin role
3. Required permission

Never rely only on frontend route protection.

---

# 29. Server-Side Pagination

All large admin tables must use server-side pagination.

Do NOT:

```text
Fetch 100,000 records
        ↓
Send everything to frontend
        ↓
Filter in React
```

Instead:

```text
Frontend
   ↓
GET /api/admin/ai/requests?page=1&limit=25
   ↓
Backend
   ↓
PostgreSQL
   ↓
25 records
```

Support:

* Pagination
* Sorting
* Filtering
* Search

---

# 30. Export

V1 should support CSV export for important analytics.

Exports:

```text
User Usage
AI Requests
AI Costs
Credit Ledger
Service Usage
Failed Requests
Activity Logs
```

Exports must respect:

* Selected filters
* Date range
* Search criteria

Large exports should be handled carefully and should not block normal API requests.

---

# 31. Frontend Navigation

Recommended Admin sidebar:

```text
Dashboard

Users
 ├── All Users
 ├── User Activity
 └── User Usage

AI Usage
 ├── Overview
 ├── AI Requests
 ├── Services
 ├── Models
 └── Errors

Costs
 ├── Overview
 ├── By User
 ├── By Service
 └── By Model

Credits
 ├── Usage
 └── Ledger

System
 ├── Activity
 └── Audit Logs

Settings
 ├── Usage Limits
 └── AI Pricing
```

Do not create a Cache section in V1.

---

# 32. V1 Scope

## Must Have

```text
Admin authentication
Admin authorization/RBAC

Dashboard

User management
User activity
User usage

AI request tracking
AI service tracking
AI model tracking

Input token tracking
Output token tracking
Total token tracking

AI cost tracking

Credit ledger
Usage limits

Failed AI request tracking
Basic reliability metrics

Admin audit logs

Server-side pagination
Filtering
Search
CSV export
```

## Not Required in V1

```text
Redis
External cache
Redis rate limiting
Redis queues
Advanced anomaly detection
Complex real-time monitoring
Distributed tracing
Advanced reporting engine
```

These can be added in future versions if actual scale requires them.

---

# 33. Central AI Service Wrapper

This is one of the most important implementation requirements.

All AI calls must pass through a centralized abstraction.

Conceptually:

```text
aiService.generate({
    service,
    userId,
    model,
    prompt,
    metadata
})
```

The wrapper is responsible for:

```text
1. Validate request
2. Check usage limits
3. Call AI provider
4. Extract token usage
5. Calculate cost
6. Record AI request
7. Return result
```

Individual features should NOT manually calculate:

```text
tokens
cost
usage
```

They should use the centralized AI service layer.

---

# 34. Example AI Usage Flow

For resume optimization:

```text
User requests optimization
        ↓
Resume Optimization Service
        ↓
Check user limits
        ↓
AI Service Wrapper
        ↓
Gemini API
        ↓
Receive response
        ↓
Extract token usage
        ↓
Calculate cost
        ↓
Create ai_requests record
        ↓
Create credit ledger record
        ↓
Return result
```

The same pattern must be used for:

```text
Resume Parsing
JD Analysis
Resume Optimization
Resume Re-check
Cover Letter
AI Interview
```

---

# 35. Important V1 Rules

### Rule 1 — PostgreSQL is the source of truth

All important usage, credit, cost and activity information must be persisted in PostgreSQL.

### Rule 2 — No Redis in V1

Do not introduce external caching or Redis infrastructure.

### Rule 3 — Backend calculates cost

Never trust frontend cost calculations.

### Rule 4 — Centralized AI accounting

Every AI request goes through the AI service wrapper.

### Rule 5 — Immutable usage records

AI request history and admin audit logs should not be casually overwritten.

### Rule 6 — Credit ledger

Never depend only on the current credit balance to understand historical consumption.

### Rule 7 — No hidden AI usage

Every AI request must be traceable to:

```text
User
Service
Model
Tokens
Cost
Status
Timestamp
```

### Rule 8 — Protect sensitive information

Admin analytics should expose operational metadata rather than unnecessary user content.

### Rule 9 — Keep V1 simple

Do not introduce infrastructure just because it may be useful at scale.

Build for the current product requirements and keep extension points for future scaling.

---

# 36. Future Extension Points

The V1 architecture should allow future additions without major rewrites.

Possible V2 features:

```text
Redis caching
Redis rate limiting
Background job queues
Advanced anomaly detection
Real-time monitoring
Distributed tracing
Advanced budget automation
Provider fallback
Multiple AI providers
AI cost optimization
Advanced analytics
```

These are explicitly outside V1 scope.

---

# 37. Final V1 Goal

The completed Admin Module V1 should allow an administrator to open the dashboard and understand:

```text
How many users do we have?
        ↓
How active are they?
        ↓
What AI features are they using?
        ↓
How many AI requests are happening?
        ↓
How many tokens are being consumed?
        ↓
Which models are being used?
        ↓
How much does each request cost?
        ↓
How much does each service cost?
        ↓
How much does each user consume?
        ↓
How many credits are being consumed?
        ↓
Which requests are failing?
        ↓
What admin actions happened?
```

The system should provide a complete chain:

```text
USER
  ↓
ACTIVITY
  ↓
SERVICE
  ↓
AI REQUEST
  ↓
MODEL
  ↓
TOKENS
  ↓
COST
  ↓
CREDITS
  ↓
ADMIN ANALYTICS
```

This is the core of the Admin Module V1.
