# Phase_6_Credit_Topups_Requirements

## 1. Objective

Phase 6 introduces **one-time credit top-ups** to Quick AI.

Phase 5 established:

* Free plan
* Paid plans
* Subscriptions
* Subscription lifecycle
* Plan entitlements
* Monthly subscription credit grants

Phase 6 extends the credit system with:

* Credit top-up packs
* Top-up product configuration
* Top-up purchase records
* One-time credit grants
* Purchase history
* Top-up APIs
* Admin top-up management
* Top-up idempotency
* Credit ledger integration
* Frontend credit purchase UI

### Important

Phase 6 does **not** integrate a payment provider.

Razorpay belongs to Phase 7.

Therefore Phase 6 must build a **payment-provider-independent top-up system**.

---

# 2. Phase 6 Scope

### Included

* Credit pack definitions
* One-time credit packages
* Top-up purchase records
* Purchase lifecycle
* Credit grant after confirmed purchase
* Top-up history
* Top-up APIs
* Credit ledger integration
* Idempotent credit grants
* Admin top-up management
* Frontend top-up UI
* Tests

### Not Included

* Razorpay
* Payment checkout
* Payment webhooks
* Payment verification
* Refund processing
* Payment provider order IDs
* Payment provider payment IDs as authoritative state
* Coupons
* Tax/GST calculation
* Discounts
* Subscription changes
* Subscription renewal
* Automatic recurring top-ups

These belong to Phase 7 or later.

---

# 3. Existing Architecture

After Phase 6:

```text
                    ┌──────────────┐
                    │ Subscription │
                    └──────┬───────┘
                           │
                    Monthly Credits
                           │
                           ▼
                    ┌──────────────┐
                    │ Credit Wallet│
                    └──────┬───────┘
                           ▲
                           │
                    One-time Top-up
                           │
                    ┌──────┴───────┐
                    │  Credit Pack  │
                    └───────────────┘
```

There are now two ways credits can enter the wallet:

```text
Subscription
     ↓
SUBSCRIPTION_GRANT

Top-up
     ↓
PURCHASE
```

Both must use the existing immutable credit ledger.

---

# 4. Core Principle

A top-up is **not a subscription**.

Example:

```text
User
 ├── PRO subscription
 │     └── 60 monthly credits
 │
 └── Top-up purchase
       └── +30 credits
```

The user can therefore have:

```text
Subscription credits
+
Purchased credits
=
Wallet balance
```

Do not merge subscription and top-up concepts into one database record.

---

# 5. Credit Pack Structure

Create a configurable credit-pack table.

Recommended:

```sql
credit_packs
------------
id
key
name
description
credits
price
currency
is_active
created_at
updated_at
```

Example configuration:

| Pack   | Price | Credits |
| ------ | ----: | ------: |
| SMALL  |   ₹49 |       5 |
| MEDIUM |   ₹99 |      12 |
| LARGE  |  ₹199 |      30 |

These values are configuration.

Do not hardcode them into frontend components.

---

# 6. Credit Pack Responsibilities

A credit pack defines:

```text
What is being purchased?
How many credits does it provide?
What is its configured price?
Is it currently available?
```

Example:

```text
LARGE
₹199
30 credits
ACTIVE
```

The frontend displays this information.

The backend remains authoritative.

---

# 7. Price Authority

Never trust the frontend for:

```text
price
credits
pack key
currency
```

The frontend may send:

```json
{
  "packKey": "LARGE"
}
```

The backend must then load:

```text
credit_packs
```

and determine:

```text
price = 199
credits = 30
currency = INR
```

A client must never be able to send:

```json
{
  "packKey": "LARGE",
  "credits": 1000,
  "price": 1
}
```

and alter the purchase.

---

# 8. Top-up Purchase Table

Create:

```sql
credit_purchases
----------------
id
user_id
credit_pack_id
status
credits
amount
currency
created_at
confirmed_at
cancelled_at
updated_at
```

Recommended statuses:

```text
PENDING
CONFIRMED
CANCELLED
FAILED
REFUNDED
```

Phase 6 primarily uses:

```text
PENDING
CONFIRMED
```

The additional states prepare the system for Phase 7.

---

# 9. Purchase Snapshot

When creating a purchase, store the purchased values directly on the purchase record.

Example:

```text
credit_pack_id = large
credits = 30
amount = 199
currency = INR
```

