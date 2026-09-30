# Quick AI — Phase 3: AI Credit Consumption

**Status:** Planned
**Phase:** 3
**Project:** Quick AI
**Depends On:** Phase 1 — Authentication & User Identity
**Depends On:** Phase 2 — Credit Wallet & Ledger

---

## 1. Objective

Phase 3 makes the credit system actually usable by connecting **AI-powered features to the user's credit wallet**.

After this phase:

* AI features consume credits.
* Users cannot use paid AI operations without sufficient credits.
* Credit consumption is handled only on the backend.
* Every AI credit deduction is recorded in the immutable credit ledger.
* AI requests are recorded with usage, token and cost information.
* Failed AI requests do not incorrectly charge users.
* Duplicate/retried requests do not accidentally consume credits multiple times.
* The system remains safe under concurrent requests.
* Admins can see how many credits users consume and how much the AI operations cost.

### Phase 3 does NOT implement

* Razorpay
* Paid subscriptions
* Subscription billing
* Credit top-up payments
* Premium plan activation
* Clerk premium metadata
* Redis
* Advanced billing UI

Those belong to later phases.

---

# 2. Current Architecture

Quick AI currently uses:

```text
Clerk
  ↓
Authentication
  ↓
users
  ↓
Application Data
```

Phase 2 added:

```text
users
  ↓
credit_wallets
  ↓
credit_transactions
```

Phase 3 extends this to:

```text
User
  ↓
Authentication
  ↓
Credit Service
  ↓
AI Service
  ↓
Gemini
  ↓
AI Usage Tracking
```

The backend remains the source of truth.

---

# 3. Important Identity Rule

The current identity model from Phase 1 must remain unchanged.

```text
users.id = Clerk User ID
users.clerk_user_id = Clerk User ID
```

All credit-related records use:

```text
user_id → users.id
```

Do NOT introduce a new internal user ID in Phase 3.

Do NOT migrate existing application data.

---

# 4. Core Principle

The frontend must never be trusted to decide:

* how many credits an AI operation costs
* whether the user has enough credits
* whether credits should be deducted
* whether an AI request succeeded
* how much the AI request actually cost
* whether a user is allowed to consume credits

The backend decides all of these.

---

# 5. AI Credit Flow

The standard flow should be:

```text
Client
  ↓
Authenticated API Request
  ↓
Validate Request
  ↓
Identify User
  ↓
Ensure Wallet
  ↓
Determine AI Service
  ↓
Determine Credit Cost
  ↓
Check Available Credits
  ↓
Reserve / Consume Credits
  ↓
Call AI Provider
  ↓
Receive AI Response
  ↓
Record AI Usage
  ↓
Return Response
```

However, credit handling must be designed carefully around failures.

---

# 6. Credit Consumption Strategy

For Phase 3, use a **pre-charge + refund-on-failure** model.

Example:

```text
User has 10 credits

AI operation costs 2 credits

Request starts
      ↓
Consume 2 credits
      ↓
Gemini request
      ↓
SUCCESS
      ↓
Keep 2-credit deduction
```

If the AI request fails:

```text
User has 10 credits

Consume 2 credits
      ↓
Gemini request
      ↓
FAILURE
      ↓
Refund 2 credits
```

This ensures users cannot start unlimited AI requests without sufficient balance.

---

# 7. Why Pre-Charge?

Do NOT simply:

```text
Call Gemini
   ↓
If successful → deduct credits
```

because multiple concurrent requests could all observe the same balance.

Example:

```text
Balance = 2

Request A → sees 2
Request B → sees 2
Request C → sees 2

All three call Gemini

Actual usage = 6 credits
Available = 2
```

This creates a negative balance or uncontrolled AI cost.

Instead:

```text
Request A → atomically consumes 1
Request B → insufficient credits
Request C → insufficient credits
```

The wallet remains protected.

---

# 8. Credit Cost Configuration

AI services must have a server-side credit cost.

Do NOT hard-code credit values throughout controllers.

Recommended configuration:

```js
const AI_CREDIT_COSTS = {
  JD_ANALYSIS: 1,
  MATCH_ANALYSIS: 2,
  RESUME_OPTIMIZATION: 3,
};
```

The exact values are configurable and should be based on actual AI cost measurements.

