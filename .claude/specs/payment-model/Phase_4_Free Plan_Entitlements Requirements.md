# Phase 4 — Free Plan & Entitlements Requirements

## 1. Objective

Phase 4 introduces the application's **plan and entitlement system**.

Phase 3 established the credit system and connected credits to AI operations.

Phase 4 establishes:

* User plan assignment
* Feature entitlements
* Free-plan usage limits
* Server-side entitlement enforcement
* Monthly usage tracking
* Consistent access-control behavior
* A foundation for paid plans in Phase 5

The system must **not depend on Clerk Premium metadata** for application billing or feature access.

---

# 2. Phase 4 Scope

### Included

* Free plan
* Plan definitions
* Feature entitlements
* Free-plan limits
* Server-side entitlement middleware/service
* Monthly usage tracking
* Entitlement API
* Frontend plan/feature state
* Graceful entitlement errors
* Admin visibility of plan and entitlement state
* Tests for entitlement enforcement

### Not Included

* Razorpay
* Subscription checkout
* Paid subscriptions
* Credit top-ups
* Payment webhooks
* Invoice generation
* Subscription cancellation
* Subscription upgrades/downgrades
* Clerk Billing
* Redis
* Advanced billing analytics

Those belong to later phases.

---

# 3. Existing Architecture

The system now has four separate responsibilities:

```text
Authentication
    ↓
Who is the user?

Plan / Entitlement
    ↓
What features can the user access?

Credits
    ↓
Can the user afford this AI operation?

AI Service
    ↓
Execute the AI operation
```

Do not combine these responsibilities.

---

# 4. Critical Rule

## Credits and Entitlements Are Different

A user may have enough credits but still not have access to a particular feature.

Example:

```text
User
Plan: FREE
Credits: 5

Feature:
Advanced Career Report
Required entitlement: false

Result:
FEATURE_NOT_AVAILABLE
```

Another example:

```text
User
Plan: FREE
Credits: 1

Feature:
MATCH_ANALYSIS
Required entitlement: true
Cost: 2 credits

Result:
INSUFFICIENT_CREDITS
```

Therefore:

```text
Entitlement check
        ↓
Credit check
        ↓
AI operation
```

---

# 5. Free Plan

Phase 4 introduces one application-controlled plan:

```text
FREE
```

Every authenticated user must have a valid plan.

New users should default to:

```text
FREE
```

The application database is authoritative for the user's plan.

Do not determine plan access using:

```text
Clerk publicMetadata
Clerk privateMetadata
Clerk premium flags
Frontend state
```

Clerk remains the authentication provider.

---

# 6. Free Plan Responsibilities

The Free plan controls access to **non-credit-gated application features** and the existing generic AI usage limits.

Career AI operations remain credit-based.

### Career operations

| Feature                      | Free Plan | Credit Required |
| ---------------------------- | --------- | --------------: |
| Match Analysis               | Available |               2 |
| Resume Optimization / Tailor | Available |               3 |

Do not add the old:

```text
planLimit: 4
```

to Match Analysis.

Do not restore:

```text
premium === true
```

for Resume Optimization.

These were replaced by the Phase 3 credit system.

---

# 7. Generic AI Tools

The existing generic AI tools remain under their existing `free_usage` limits during Phase 4.

Examples may include:

* Article generation
* Blog title generation
* Image generation
* Image editing
* Resume review

These operations are NOT converted to credits in Phase 4.

The existing free usage mechanism should be formalized rather than duplicated across routes.

---

# 8. Entitlement Model

Create a central entitlement definition.

Example:

```js
const ENTITLEMENTS = {
  MATCH_ANALYSIS: "match_analysis",
  RESUME_OPTIMIZATION: "resume_optimization",

  RESUME_REVIEW: "resume_review",
  ARTICLE_GENERATION: "article_generation",
  BLOG_TITLE_GENERATION: "blog_title_generation",
  IMAGE_GENERATION: "image_generation",
  IMAGE_EDITING: "image_editing",
};
```

The exact feature list should match the application's existing routes.

Do not create entitlement identifiers for features that do not exist.

---

# 9. Plan Definition

Create a plan configuration.

Example:

```js
const PLANS = {
  FREE: {
    key: "FREE",
    name: "Free",
  },
};
```

The architecture must allow future plans:

```text
FREE
STARTER
PRO
POWER
```

but Phase 4 should only activate:

```text
FREE
```

Do not implement paid-plan behavior yet.

---

# 10. Database Design

## 10.1 plans

Recommended table:

```sql
plans
-----
id
key
name
description
is_active
created_at
updated_at
```