Do not depend entirely on the current `credit_packs` row later.

Reason:

```text
Today:
LARGE = ₹199 → 30 credits

Future:
LARGE = ₹249 → 25 credits
```

Historical purchases must still show:

```text
₹199
30 credits
```

Therefore purchase records must preserve the original transaction values.

---

# 10. Purchase Ownership

A purchase belongs to one user.

```text
users
  ↓
credit_purchases
  ↓
credit_packs
```

Users must only be able to access their own purchases.

---

# 11. Purchase Creation

Phase 6 may create a purchase through a controlled server-side operation.

Example:

```text
User selects LARGE
        ↓
Backend validates pack
        ↓
Create PENDING purchase
        ↓
Payment provider not involved
```

The purchase should not receive credits simply because it was created.

Credits are granted only when:

```text
purchase.status = CONFIRMED
```

---

# 12. Purchase Confirmation

The central operation should be:

```js
creditPurchaseService.confirmPurchase(purchaseId)
```

It should:

```text
Validate purchase
       ↓
Check status
       ↓
Confirm purchase
       ↓
Grant credits
       ↓
Create PURCHASE ledger transaction
```

All relevant database operations should happen atomically.

---

# 13. Purchase Credit Grant

When a purchase is confirmed:

```text
Purchase
   ↓
+ credits
   ↓
Credit Wallet
   ↓
PURCHASE ledger transaction
```

Example:

```text
Purchase:
₹199
30 credits

Wallet:
+30
```

Ledger:

```text
type = PURCHASE
amount = +30
reference_id = purchase_id
```

Never grant purchased credits by directly changing the wallet without a ledger transaction.

---

# 14. Purchase Idempotency

A purchase must never grant credits twice.

Example:

```text
Purchase #123
status = CONFIRMED
credits = 30
```

Calling:

```js
confirmPurchase("123")
```

again must not produce:

```text
+30
+30
```

It must remain:

```text
+30
```

Use the purchase ID as the idempotency reference.

Recommended ledger reference:

```text
PURCHASE:{purchase_id}
```

---

# 15. Confirmation Flow

Recommended transaction:

```text
BEGIN

Lock purchase row

Check purchase status

IF already CONFIRMED:
    return existing result

IF invalid:
    reject

Update purchase:
    status = CONFIRMED
    confirmed_at = now()

Grant credits

Create PURCHASE ledger transaction

COMMIT
```

This protects against:

* Duplicate requests
* Concurrent requests
* Retry
* Server restart
* Future webhook retries

---

# 16. Credit Wallet

Continue using the Phase 2 wallet.

Do not create another wallet for purchased credits.

Example:

```text
Current balance
     10
      ↓
Top-up
     +30
      ↓
New balance
     40
```

The wallet remains the single spendable credit balance.

---

# 17. Credit Ledger

Existing transaction type:

```text
PURCHASE
```

must be used for top-ups.

Example:

```text
credit_transactions

type:
PURCHASE

amount:
+30

reference_id:
purchase_123
```

The ledger remains append-only.

Corrections must create new transactions.

Do not edit historical ledger rows.

---

# 18. Subscription Credits vs Purchased Credits

The ledger must distinguish their sources.

Example:

```text
+60  SUBSCRIPTION_GRANT
+30  PURCHASE
-2   AI_USAGE
```

This allows the system to answer:

```text
How many credits came from subscriptions?
How many were purchased?
How many were consumed?
```

Do not create separate wallets unless a future business requirement requires credit buckets.

---

# 19. Credit Consumption

Phase 6 does not change Phase 3 AI consumption.

Existing flow remains:

```text
AI Request
   ↓
Check entitlement
   ↓
Check credits
   ↓
Consume credits
   ↓
Execute AI
   ↓
Success → keep deduction
Failure → refund
```

Purchased credits are simply part of the same wallet balance.

---

# 20. Top-up + Subscription Example

User has:

```text
PRO subscription
60 monthly credits
```

They use:

```text
40 credits
```

Balance:

```text
20
```

They purchase:

```text
30-credit pack
```

Balance becomes:

```text
50
```

No special AI logic is required.

---

# 21. Top-up Expiration

Phase 6 should initially use:

```text
Purchased credits do not expire.
```

Do not silently remove purchased credits.

If expiration is introduced later, it must be explicitly modeled and recorded in the ledger.