These values are examples only.

---

# 9. Service Names

Use stable service identifiers.

Recommended initial services:

```text
JD_ANALYSIS
MATCH_ANALYSIS
RESUME_OPTIMIZATION
```

Future services may include:

```text
RESUME_REVIEW
COVER_LETTER
INTERVIEW_PREP
SKILL_GAP_ANALYSIS
```

Do not create separate credit logic for every feature.

All AI services must use the same credit infrastructure.

---

# 10. Central AI Credit Service

Create a centralized service responsible for AI credit handling.

Example:

```text
services/
  creditService.js
  aiCreditService.js
```

Recommended API:

```js
getServiceCost(service)

checkCredits(userId, amount)

consumeForAI(userId, amount, reference)

refundAIUsage(userId, amount, reference)

executeWithCredits(...)
```

The exact implementation can follow the existing project structure.

---

# 11. Recommended `executeWithCredits()` Pattern

The goal is to avoid duplicating the same logic in every AI controller.

Conceptually:

```js
await executeWithCredits({
  userId,
  service: "JD_ANALYSIS",
  referenceId,
  execute: async () => {
    return await runJDAnalysis(input);
  }
});
```

The service should internally handle:

```text
1. Authenticate user
2. Ensure wallet
3. Determine credit cost
4. Consume credits
5. Execute AI operation
6. Record usage
7. Refund if required
8. Return result
```

---

# 12. AI Request Tracking

Every AI operation must be recorded.

The existing `ai_requests` table should be reused/extended rather than creating another AI usage table unnecessarily.

Recommended fields:

```text
id
user_id
service
provider
model
status
input_tokens
output_tokens
total_tokens
estimated_cost
credits_consumed
request_id
reference_id
error_code
error_message
prompt_version
schema_version
created_at
completed_at
```

Use the existing schema where fields already exist.

Only add missing fields required by Phase 3.

---

# 13. AI Request Status

Use explicit statuses.

Recommended:

```text
PENDING
SUCCESS
FAILED
REFUNDED
```

Possible flow:

```text
PENDING
   ↓
SUCCESS
```

or:

```text
PENDING
   ↓
FAILED
   ↓
REFUNDED
```

Do not mark an AI request as successful if the provider response was invalid.

---

# 14. AI Request Reference ID

Every credit-consuming AI operation must have a unique request/reference identifier.

Example:

```text
ai_req_01HXYZ...
```

This identifier should connect:

```text
AI Request
     ↓
Credit Transaction
```

Example:

```text
ai_requests.reference_id
        ↓
credit_transactions.reference_id
```

This makes auditing much easier.

---

# 15. Idempotency

AI requests can be retried because of:

* network failures
* frontend retries
* browser refresh
* mobile/network reconnection
* Vercel retries
* client-side duplicate submissions

The same logical request must never consume credits twice.

The backend should support an idempotency key/reference.

Example:

```text
Idempotency-Key: abc123
```

If the same request is received again:

```text
First request
→ consume credits
→ execute AI
→ save result

Second request with same key
→ return existing result/status
→ do NOT consume credits again
```

---

# 16. Credit Transaction Types

Phase 2 already defines:

```text
INITIAL_GRANT
BONUS
PURCHASE
SUBSCRIPTION_GRANT
AI_USAGE
REFUND
ADMIN_ADJUSTMENT
```

Phase 3 primarily uses:

```text
AI_USAGE
REFUND
```

Example:

```text
AI_USAGE
amount = -2
reference_id = ai_request_id
```

Failure:

```text
REFUND
amount = +2
reference_id = ai_request_id
```

---

# 17. Wallet Balance Rules

The wallet must never become negative.

Example:

```text
Balance = 1
AI cost = 2
```

Request must fail:

```text
INSUFFICIENT_CREDITS
```

Do not call Gemini.

Do not create an AI request that actually reaches the provider.

Do not deduct partial credits.

---

# 18. Insufficient Credit Response

Recommended API response:

```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_CREDITS",
    "message": "You do not have enough credits for this AI operation."
  }
}
```

Optionally include:

```json
{
  "required": 2,
  "available": 1
}
```

Do not expose internal AI provider cost information to normal users.

---

# 19. Credit Cost vs AI Provider Cost

These are different concepts.

Example:

```text
AI Provider Cost
$0.0037

Application Credit Cost
2 credits
```

Do not assume:

```text
1 credit = $0.001
```

Credits are an internal product unit.

The relationship between credits and actual AI cost can change later.

---

# 20. Current AI Cost Baseline

Current measured Quick AI usage:

### JD Analysis

```text
Input tokens:  ~1.1K
Output tokens: ~424
Total:         ~1.5K
Cost:          ~$0.0014
Latency:       ~2.3s
```

### Match Analysis

```text
Input tokens:  ~3.1K
Output tokens: ~1.1K
Total:         ~4.2K
Cost:          ~$0.0037
Latency:       ~5.5s
```

Combined measured cost:

```text
~$0.0051
```

These numbers are only the current baseline.

Do NOT permanently hard-code business pricing from these numbers.

Future AI operations may have substantially different costs.

---

# 21. Actual AI Cost Tracking

Every successful AI request should record:

```text
provider
model
input_tokens
output_tokens
total_tokens
estimated_cost
```

Example:

```json
{
  "provider": "google",
  "model": "gemini-...",
  "input_tokens": 3100,
  "output_tokens": 1100,
  "total_tokens": 4200,
  "estimated_cost": 0.0037
}
```

The backend calculates this.

Never trust token/cost values supplied by the frontend.

---

# 22. AI Pricing Configuration

The existing `ai_model_pricing` table should be used if available.

Recommended structure:

```text
provider
model
input_cost_per_1m
output_cost_per_1m
currency
effective_from
effective_to
is_active
```

This allows pricing changes without modifying application code.

---

# 23. Cost Calculation

Conceptually:

```text
input_cost =
input_tokens / 1,000,000 × input_price

output_cost =
output_tokens / 1,000,000 × output_price

total_cost =
input_cost + output_cost
```

Store the calculated cost with the AI request.

This creates a historical record even if provider pricing changes later.

---

# 24. AI Failure Handling

If Gemini fails:

```text
Consume credits
      ↓
AI provider failure
      ↓
Record FAILED
      ↓
Refund credits
      ↓
Record REFUND
      ↓
Return error
```

Example:

```json
{
  "success": false,
  "error": {
    "code": "AI_PROVIDER_ERROR",
    "message": "The AI service is temporarily unavailable."
  }
}
```

Do not expose raw provider errors to users.

---

# 25. Invalid AI Response

An AI request can technically succeed but return unusable data.

Example:

```text
HTTP 200
but
invalid JSON/schema
```

Treat this as failure.

Flow:

```text
Gemini response
      ↓
Validate response
      ↓
Invalid
      ↓
FAILED
      ↓
REFUND
```

The credit should not be permanently consumed for an unusable result.

---

# 26. Timeout Handling

AI calls must have a timeout.

Example:

```text
AI request
    ↓
timeout
    ↓
FAILED
    ↓
refund
```

The timeout value should be configurable through environment/configuration.

Example:

```env
AI_REQUEST_TIMEOUT_MS=60000
```

Do not allow requests to remain indefinitely pending.

---

# 27. Rate Limiting

Phase 3 should add basic protection around AI endpoints.

At minimum:

```text
Authenticated user
    ↓
Rate limit
    ↓
Credit check
    ↓
AI request
```

The exact rate-limiting implementation can use the existing infrastructure.

Do NOT introduce Redis only for this phase.

If Redis is not already required by Quick AI, use a simple V1-compatible approach.

---

# 28. Duplicate Request Protection

Frontend buttons must not be able to accidentally submit multiple requests.

Frontend should:

```text
Submit
 ↓
Disable button
 ↓
Request
 ↓
Enable after response
```

But this is only UX protection.

Backend idempotency is mandatory.

Never rely on frontend button disabling for financial/credit safety.

---

# 29. AI Endpoint Requirements

Every AI endpoint must:

### 1. Authenticate

```text
Clerk → auth middleware
```

### 2. Identify user

```text
req.user.id
```

### 3. Ensure wallet

```text
creditService.ensureWallet(userId)
```

### 4. Determine service

```text
JD_ANALYSIS
MATCH_ANALYSIS
RESUME_OPTIMIZATION
```

### 5. Determine server-side credit cost

```text
getServiceCost(service)
```

