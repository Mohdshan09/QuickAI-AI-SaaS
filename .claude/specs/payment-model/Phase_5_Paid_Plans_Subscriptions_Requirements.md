# Phase_5_Paid_Plans_Subscriptions_Requirements

## 1. Objective

Phase 5 introduces the paid-plan architecture for Quick AI.

Phase 4 established:

* Free plan
* Plan definitions
* Feature entitlements
* Monthly usage limits
* Server-side entitlement checks

Phase 5 extends this system with:

* Paid plans
* Subscription records
* Subscription lifecycle
* Plan activation
* Subscription expiration
* Subscription-based entitlements
* Subscription grants
* Recurring credit grants
* Subscription status APIs
* Admin subscription management

### Important

Phase 5 does **not** integrate a payment provider.

Razorpay/payment processing belongs to Phase 7.

Therefore Phase 5 must build a **payment-provider-independent subscription system**.

---

# 2. Phase 5 Scope

### Included

* Paid plan definitions
* Starter plan
* Pro plan
* Power plan
* Subscription table
* Subscription status
* Subscription lifecycle
* Current-plan resolution
* Subscription-based entitlement resolution
* Recurring credit grant configuration
* Subscription credit grants
* Subscription history
* Subscription cancellation state
* Subscription expiration
* Admin subscription management
* Subscription API
* Frontend pricing/subscription UI
* Tests

### Not Included

* Razorpay
* Payment checkout
* Payment webhooks
* Real payment verification
* Invoice generation
* Refund processing
* Credit top-up purchases
* Coupon system
* Tax/GST calculation
* Payment provider customer IDs
* Payment provider subscription IDs as authoritative state

These belong to later phases.

---

# 3. Existing Architecture

After Phase 5:

```text
Authentication
      ↓
Application User
      ↓
Subscription
      ↓
Plan
      ↓
Entitlements
      ↓
Feature Access

Credits
      ↓
AI Operation Cost
      ↓
AI Execution
```

The system now has two separate concepts:

```text
Subscription
= What plan does the user have?

Credits
= How many AI operations can the user perform?
```

---

# 4. Plan Structure

The application should support:

```text
FREE
STARTER
PRO
POWER
```

Initial proposed plans:

| Plan    | Monthly Price | Monthly Credits |
| ------- | ------------: | --------------: |
| FREE    |            ₹0 |               3 |
| STARTER |           ₹99 |              20 |
| PRO     |          ₹249 |              60 |
| POWER   |          ₹499 |             150 |

These values must be stored in the database/configuration rather than hardcoded into frontend components.

Pricing is configuration, not business logic.

---

# 5. Plan Responsibilities

Plans control:

* Feature availability
* Monthly usage limits
* Monthly credit grants
* Plan-specific limits

Credits control:

* AI operation consumption
* AI operation affordability
* Credit balance

Example:

```text
PRO
      ↓
Match Analysis enabled
      ↓
User has 10 credits
      ↓
Match costs 2 credits
      ↓
Operation allowed
      ↓
8 credits remaining
```

---

# 6. Plan Database

Extend the Phase 4 `plans` table.

Recommended structure:

```sql
plans
-----
id
key
name
description
price
currency
billing_interval
monthly_credits
is_active
created_at
updated_at
```

Example:

```text
FREE
price = 0
currency = INR
billing_interval = MONTHLY
monthly_credits = 3

STARTER
price = 99
currency = INR
billing_interval = MONTHLY
monthly_credits = 20

PRO
price = 249
currency = INR
billing_interval = MONTHLY
monthly_credits = 60

POWER
price = 499
currency = INR
billing_interval = MONTHLY
monthly_credits = 150
```

---

# 7. Billing Interval

Phase 5 should initially support:

```text
MONTHLY
```

The architecture should allow:

```text
YEARLY
```

later.

Do not implement annual billing in this phase unless required.

---

# 8. Subscription Table

Create:

```sql
subscriptions
-------------
id
user_id
plan_id
status
billing_interval
started_at
current_period_start
current_period_end
cancel_at_period_end
cancelled_at
ended_at
created_at
updated_at
```

Recommended statuses:

```text
ACTIVE
CANCELLED
EXPIRED
PAST_DUE
PAUSED
```

For Phase 5, the primary active states are:

```text
ACTIVE
CANCELLED
EXPIRED
```

Additional states may exist for future payment-provider integration.

---

# 9. Subscription Ownership

A subscription belongs to a user.

```text
users
  ↓
subscriptions
  ↓
plans
```

A user may have multiple historical subscriptions.

Example:

```text
User
 ├── FREE
 │
 ├── STARTER
 │
 └── PRO
```

Only one subscription should be considered the current active subscription.

Historical subscriptions must remain available for auditing.

---

# 10. Current Subscription

Create a central resolver:

```js
subscriptionService.getCurrentSubscription(userId)
```

It should return the currently active subscription.

Do not duplicate this query throughout controllers.

---

# 11. Current Plan Resolution

The user's effective plan should be resolved in this order:

```text
Authenticated user
       ↓
Active subscription?
       ↓
YES → subscription.plan
       ↓
NO
       ↓
FREE
```

Therefore a user does not need a permanent `plan = PRO` field on the user table.

The subscription determines paid-plan status.

---

# 12. Free Users

Users without an active paid subscription remain:

```text
FREE
```

Example:

```text
No active subscription
        ↓
FREE plan
        ↓
Free entitlements
```

This preserves the Phase 4 behavior.

---

# 13. Paid Users

Example:

```text
User
 ↓
Active PRO subscription
 ↓
PRO plan
 ↓
PRO entitlements
 ↓
60 monthly credits
```

The frontend must not determine whether the user is paid.

The backend resolves the active subscription.

---

# 14. Subscription Lifecycle

Basic lifecycle:

```text
FREE
 ↓
SUBSCRIPTION CREATED
 ↓
ACTIVE
 ↓
RENEWED
 ↓
ACTIVE
```

Cancellation:

```text
ACTIVE
 ↓
CANCEL REQUESTED
 ↓
cancel_at_period_end = true
 ↓
Current period continues
 ↓
PERIOD ENDS
 ↓
EXPIRED
 ↓
FREE
```

Do not immediately downgrade a user when they request cancellation if the subscription period has not ended.

---

# 15. Cancellation

Phase 5 should support cancellation state.

Example:

```text
cancel_at_period_end = true
```

This means:

```text
User has cancelled renewal
BUT
current subscription remains active until current_period_end
```

The user retains the current plan until the period ends.

---

# 16. Subscription Activation

Because payment processing is not implemented yet, Phase 5 needs a controlled activation mechanism.

For development/testing:

```text
Admin → activate subscription
```

or:

```text
Internal service → create subscription
```

This must NOT be exposed as:

```text
POST /api/subscription/activate
```

to arbitrary users.

The client must never be able to simply send:

```json
{
  "plan": "PRO",
  "status": "ACTIVE"
}
```

and activate a paid plan.

---

# 17. Phase 5 Payment Boundary

The architecture must clearly separate:

```text
Phase 5
Subscription Domain
```

from:

```text
Phase 7
Payment Provider
```

Phase 5 should be capable of receiving a future verified payment event:

```text
Payment Provider
       ↓
Verified payment event
       ↓
Subscription Service
       ↓
Create/renew subscription
       ↓
Grant credits
```

Razorpay is therefore an input to the subscription system, not the subscription system itself.

---

# 18. Subscription Service

Create:

```text
subscriptionService
```

Recommended methods:

```js
getCurrentSubscription(userId)

getCurrentPlan(userId)

createSubscription(userId, planId, options)

activateSubscription(subscriptionId)

cancelSubscription(subscriptionId)

renewSubscription(subscriptionId)

expireSubscription(subscriptionId)

changeSubscriptionPlan(subscriptionId, newPlanId)

getSubscriptionHistory(userId)
```

All state transitions should happen server-side.

---

# 19. Plan Service

Create:

```text
planService
```

Recommended methods:

```js
getPlans()

getPlan(planKey)

getPlanEntitlements(planId)

getPlanCreditGrant(planId)
```

The frontend should consume plan information from the API rather than maintaining duplicate plan configuration.

---

# 20. Subscription + Entitlements