---

# 22. Refund Preparation

Phase 6 does not implement payment refunds.

However, the architecture should support:

```text
REFUND
```

as an existing credit transaction type.

Future flow:

```text
Payment refund confirmed
        ↓
Credit refund policy
        ↓
REFUND ledger transaction
        ↓
Wallet adjustment
```

Refund handling belongs to Phase 7+.

---

# 23. Top-up Service

Create:

```text
creditPurchaseService
```

Recommended methods:

```js
getCreditPacks()

getCreditPack(packKey)

createPurchase(userId, packKey)

getPurchase(userId, purchaseId)

getPurchaseHistory(userId)

confirmPurchase(purchaseId)

cancelPurchase(purchaseId)

refundPurchase(purchaseId)
```

`refundPurchase()` may remain unimplemented in Phase 6 but should be reserved for future payment integration.

---

# 24. Credit Pack Service

Create:

```text
creditPackService
```

Recommended methods:

```js
getActivePacks()

getPack(packKey)

createPack()

updatePack()

disablePack()
```

Administrative mutation methods must be protected.

---

# 25. User APIs

## GET /api/credits/packs

Returns active credit packs.

Example:

```json
{
  "packs": [
    {
      "key": "SMALL",
      "name": "5 Credits",
      "credits": 5,
      "price": 49,
      "currency": "INR"
    },
    {
      "key": "MEDIUM",
      "name": "12 Credits",
      "credits": 12,
      "price": 99,
      "currency": "INR"
    },
    {
      "key": "LARGE",
      "name": "30 Credits",
      "credits": 30,
      "price": 199,
      "currency": "INR"
    }
  ]
}
```

Only active packs should be returned.

---

# 26. Create Purchase API

Recommended:

```text
POST /api/credits/purchases
```

Request:

```json
{
  "packKey": "LARGE"
}
```

Backend:

```text
Authenticate user
        ↓
Find active pack
        ↓
Snapshot price + credits
        ↓
Create purchase
        ↓
Return purchase
```

The API must not accept:

```text
price
credits
currency
```

as authoritative values.

---

# 27. Purchase Response

Example:

```json
{
  "purchase": {
    "id": "purchase_123",
    "status": "PENDING",
    "credits": 30,
    "amount": 199,
    "currency": "INR"
  }
}
```

Phase 6 may use this for controlled/admin testing.

---

# 28. Purchase History API

Recommended:

```text
GET /api/credits/purchases
```

Example:

```text
30 credits
₹199
CONFIRMED
Oct 1, 2026

12 credits
₹99
CONFIRMED
Sep 15, 2026
```

Users can view their own purchases only.

---

# 29. Purchase Details API

Recommended:

```text
GET /api/credits/purchases/:purchaseId
```

The endpoint must verify:

```text
purchase.user_id === authenticatedUser.id
```

unless the requester is an authorized admin.

---

# 30. Frontend Credit Top-up UI

Phase 6 introduces a credit purchase interface.

Example:

```text
Buy Credits

┌───────────────────────┐
│ 5 Credits             │
│ ₹49                   │
│                       │
│ [ Select ]            │
└───────────────────────┘

┌───────────────────────┐
│ 12 Credits            │
│ ₹99                   │
│                       │
│ [ Select ]            │
└───────────────────────┘

┌───────────────────────┐
│ 30 Credits            │
│ ₹199                  │
│                       │
│ [ Select ]            │
└───────────────────────┘
```

Because payment is not integrated:

```text
Purchase
```

may display:

```text
Coming soon
```

or be available only in controlled development/admin mode.

---

# 31. Current Balance

The frontend should continue displaying:

```text
Credit Balance: 42
```

using:

```text
GET /api/credits
```

Do not calculate:

```text
balance = subscriptionCredits + purchasedCredits
```

on the frontend.

The backend wallet remains authoritative.

---

# 32. Top-up History UI

Add:

```text
Credit History
```

with:

```text
Type
Amount
Status
Date
Reference
```

Example:

```text
PURCHASE
+30
Confirmed
Oct 1

AI_USAGE
-2
Completed
Oct 1

SUBSCRIPTION_GRANT
+60
Granted
Oct 1
```

---

# 33. Admin Dashboard

Admin should be able to see:

```text
Credit Packs
Top-up Purchases
Purchase Revenue
Credits Purchased
Purchase Status
User
Date
```