### 6. Consume credits atomically

```text
consumeCredits(...)
```

### 7. Execute AI

```text
Gemini
```

### 8. Validate output

```text
schema validation
```

### 9. Record AI usage

```text
ai_requests
```

### 10. Refund on failure

```text
refundCredits(...)
```

---

# 30. Example JD Analysis Flow

```text
POST /api/ai/jd-analysis
        ↓
Authenticate
        ↓
Validate input
        ↓
userId = authenticated user
        ↓
ensureWallet(userId)
        ↓
cost = 1 credit
        ↓
consume 1 credit
        ↓
Create AI request PENDING
        ↓
Call Gemini
        ↓
Validate response
        ↓
Calculate actual token/cost usage
        ↓
Update AI request SUCCESS
        ↓
Return result
```

Failure:

```text
Gemini failure
        ↓
Update AI request FAILED
        ↓
Refund 1 credit
        ↓
Create REFUND ledger entry
        ↓
Return safe error
```

---

# 31. Example Resume Optimization Flow

Resume optimization is expected to be more expensive than simple analysis.

Example:

```text
User has 5 credits

Optimization cost = 3

Balance before = 5

Consume 3
Balance = 2

Run optimizer

Success

Final balance = 2
```

If optimization fails:

```text
Consume 3
Balance = 2

AI failure

Refund 3
Balance = 5
```

---

# 32. Credit Consumption Must Be Atomic

The following operations must be protected from race conditions:

```text
Read balance
+
Validate balance
+
Deduct balance
+
Create transaction
```

They should happen inside a PostgreSQL transaction.

Conceptually:

```sql
BEGIN;

SELECT balance
FROM credit_wallets
WHERE user_id = $1
FOR UPDATE;

-- validate balance

UPDATE credit_wallets
SET balance = balance - $amount,
    lifetime_used = lifetime_used + $amount
WHERE user_id = $1;

INSERT INTO credit_transactions (...);

COMMIT;
```

Use the actual project database abstraction rather than copying this SQL blindly.

---

# 33. Concurrency Example

Starting balance:

```text
2 credits
```

Two simultaneous requests:

```text
Request A → cost 2
Request B → cost 2
```

Expected:

```text
Request A → succeeds
Request B → INSUFFICIENT_CREDITS
```

Never:

```text
A → succeeds
B → succeeds
Balance → -2
```

---

# 34. Wallet Lifecycle

Phase 2 defines:

```text
ensureWallet(userId)
```

Phase 3 must use it.

Wallet should exist before any AI credit operation.

If the user somehow does not have a wallet:

```text
ensureWallet()
    ↓
create wallet
    ↓
INITIAL_CREDIT_GRANT
    ↓
continue
```

This protects against incomplete onboarding or old users.

---

# 35. Initial Credit Grant

The initial grant remains configurable:

```env
INITIAL_CREDIT_GRANT=3
```

The grant must happen only once.

It must NOT happen again because:

* user logs in
* user opens credits page
* user calls an AI endpoint
* wallet is recreated
* webhook is retried
* deployment restarts
* backend restarts

Use the Phase 2 idempotent wallet/ledger logic.

---

# 36. Admin Visibility

Phase 3 should expose enough information for the existing admin module to show:

```text
User
Service
AI requests
Credits consumed
Tokens
AI provider cost
Success/failure
Timestamp
```

Example:

```text
User: user_123
Service: MATCH_ANALYSIS
Credits: 2
Tokens: 4,210
AI Cost: $0.0037
Status: SUCCESS
```

---

# 37. Admin Metrics

Recommended Phase 3 metrics:

```text
Total AI Requests
Successful AI Requests
Failed AI Requests
Total Credits Consumed
Total AI Provider Cost
Average Cost / Request
Average Credits / Request
Requests by Service
Credits by Service
Cost by Service
```

Do not build advanced analytics yet.

---

# 38. User Credit API

Phase 2 already defines:

```http
GET /api/credits
```

Phase 3 should ensure the response contains enough information for the frontend to show the balance.

Example:

```json
{
  "success": true,
  "data": {
    "balance": 5
  }
}
```

Optional:

```json
{
  "lifetimeGranted": 3,
  "lifetimePurchased": 0,
  "lifetimeUsed": 4
}
```