Phase 4 entitlement resolution should now become:

```text
User
 ↓
Current Subscription
 ↓
Current Plan
 ↓
Plan Entitlements
 ↓
Feature Access
```

Example:

```text
FREE
 ↓
Resume Review
 ↓
3/month
```

versus:

```text
PRO
 ↓
Resume Review
 ↓
Higher configured limit
```

---

# 21. Subscription + Credits

Subscription and credits must remain separate.

When a subscription becomes active:

```text
Subscription activated
       ↓
Monthly credit grant
       ↓
Credit wallet
       ↓
Credit transaction
```

Example:

```text
PRO subscription
60 monthly credits
       ↓
SUBSCRIPTION_GRANT +60
       ↓
credit wallet
```

The credit transaction must identify the subscription as its source.

---

# 22. Subscription Credit Grant

Use the existing Phase 2 credit ledger.

Transaction:

```text
SUBSCRIPTION_GRANT
```

Example:

```text
amount = +60
reference_id = subscription_id
```

Do not directly modify:

```text
wallet.balance += 60
```

without creating a ledger transaction.

The wallet and ledger must remain consistent.

---

# 23. Initial Subscription Grant

When a user first activates a paid subscription:

```text
Create subscription
      ↓
Grant plan credits
      ↓
Create SUBSCRIPTION_GRANT transaction
```

Example:

```text
STARTER
20 credits
```

The wallet receives:

```text
+20
```

---

# 24. Monthly Renewal

At the beginning of a new subscription period:

```text
Previous period ends
       ↓
New period starts
       ↓
Grant monthly credits
       ↓
SUBSCRIPTION_GRANT
```

Example:

```text
PRO
60 credits/month
```

Every billing period:

```text
+60 credits
```

---

# 25. Credit Carryover

Phase 5 must explicitly define carryover behavior.

Recommended initial rule:

```text
Unused subscription credits DO NOT expire automatically
unless the plan configuration explicitly specifies expiration.
```

However, the architecture should support:

```text
credit_expiration_policy
```

for future plans.

Do not silently delete unused credits.

Any expiration in the future must create a ledger transaction.

---

# 26. Subscription Grant Idempotency

A subscription period must never receive its monthly grant twice.

Use a deterministic reference:

```text
SUBSCRIPTION_GRANT:{subscription_id}:{period_start}
```

Example:

```text
SUBSCRIPTION_GRANT:sub_123:2026-10-01
```

Before granting:

```text
Check reference
      ↓
Already exists?
      ↓
YES → do nothing
NO  → grant credits
```

This protects against:

* Retry
* Duplicate jobs
* Server restart
* Duplicate webhook later
* Manual retry

---

# 27. Plan Changes

Phase 5 should define plan changes even if automated billing is not yet active.

Supported conceptual operations:

```text
FREE → STARTER
STARTER → PRO
PRO → POWER
```

and downgrade:

```text
POWER → PRO
PRO → STARTER
STARTER → FREE
```

Actual payment/proration behavior is deferred.

Do not implement complicated proration in Phase 5.

---

# 28. Plan Change Policy

For Phase 5, use:

```text
Plan changes take effect at the next subscription period
```

unless an explicitly controlled admin/test operation requires immediate activation.

This avoids implementing payment-provider proration before Razorpay exists.

---

# 29. Subscription History

Never overwrite historical subscription information.

Example:

```text
Subscription #1
STARTER
Jan → Mar
EXPIRED

Subscription #2
PRO
Apr → Present
ACTIVE
```

This history is important for:

* Admin
* Support
* Billing reconciliation
* Future payment integration
* Analytics

---

# 30. Subscription API

## GET /api/subscription

Returns the current user's subscription.

Example:

```json
{
  "subscription": {
    "status": "ACTIVE",
    "plan": {
      "key": "PRO",
      "name": "Pro"
    },
    "billingInterval": "MONTHLY",
    "currentPeriodStart": "2026-10-01",
    "currentPeriodEnd": "2026-11-01",
    "cancelAtPeriodEnd": false
  }
}
```

---

# 31. GET /api/plans

Returns active plans available to users.

Example:

```json
{
  "plans": [
    {
      "key": "FREE",
      "name": "Free",
      "price": 0,
      "currency": "INR",
      "billingInterval": "MONTHLY",
      "monthlyCredits": 3
    },
    {
      "key": "STARTER",
      "name": "Starter",
      "price": 99,
      "currency": "INR",
      "billingInterval": "MONTHLY",
      "monthlyCredits": 20
    }
  ]
}
```

Only active public plans should be returned.

---

# 32. GET /api/subscription/history

Returns the authenticated user's subscription history.

Example:

```text
STARTER
ACTIVE
2026-08-01 → 2026-09-01

PRO
ACTIVE
2026-09-01 → Present
```

Users may view their own history only.

---

# 33. Cancel Subscription

Future-compatible endpoint:

```text
POST /api/subscription/cancel
```

The endpoint should:

```text
Authenticate user
      ↓
Find active subscription
      ↓
Set cancel_at_period_end = true
      ↓
Return updated subscription
```

It must not immediately delete the subscription.

---

# 34. Resume Cancellation

Support:

```text
POST /api/subscription/resume
```

If the subscription has not yet ended:

```text
cancel_at_period_end = false
```

This allows the user to resume renewal before the period ends.

---

# 35. Subscription State Rules

Invalid transitions must be rejected.

Example:

```text
EXPIRED → CANCELLED
```

should not be allowed.

Likewise:

```text
CANCELLED → ACTIVE
```

should require a valid new activation/renewal operation.

Centralize state transition logic.

---

# 36. Frontend Pricing Page

Phase 5 introduces the pricing UI.

Display:

```text
FREE
STARTER
PRO
POWER
```

For each plan:

* Price
* Billing interval
* Monthly credits
* Included features
* Usage limits
* Current plan indicator

Example:

```text
PRO

₹249 / month

60 AI credits / month

✓ Match Analysis
✓ Resume Optimization
✓ Resume Review
✓ Career tools
```

Do not add checkout buttons yet.

Instead:

```text
Coming soon
```

or an appropriate non-payment state.

---

# 37. Current Plan UI

The application should display:

```text
Current Plan: PRO
```

and:

```text
60 monthly credits
```

where appropriate.

The source must be:

```text
GET /api/subscription
GET /api/credits
GET /api/entitlements
```

Do not derive plan state from Clerk.

---

# 38. Subscription Status UI

Possible states:

```text
ACTIVE
CANCELLING
EXPIRED
```

For cancellation:

```text
Your Pro plan remains active until October 31.
```

Do not tell users that payment has been cancelled unless the payment system actually confirms it.

---

# 39. Admin Subscription Management

Admin should be able to see:

```text
User
Current plan
Subscription status
Subscription period
Cancellation state
Credit balance
Subscription history
```

For controlled testing, authorized admins may:

```text
Activate plan
Change plan
Cancel subscription
Resume subscription
Expire subscription
```

Every manual action requires:

```text
admin_user_id
target_user_id
action
old_state
new_state
reason
timestamp
```

---

# 40. Audit Logging

Subscription changes must create admin audit events.

Example:

```text
SUBSCRIPTION_ACTIVATED
SUBSCRIPTION_CANCELLED
SUBSCRIPTION_RESUMED
SUBSCRIPTION_PLAN_CHANGED
SUBSCRIPTION_EXPIRED
SUBSCRIPTION_CREDIT_GRANTED
```

This becomes important once real payments are introduced.

---

# 41. Security

Never trust:

```text
planKey
price
monthlyCredits
subscriptionStatus
```

from the frontend.

The server determines:

```text
Plan
Price
Entitlements
Credit grant
Subscription status
```

The frontend is only a presentation layer.

---

# 42. Payment Provider Boundary

The future architecture should look like:

```text
                Phase 5
        ┌─────────────────────┐
        │ Subscription Service│
        └──────────┬──────────┘
                   │
                   │
            Subscription DB
                   │
                   ▼
              Plan + Access
                   │
                   ▼
                Credits


                Phase 7
        ┌─────────────────────┐
        │      Razorpay       │
        └──────────┬──────────┘
                   │
            Verified webhook
                   │
                   ▼
        ┌─────────────────────┐
        │ Subscription Service│
        └─────────────────────┘
```