Phase 6 should not yet implement advanced financial analytics.

---

# 34. Admin Credit Pack Management

Authorized admins should be able to:

```text
Create credit pack
Edit credit pack
Disable credit pack
View pack usage
```

Disabled packs:

```text
Cannot be purchased
```

Existing historical purchases remain unchanged.

---

# 35. Admin Purchase Management

Admin should be able to inspect:

```text
Purchase ID
User
Pack
Credits
Amount
Status
Created At
Confirmed At
```

Controlled testing may allow:

```text
Confirm purchase
Cancel purchase
```

Every manual action must be audited.

---

# 36. Audit Logging

Create admin audit events such as:

```text
CREDIT_PACK_CREATED
CREDIT_PACK_UPDATED
CREDIT_PACK_DISABLED

PURCHASE_CREATED
PURCHASE_CONFIRMED
PURCHASE_CANCELLED
```

Audit data should include:

```text
admin_user_id
target_user_id
purchase_id
action
old_state
new_state
reason
timestamp
```

---

# 37. Security

Never trust the client for:

```text
price
credits
currency
purchase status
confirmation status
refund status
```

The backend determines all of them.

Users must not be able to:

```text
Confirm their own arbitrary purchase
Change purchase amount
Change credit amount
Change purchase owner
Modify purchase status
Grant themselves credits
```

---

# 38. Top-up Authorization

A normal user can:

```text
View available packs
Create a purchase
View own purchase history
View own purchase details
```

A normal user cannot:

```text
Confirm arbitrary purchases
Modify purchase status
Change pack price
Change pack credits
Grant credits
```

Admin/internal operations require appropriate authorization.

---

# 39. Payment Boundary

Phase 6 should prepare for:

```text
Phase 7
```

Future flow:

```text
User selects credit pack
        ↓
Create purchase
        ↓
Razorpay order
        ↓
User pays
        ↓
Razorpay webhook
        ↓
Verify payment
        ↓
Confirm purchase
        ↓
Grant credits
```

The important rule is:

```text
Payment confirmation
        ↓
Purchase confirmation
        ↓
Credit grant
```

Never:

```text
Frontend says payment successful
        ↓
Grant credits
```

---

# 40. Payment Provider Independence

Phase 6 must not depend on:

```text
Razorpay SDK
Razorpay webhook
Razorpay order ID
Razorpay payment ID
```

The purchase domain should work independently.

Phase 7 will adapt the payment provider's verified events into:

```js
creditPurchaseService.confirmPurchase(purchaseId)
```

---

# 41. Purchase Idempotency Key

The architecture should support an idempotency key for purchase creation.

Example:

```text
Idempotency-Key: client_generated_key
```

This prevents:

```text
Double click
Network retry
Browser retry
```

from creating multiple identical pending purchases unintentionally.

Recommended table field:

```text
idempotency_key
```

with a suitable uniqueness constraint scoped to the user.

---

# 42. Purchase State Machine

Recommended:

```text
PENDING
   │
   ├──────→ CONFIRMED
   │
   ├──────→ CANCELLED
   │
   └──────→ FAILED
```

Future:

```text
CONFIRMED
   ↓
REFUNDED
```

Invalid transitions must be rejected.

---

# 43. Credit Grant State

The system must guarantee:

```text
CONFIRMED purchase
        ↓
exactly one PURCHASE ledger grant
```

Not:

```text
CONFIRMED
        ↓
multiple grants
```

This must be enforced through database constraints and transactions, not only application-level checks.

---

# 44. Database Constraints

Recommended constraints:

```text
credit_packs.key
UNIQUE

credit_purchases.id
PRIMARY KEY

credit_transactions.reference_id
UNIQUE where applicable

credit_purchases.idempotency_key
UNIQUE per user

subscriptions
existing Phase 5 constraints
```

For purchase grants, ensure:

```text
PURCHASE:{purchase_id}
```

cannot appear more than once.

---

# 45. Transaction Safety

Purchase confirmation must be atomic.

Conceptually:

```text
BEGIN

Lock purchase

Verify purchase

Update purchase status

Lock wallet

Increase wallet balance

Insert PURCHASE ledger transaction

Update lifetime_purchased

COMMIT
```

If any operation fails:

```text
ROLLBACK
```

No partial credit grant should remain.

---