---

# 39. Transaction History

Existing:

```http
GET /api/credits/transactions
```

should now show AI usage.

Example:

```json
{
  "type": "AI_USAGE",
  "amount": -2,
  "balanceAfter": 3,
  "referenceId": "ai_req_123",
  "createdAt": "..."
}
```

Refund:

```json
{
  "type": "REFUND",
  "amount": 2,
  "balanceAfter": 5,
  "referenceId": "ai_req_123",
  "createdAt": "..."
}
```

---

# 40. Security Requirements

### Never trust frontend credit values

Bad:

```json
{
  "credits": 1
}
```

provided by the frontend.

Backend determines the cost.

---

### Never accept arbitrary user IDs

Bad:

```http
POST /api/ai
{
  "userId": "another-user"
}
```

User identity must come from authenticated Clerk session.

---

### Never allow frontend credit modification

No public endpoint should allow:

```text
POST /credits/grant
POST /credits/refund
POST /credits/adjust
```

Those are backend/admin-only operations.

---

### Never expose provider API keys

Gemini credentials remain server-side.

---

# 41. Premium Plan Consideration

Phase 3 must **not** rely on Clerk metadata such as:

```text
publicMetadata.plan = "premium"
```

as the authoritative billing entitlement.

At this stage:

```text
Clerk
→ authentication

PostgreSQL
→ application state
→ credits
→ AI usage
```

Real Free/Premium entitlement enforcement will be implemented in the later plan/entitlement phase.

The AI credit system must therefore be designed so entitlement checks can be added later without rewriting the AI service.

---

# 42. Do Not Implement Yet

The following are explicitly outside Phase 3:

```text
❌ Razorpay
❌ Stripe
❌ Subscription checkout
❌ Paid plan activation
❌ Premium upgrade UI
❌ Credit top-up payment
❌ Subscription webhooks
❌ Redis
❌ Referral credits
❌ Coupon system
❌ Complex billing
❌ Advanced fraud detection
```

---

# 43. Database Changes

Before implementation, inspect the current database.

Do not recreate existing tables blindly.

Verify:

```text
users
credit_wallets
credit_transactions
ai_requests
ai_model_pricing
```

Add only missing columns/indexes/constraints.

---

# 44. Recommended Indexes

Ensure the following indexes exist.

### `ai_requests`

```text
(user_id)
(created_at)
(service)
(status)
(user_id, created_at)
```

### `credit_transactions`

From Phase 2:

```text
(user_id)
(created_at)
(user_id, created_at DESC)
```

### `credit_wallets`

```text
UNIQUE(user_id)
```

Avoid unnecessary indexes.

---

# 45. Error Codes

Recommended Phase 3 errors:

```text
UNAUTHENTICATED
USER_NOT_FOUND
WALLET_NOT_FOUND
INVALID_CREDIT_AMOUNT
INSUFFICIENT_CREDITS
DUPLICATE_TRANSACTION
INVALID_TRANSACTION_TYPE
CREDIT_OPERATION_FAILED
AI_REQUEST_FAILED
AI_PROVIDER_ERROR
AI_TIMEOUT
AI_RESPONSE_INVALID
AI_SERVICE_UNAVAILABLE
IDEMPOTENCY_CONFLICT
```

Use stable error codes instead of relying on error-message strings.

---

# 46. Testing Requirements

Phase 3 is not complete until the following scenarios work.

### Credit deduction

```text
Balance = 5
Cost = 2

Expected balance = 3
```

### Insufficient balance

```text
Balance = 1
Cost = 2

Expected:
AI is NOT called
Balance remains 1
```

### Successful AI request

```text
Consume credits
AI succeeds
AI request = SUCCESS
Credits remain consumed
```

### Failed AI request

```text
Consume credits
AI fails
AI request = FAILED
Refund created
Original deduction preserved
Final balance restored
```

### Invalid AI response

```text
Consume
AI returns invalid schema
Refund
Request FAILED
```

### Timeout

```text
Consume
AI timeout
Refund
Request FAILED
```

### Duplicate request

```text
Same idempotency key
```

Expected:

```text
Only one credit deduction
Only one logical AI operation
```

### Concurrent requests

```text
Balance = 2

Request A = 2
Request B = 2
```

Expected:

```text
One succeeds
One fails
Balance never negative
```

### User isolation

User A must never be able to:

```text
read User B wallet
consume User B credits
view User B transactions
```

---

# 47. Test Matrix

| Scenario             | Expected Result           |
| -------------------- | ------------------------- |
| Wallet exists        | Use existing wallet       |
| Wallet missing       | Create + initial grant    |
| Enough credits       | AI request proceeds       |
| Insufficient credits | AI not called             |
| AI success           | Credits remain consumed   |
| AI failure           | Credits refunded          |
| Invalid AI response  | Credits refunded          |
| Timeout              | Credits refunded          |
| Duplicate request    | No double charge          |
| Concurrent requests  | Atomic balance protection |
| Unauthorized request | 401                       |
| Other user's wallet  | 403/404                   |
| Provider error       | Safe application error    |
| Database failure     | Transaction rollback      |

---

# 48. Observability

Every AI operation should be traceable using:

```text
request_id
user_id
service
AI model
credit transaction reference
status
```

Example:

```text
request_id:
req_123

user:
user_abc

service:
MATCH_ANALYSIS

credit transaction:
txn_789

AI request:
ai_456
```

This allows support/admin to investigate a user's credit issue.

---

# 49. Logging

Log important backend events:

```text
AI_REQUEST_STARTED
AI_REQUEST_SUCCESS
AI_REQUEST_FAILED
CREDIT_CONSUMED
CREDIT_REFUNDED
INSUFFICIENT_CREDITS
AI_PROVIDER_ERROR
AI_TIMEOUT
IDEMPOTENCY_REPLAY
```

Do NOT log:

```text
Gemini API keys
Clerk secrets
Sensitive resume contents
Full prompts containing private user data
```

---

# 50. Frontend Requirements

Frontend should show:

```text
Available Credits: 5
```

before AI actions where useful.

When insufficient:

```text
Not enough credits for this action.
```

The frontend should never calculate the authoritative balance.

After successful AI usage:

```text
5 credits
 ↓
3 credits
```

Refresh the balance from the backend.

Do not simply:

```js
setCredits(credits - 2)
```

and assume it is correct.

---

# 51. AI Feature UX

Before calling an AI operation, the frontend can display:

```text
This action uses 2 credits.
```

But the backend remains authoritative.

If the server says:

```text
INSUFFICIENT_CREDITS
```

the frontend must handle that response.

---

# 52. Recommended Backend Structure

Adapt to the existing Quick AI architecture, but aim for separation similar to:

```text
src/
├── controllers/
│   ├── aiController.js
│   └── creditController.js
│
├── services/
│   ├── aiService.js
│   ├── aiCreditService.js
│   └── creditService.js
│
├── repositories/
│   ├── aiRequestRepository.js
│   ├── creditWalletRepository.js
│   └── creditTransactionRepository.js
│
├── middleware/
│   └── auth.js
│
├── utils/
│   └── errors.js
│
└── config/
    └── aiPricing.js
```

Do not restructure the entire project if the current architecture already has equivalent layers.

Follow the existing conventions.

---

# 53. Important Separation

Keep these concepts separate:

```text
Authentication
    ↓
Who is the user?

Authorization / Entitlement
    ↓
What can the user access?

Credit system
    ↓
How many AI operations can the user afford?

AI service
    ↓
What does the AI actually do?

AI usage tracking
    ↓
What did the operation cost us?
```

Do not combine all of these into `auth.js`.

---

# 54. AI Service Contract

Every AI service should return structured information.

Conceptually:

```js
{
  result,
  usage: {
    inputTokens,
    outputTokens,
    totalTokens
  },
  provider: "google",
  model: "gemini-..."
}
```

The credit system should not need to understand the AI response itself.

---

# 55. Separation of Business Cost and Provider Cost

Example:

```text
AI provider:
$0.0037

Application:
2 credits
```

The AI service reports:

```text
actual provider usage
```

The credit service controls:

```text
application credit consumption
```

These should remain independent.

---

# 56. Future Pricing Changes

Later, you may change:

```text
MATCH_ANALYSIS
2 credits
```

to:

```text
MATCH_ANALYSIS
3 credits
```

without changing the Gemini implementation.

This is why credit pricing must be centralized.

---