Razorpay should not become the application's business-logic layer.

---

# 43. No Clerk Billing

Do not introduce a second billing authority.

Clerk continues to provide:

```text
Authentication
Identity
Sessions
```

Quick AI owns:

```text
Plans
Entitlements
Subscriptions
Credits
AI usage
```

---

# 44. Testing Requirements

## Plan Tests

Test:

* All four plans exist
* Prices are correct in database configuration
* Monthly credit grants are correct
* Inactive plans are not publicly returned

## Subscription Tests

Test:

* Free user has no paid subscription
* Active subscription resolves correctly
* Historical subscriptions remain available
* Only one active subscription exists
* Cancellation marks `cancel_at_period_end`
* Cancellation does not immediately remove access
* Expired subscription falls back to FREE
* Invalid state transitions are rejected

## Credit Tests

Test:

* New paid subscription grants correct credits
* Duplicate grant does not add credits twice
* Renewal grants credits once per period
* Grant creates ledger transaction
* Subscription grant has correct reference
* Wallet and ledger remain consistent

## Entitlement Tests

Test:

```text
FREE → FREE entitlements
STARTER → STARTER entitlements
PRO → PRO entitlements
POWER → POWER entitlements
```

Changing subscription must change effective entitlements.

## Security Tests

Test:

* User cannot modify their own plan directly
* User cannot activate a paid subscription through arbitrary API input
* User cannot access another user's subscription
* User cannot modify subscription status
* Frontend cannot override plan
* Admin-only subscription operations require authorization

---

# 45. Acceptance Criteria

Phase 5 is complete when:

* FREE, STARTER, PRO and POWER plans exist
* Plan configuration is database-backed
* Subscription records exist independently from users
* Current plan is resolved from subscription state
* Users without paid subscriptions remain FREE
* Paid subscriptions can be activated through controlled server-side operations
* Subscription history is preserved
* Cancellation is supported
* Cancellation at period end is supported
* Subscription expiration returns the user to FREE
* Plan entitlements are resolved from the active plan
* Subscription activation grants configured credits
* Subscription renewal grants configured credits
* Duplicate grants are impossible
* Credit grants use the existing immutable ledger
* Frontend can display pricing and current plan
* Admin can inspect and manage subscriptions
* Subscription changes are audited
* No payment provider is integrated
* No Razorpay code is required
* No client-side plan authority exists

---

# 46. Phase 5 Architecture

```text
                         ┌──────────────┐
                         │    Clerk     │
                         │     Auth     │
                         └──────┬───────┘
                                │
                                ▼
                         ┌──────────────┐
                         │    users     │
                         └──────┬───────┘
                                │
                                ▼
                    ┌──────────────────────┐
                    │   subscriptions      │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │        plans         │
                    └──────────┬───────────┘
                               │
                    ┌──────────┴──────────┐
                    ▼                     ▼
          ┌──────────────────┐   ┌─────────────────┐
          │ Plan Entitlements│   │ Monthly Credits │
          └────────┬─────────┘   └────────┬────────┘
                   │                      │
                   ▼                      ▼
          ┌──────────────────┐   ┌─────────────────┐
          │ Feature Access   │   │ Credit Wallet   │
          └────────┬─────────┘   └────────┬────────┘
                   │                      │
                   └──────────┬───────────┘
                              ▼
                       ┌──────────────┐
                       │ AI Features  │
                       └──────┬───────┘
                              ▼
                       ┌──────────────┐
                       │ ai_requests  │
                       └──────────────┘
```

---

# 47. Phase Roadmap

```text
Phase 1
Authentication + User Identity
        ↓
Phase 2
Credit Wallet + Immutable Ledger
        ↓
Phase 3
AI Credit Consumption
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
Razorpay + Production Billing
```

---

# 48. Phase 5 Principle

The core rule is:

```text
Authentication
    ≠
Subscription
    ≠
Entitlement
    ≠
Credits
    ≠
Payment
```

Each system has one responsibility.

Phase 5 builds the **subscription domain**.

Phase 7 connects that domain to **real money**.