# 46. Lifetime Credit Statistics

Continue using the wallet statistics from Phase 2.

When a top-up is confirmed:

```text
lifetime_purchased += purchasedCredits
```

Example:

```text
Before:
balance = 20
lifetime_purchased = 50

Purchase:
+30

After:
balance = 50
lifetime_purchased = 80
```

Subscription grants must not increase `lifetime_purchased`.

---

# 47. Credit Source Reporting

The system should be able to report:

```text
Subscription credits granted
Purchased credits granted
Credits consumed
Credits refunded
Current balance
```

Example:

```text
Subscription grants: 120
Purchased: 60
Used: 95
Refunded: 2
Balance: 87
```

The exact accounting should come from the ledger/wallet rather than frontend calculations.

---

# 48. Testing Requirements

## Credit Pack Tests

Test:

* Active packs are returned
* Inactive packs are hidden
* Pack keys are unique
* Price is stored correctly
* Credit amount is stored correctly
* Historical purchases retain original values

## Purchase Tests

Test:

* Authenticated user can create a purchase
* Unknown pack is rejected
* Disabled pack cannot be purchased
* Client cannot override price
* Client cannot override credit amount
* Purchase belongs to authenticated user
* Purchase starts as PENDING

## Confirmation Tests

Test:

* PENDING → CONFIRMED works
* CONFIRMED → CONFIRMED is idempotent
* CANCELLED → CONFIRMED is rejected
* FAILED → CONFIRMED is rejected unless explicitly supported
* Confirmation grants credits exactly once
* Confirmation creates PURCHASE ledger transaction

## Wallet Tests

Test:

* Purchase increases balance
* Purchase increases lifetime purchased
* Subscription grant remains separate
* AI usage still consumes from same balance
* Refund mechanism remains compatible

## Concurrency Tests

Test:

```text
Two confirmation requests
        ↓
One purchase
        ↓
Exactly one credit grant
```

Also test concurrent wallet operations.

## Security Tests

Test:

* User cannot confirm another user's purchase
* User cannot change price
* User cannot change credits
* User cannot change status
* User cannot grant credits
* Admin actions require authorization

---

# 49. Acceptance Criteria

Phase 6 is complete when:

* Credit packs exist in the database
* Credit pack pricing is database-backed
* Credit pack credit amounts are database-backed
* Users can view active credit packs
* Users can create top-up purchases
* Purchase values are snapshotted
* Purchases have lifecycle states
* Confirmed purchases grant credits
* Purchased credits use the existing wallet
* Purchased credits use the existing immutable ledger
* `PURCHASE` transactions are created
* Duplicate confirmations cannot grant credits twice
* Purchase operations are transaction-safe
* Purchase history is available
* Users can only access their own purchases
* Admins can manage credit packs
* Admins can inspect purchases
* Admin actions are audited
* Purchased credits do not expire
* Subscription credits remain separate from purchased credits
* No Razorpay integration exists
* No payment provider is authoritative
* No client-side credit authority exists

---

# 50. Phase 6 Architecture

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
               ┌────────────────┴────────────────┐
               │                                 │
               ▼                                 ▼
      ┌──────────────────┐             ┌──────────────────┐
      │  Subscription    │             │ Credit Purchases │
      └────────┬─────────┘             └────────┬─────────┘
               │                                │
               ▼                                ▼
      SUBSCRIPTION_GRANT                    PURCHASE
               │                                │
               └──────────────┬─────────────────┘
                              ▼
                       ┌──────────────┐
                       │ Credit Wallet│
                       └──────┬───────┘
                              │
                              ▼
                       ┌──────────────┐
                       │ AI Features  │
                       └──────────────┘
```

---

# 51. Phase 6 Principle

The core rule is:

```text
Subscription
    ≠
Top-up Purchase
    ≠
Payment
```

A subscription provides recurring plan benefits.

A top-up provides one-time credits.

A payment provider only proves that money was successfully paid.

The application owns:

```text
Purchase
→ Credit Grant
→ Wallet
→ Ledger
```

---

# 52. Phase Roadmap

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

Phase 6 should finish the **credit economy** before real payments are introduced.

Phase 7 then connects:

```text
Real Money
    ↓
Razorpay
    ↓
Verified Payment
    ↓
Subscription / Purchase
    ↓
Credits
```

without changing the core wallet or AI consumption architecture.