# 57. Phase 3 Acceptance Criteria

Phase 3 is complete when:

### Wallet

* [ ] Every authenticated user can obtain a wallet.
* [ ] Initial grant is idempotent.
* [ ] Wallet cannot become negative.

### AI

* [ ] JD Analysis consumes configured credits.
* [ ] Match Analysis consumes configured credits.
* [ ] Resume Optimization consumes configured credits.
* [ ] AI operations cannot bypass credit checks.

### Failure handling

* [ ] Failed AI calls are refunded.
* [ ] Invalid AI responses are refunded.
* [ ] Timeouts are refunded.
* [ ] Failed database transactions do not leave inconsistent balances.

### Tracking

* [ ] Every AI request is recorded.
* [ ] Token usage is recorded.
* [ ] Provider cost is recorded.
* [ ] Credits consumed are recorded.
* [ ] AI service is recorded.
* [ ] Status is recorded.

### Security

* [ ] User ID comes from authentication.
* [ ] Credit cost comes from backend configuration.
* [ ] Users cannot modify their own balance.
* [ ] Users cannot access another user's wallet.
* [ ] Users cannot access another user's AI usage.

### Reliability

* [ ] Duplicate requests do not double-charge.
* [ ] Concurrent requests cannot overspend.
* [ ] Credit operations are transactional.
* [ ] AI requests can be traced back to credit transactions.

---

# 58. Definition of Done

Phase 3 is considered complete only when:

```text
Authentication
      ↓
User
      ↓
Wallet
      ↓
Credit Check
      ↓
Atomic Credit Consumption
      ↓
AI Request
      ↓
AI Validation
      ↓
Usage Tracking
      ↓
Success / Refund
```

works reliably for every credit-consuming AI feature.

The system must be safe against:

```text
double requests
race conditions
insufficient balance
provider failures
timeouts
invalid AI responses
frontend manipulation
```

---

# 59. Phase 3 Deliverables

Implementation should produce:

```text
1. AI credit service
2. AI credit configuration
3. AI request tracking improvements
4. Credit consumption integration
5. Refund handling
6. Idempotency protection
7. Concurrency protection
8. AI cost tracking
9. Credit API improvements
10. Frontend credit display/handling
11. Admin AI usage metrics
12. Automated tests
13. Database migrations if required
14. Updated environment/config documentation
```

---

# 60. Explicit Non-Goals

Do NOT expand Phase 3 into a complete billing system.

The purpose of this phase is:

> **Make AI usage financially controllable through credits.**

Not:

> Build subscriptions and payments.

Those will come later.

---

# 61. Future Roadmap

```text
Phase 1
Authentication + User Identity
        ↓
Phase 2
Credit Wallet + Immutable Ledger
        ↓
Phase 3
AI Credit Consumption ← CURRENT
        ↓
Phase 4
Free Plan + Entitlements
        ↓
Phase 5
Paid Plans + Subscriptions
        ↓
Phase 6
Credit Top-ups
        ↓
Phase 7
Razorpay Integration
        ↓
Future
Advanced Career AI Features
```

---

# 62. Final Architecture

The target architecture after Phase 3:

```text
                    ┌──────────────┐
                    │    Clerk     │
                    │     Auth     │
                    └──────┬───────┘
                           │
                           ▼
                    ┌──────────────┐
                    │    Users     │
                    └──────┬───────┘
                           │
                           ▼
                    ┌──────────────┐
                    │Credit Wallet │
                    └──────┬───────┘
                           │
                    Atomic Check
                           │
                           ▼
                    ┌──────────────┐
                    │Credit Ledger │
                    └──────┬───────┘
                           │
                       AI_USAGE
                           │
                           ▼
                    ┌──────────────┐
                    │  AI Service  │
                    └──────┬───────┘
                           │
                           ▼
                    ┌──────────────┐
                    │    Gemini    │
                    └──────┬───────┘
                           │
                    Token / Cost
                           │
                           ▼
                    ┌──────────────┐
                    │ ai_requests  │
                    └──────────────┘
```

---

## Phase 3 Principle

> **Every AI request must have a clear cost, every cost must be backed by credits, and every credit movement must be auditable.**

The frontend can request an AI operation.

The AI service can execute the operation.

But only the backend credit system decides whether the user can afford it.