Constraints:

```text
key UNIQUE
```

Seed:

```text
FREE
```

---

# 11. Plan Entitlements

Recommended table:

```sql
plan_entitlements
-----------------
id
plan_id
feature_key
enabled
monthly_limit
created_at
updated_at
```

Example:

```text
FREE
resume_review
enabled = true
monthly_limit = existing free limit
```

For unlimited features:

```text
monthly_limit = NULL
```

Do not use arbitrary magic numbers inside individual routes.

---

# 12. User Plan Assignment

Recommended table:

```sql
user_plans
----------
id
user_id
plan_id
status
started_at
expires_at
created_at
updated_at
```

Constraints:

```text
user_id UNIQUE
```

For Phase 4:

```text
status = ACTIVE
plan = FREE
expires_at = NULL
```

A user should have one active application plan.

This structure allows Phase 5 to introduce subscriptions without redesigning the entitlement architecture.

---

# 13. User Usage Tracking

The existing `free_usage` system should become a centralized usage mechanism.

Recommended structure:

```sql
feature_usage
-------------
id
user_id
feature_key
period_start
period_end
usage_count
created_at
updated_at
```

Recommended unique constraint:

```text
(user_id, feature_key, period_start)
```

This prevents duplicate monthly usage records.

---

# 14. Monthly Usage Period

For monthly limits, use a deterministic period.

Example:

```text
period_start = 2026-10-01
period_end   = 2026-10-31
```

The implementation should derive the current period from the server date.

Do not trust:

```text
frontend date
client-provided period
client-provided usage count
```

---

# 15. Entitlement Service

Create a central service.

Example:

```js
entitlementService
```

Recommended methods:

```js
getUserPlan(userId)

hasEntitlement(userId, featureKey)

getEntitlement(userId, featureKey)

checkFeatureAccess(userId, featureKey)

getFeatureUsage(userId, featureKey)

consumeFeatureUsage(userId, featureKey)

getUserEntitlements(userId)
```

The goal is to prevent this logic from being duplicated across controllers.

---

# 16. Central Access Check

Recommended flow:

```js
await entitlementService.checkFeatureAccess(
  userId,
  "RESUME_REVIEW"
);
```

The service should determine:

```text
User exists?
        ↓
Active plan?
        ↓
Feature enabled?
        ↓
Monthly limit reached?
        ↓
ALLOW
```

If the feature is unavailable:

```text
FEATURE_NOT_AVAILABLE
```

If the feature has reached its monthly limit:

```text
USAGE_LIMIT_REACHED
```

---

# 17. Career AI Operations

Match Analysis and Resume Optimization are special.

They should remain:

```text
ENTITLEMENT
    +
CREDITS
```

However, because both are available on the Free plan:

```text
FREE PLAN
    ↓
Feature enabled
    ↓
Credit check
    ↓
AI operation
```

### Match

```text
Entitlement: enabled
Credit cost: 2
```

### Resume Optimization

```text
Entitlement: enabled
Credit cost: 3
```

Do not reintroduce:

```text
planLimit
```

or:

```text
premium-only
```

for these routes.

---

# 18. Generic AI Operation

For a generic AI feature:

```text
Authentication
      ↓
Entitlement check
      ↓
Monthly usage check
      ↓
Existing free_usage behavior
      ↓
AI execution
```

These features remain independent of the Phase 3 credit wallet.

---

# 19. Order of Checks

For credit-based career operations:

```text
1. Authenticate user
2. Resolve user
3. Check entitlement
4. Check credits
5. Consume credits
6. Execute AI
7. Refund on failure
8. Record usage
9. Return response
```

For non-credit generic features:

```text
1. Authenticate user
2. Resolve user
3. Check entitlement
4. Check monthly usage
5. Execute AI
6. Record usage
7. Return response
```

---

# 20. Error Codes

Standardize entitlement errors.

```js
FEATURE_NOT_AVAILABLE
USAGE_LIMIT_REACHED
PLAN_NOT_FOUND
USER_PLAN_NOT_FOUND
INVALID_FEATURE
USAGE_RECORD_ERROR
ENTITLEMENT_CHECK_FAILED
```

Existing Phase 3 errors remain unchanged:

```text
INSUFFICIENT_CREDITS
CREDIT_OPERATION_FAILED
```

Do not return `INSUFFICIENT_CREDITS` when the real problem is entitlement.

---

# 21. API

## GET /api/entitlements

Returns the authenticated user's current plan and available features.

Example:

```json
{
  "plan": {
    "key": "FREE",
    "name": "Free"
  },
  "features": {
    "match_analysis": {
      "enabled": true,
      "creditCost": 2
    },
    "resume_optimization": {
      "enabled": true,
      "creditCost": 3
    },
    "resume_review": {
      "enabled": true,
      "monthlyLimit": 3,
      "used": 1,
      "remaining": 2
    }
  }
}
```

The response should contain only information relevant to the authenticated user.

---

# 22. API Security

Never accept these values from the frontend as authoritative:

```text
plan
isPremium
featureEnabled
monthlyLimit
remainingUsage
```

Bad:

```json
{
  "plan": "PRO"
}
```

Good:

```text
GET /api/entitlements
        ↓
server resolves user
        ↓
server resolves plan
        ↓
server resolves entitlements
```

---

# 23. Frontend

Phase 4 may expose plan and entitlement information in the UI.

Examples:

```text
Free Plan

Match Analysis
2 credits

Resume Optimization
3 credits

Resume Review
2 / 3 used this month
```

The frontend is display-only.

It must not determine access.

---

# 24. Frontend Error Handling

Handle:

```text
FEATURE_NOT_AVAILABLE
```

with a clear message.

Example:

```text
This feature isn't available on your current plan.
```

Handle:

```text
USAGE_LIMIT_REACHED
```

with:

```text
You've reached your monthly limit for this feature.
```

Handle:

```text
INSUFFICIENT_CREDITS
```

with the Phase 3 credit message.

Do not show a misleading billing message for a credit problem.

---

# 25. No Paid Upgrade Flow

Phase 4 should NOT contain:

```text
Upgrade to Pro
Buy subscription
Checkout
Razorpay
Payment
Invoice
```

A future UI may show that paid plans exist, but no purchase action should be implemented.

Phase 5 owns paid plan activation.

---

# 26. Clerk Integration

Clerk remains responsible for:

```text
Authentication
User identity
Session
Webhook synchronization
```

Application PostgreSQL remains responsible for:

```text
Plan
Entitlements
Usage
Credits
Billing state
```

Do not use:

```js
user.publicMetadata.plan
```

as the application's authoritative plan.

---

# 27. New User Flow

```text
Clerk signup
      ↓
Phase 1 user synchronization
      ↓
users row
      ↓
ensureWallet()
      ↓
ensureUserPlan()
      ↓
FREE plan assigned
      ↓
User can use entitled features
```

Plan creation must be idempotent.

Calling:

```text
ensureUserPlan(userId)
```

multiple times must never create multiple active plans.

---

# 28. Existing Users

Before enabling Phase 4:

```text
Existing users
      ↓
Find users without active plan
      ↓
Assign FREE
```

This should be a safe, idempotent backfill.

Do not modify existing credit balances.

---

# 29. Usage Reset

Monthly usage must not be reset by manually setting:

```text
usage_count = 0
```

Instead, create a new usage period.

Example:

```text
October:
user_id = 123
feature = RESUME_REVIEW
period = 2026-10
usage = 3

November:
user_id = 123
feature = RESUME_REVIEW
period = 2026-11
usage = 0
```

This preserves historical usage.

---

# 30. Concurrency

Usage limits must be concurrency-safe.

Example:

```text
User has 1 remaining Resume Review

Request A ─┐
            ├── both arrive simultaneously
Request B ─┘
```

The system must not allow both requests to consume the final usage slot.

Use PostgreSQL transaction/locking or an atomic conditional update.

---

# 31. Credit + Entitlement Concurrency

For career AI operations:

```text
Entitlement check
        ↓
Credit consumption
        ↓
AI execution
```

Credit consumption continues to use the Phase 3 atomic transaction behavior.

Do not weaken Phase 3 concurrency protection while adding entitlements.

---

# 32. Admin

Admin should be able to see:

```text
User
Plan
Plan status
Feature
Monthly usage
Usage limit
Credit balance
```

Example:

```text
User: user_123
Plan: FREE
Status: ACTIVE

Match Analysis:
Available through credits

Resume Optimization:
Available through credits

Resume Review:
2 / 3 used
```

Admin adjustment of plans should be server-side and audited.

---

# 33. Admin Plan Changes

Phase 4 may support an internal/admin plan assignment operation for testing.

Example:

```text
assignPlan(userId, planKey, reason)
```

Every manual plan change must create an audit record.

Required:

```text
admin_user_id
target_user_id
old_plan
new_plan
reason
created_at
```

Do not build a public plan-switching endpoint.

---

# 34. Database Constraints

Important constraints:

```text
plans.key UNIQUE

user_plans.user_id UNIQUE

plan_entitlements(plan_id, feature_key) UNIQUE

feature_usage(
  user_id,
  feature_key,
  period_start
) UNIQUE
```

These constraints provide database-level protection against duplicate state.

---

# 35. Data Ownership

```text
Clerk
 └── Identity

users
 └── Application user

user_plans
 └── Current plan

plans
 └── Available plans

plan_entitlements
 └── Feature access rules

feature_usage
 └── Monthly feature usage

credit_wallets
 └── AI credit balance

credit_transactions
 └── Credit history

ai_requests
 └── AI execution/cost history
```

---

# 36. Important Separation

Do not create a single table that attempts to represent:

```text
plan + credits + AI usage + subscription + payment
```

Keep the domains separate.

This will make Phase 5 significantly easier.

---

# 37. Testing Requirements

## Plan Tests

Test:

* New user receives FREE plan
* Existing user receives FREE during backfill
* Duplicate plan creation is prevented
* User cannot have multiple active plans

## Entitlement Tests

Test:

* Enabled feature is accessible
* Disabled feature is rejected
* Invalid feature is rejected
* Missing plan is handled safely

## Usage Tests

Test:

* Usage increments correctly
* Monthly limit is enforced
* New month creates a new usage period
* Concurrent requests cannot exceed the limit
* Historical usage remains intact

## Career AI Tests

Test:

```text
FREE + enough credits
→ allowed
```

```text
FREE + insufficient credits
→ INSUFFICIENT_CREDITS
```

```text
Feature disabled + enough credits
→ FEATURE_NOT_AVAILABLE
```

Credits must not be consumed when entitlement validation fails.

## Generic AI Tests

Test:

```text
FREE + usage remaining
→ allowed
```

```text
FREE + usage exhausted
→ USAGE_LIMIT_REACHED
```

---

# 38. Acceptance Criteria

Phase 4 is complete when:

* Every authenticated user has an application plan
* FREE is the default plan
* Plan state is stored in PostgreSQL
* Clerk Premium metadata is not authoritative
* Entitlements are centrally defined
* Feature access is checked server-side
* Generic AI free usage is centrally enforced
* Monthly usage is tracked by period
* Concurrent usage cannot bypass limits
* Match Analysis remains available through credits
* Resume Optimization remains available through credits
* `planLimit: 4` is not restored
* Clerk premium-only gating is not restored
* Credits are not consumed when entitlement validation fails
* Existing Phase 3 credit behavior remains intact
* Frontend displays plan/usage state from backend
* Admin can inspect plan and usage
* Manual admin plan changes are audited
* No payment or subscription functionality is introduced

---

# 39. Phase 4 Architecture

```text
                    ┌──────────────┐
                    │    Clerk     │
                    │ Authentication│
                    └──────┬───────┘
                           │
                           ▼
                    ┌──────────────┐
                    │    users     │
                    └──────┬───────┘
                           │
              ┌────────────┴────────────┐
              ▼                         ▼
      ┌──────────────┐          ┌──────────────┐
      │ user_plans   │          │credit_wallets│
      └──────┬───────┘          └──────┬───────┘
             │                         │
             ▼                         ▼
      ┌──────────────┐          ┌────────────────┐
      │ Entitlements │          │ Credit Service │
      └──────┬───────┘          └───────┬────────┘
             │                          │
             └────────────┬─────────────┘
                          ▼
                   ┌──────────────┐
                   │ AI Features  │
                   └──────────────┘
                          │
                          ▼
                   ┌──────────────┐
                   │  ai_requests │
                   └──────────────┘
```

---

# 40. Phase Boundary

### Phase 1

Authentication + User Identity

### Phase 2

Credit Wallet + Immutable Ledger

### Phase 3

AI Credit Consumption

### Phase 4

**Free Plan + Entitlements**

### Phase 5

Paid Plans + Subscriptions

### Phase 6

Credit Top-ups

### Phase 7

Razorpay + Production Billing

---

# 41. Phase 4 Principle

The final authorization model should be:

```text
                ┌─────────────────┐
                │ Authenticated?  │
                └────────┬────────┘
                         │
                         ▼
                ┌─────────────────┐
                │ Feature enabled?│
                └────────┬────────┘
                         │
             ┌───────────┴───────────┐
             │                       │
       Credit-based             Usage-based
             │                       │
             ▼                       ▼
      Enough credits?          Limit remaining?
             │                       │
             └───────────┬───────────┘
                         ▼
                       ALLOW
                         │
                         ▼
                    Execute AI
```

The system should never trust the frontend to make any of these decisions.
