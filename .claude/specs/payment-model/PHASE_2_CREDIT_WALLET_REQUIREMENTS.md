# PHASE_2_CREDIT_WALLET_REQUIREMENTS.md

# Phase 2 — Credit Wallet & Immutable Ledger

## 1. Objective

Build the application's internal credit infrastructure.

Phase 2 introduces:

* Credit Wallet
* Immutable Credit Ledger
* Credit transaction types
* Atomic credit operations
* Balance validation
* Idempotent credit operations
* Initial credit grant
* Backend-controlled credit management

Phase 2 must **not** implement payments, subscriptions, or AI credit consumption.

The goal is to create a reliable financial-style accounting foundation that later phases can safely build upon.

---

# 2. Current State

Phase 1 authentication is complete.

The application currently uses:

```text
Clerk
    ↓
Backend Authentication
    ↓
PostgreSQL users
    ↓
Application Data
```

The application continues to use the existing Clerk user ID as the internal user identity.

Therefore:

```text
users.id = Clerk user ID
```

All Phase 2 credit records must reference this existing internal user ID.

---

# 3. Phase 2 Architecture

```text
Authenticated User
        ↓
users.id
        ↓
Credit Wallet
        ↓
Credit Ledger
        ↓
Future AI Usage
        ↓
Future Subscriptions
        ↓
Future Payments
```

The credit system must be completely backend-controlled.

The frontend must never directly modify:

* Wallet balance
* Credit transactions
* Credit grants
* Credit consumption

---

# 4. Scope

## Included

Phase 2 includes:

* Credit wallet database model
* Credit transaction database model
* Credit transaction types
* Wallet creation
* Initial credit grant
* Credit balance retrieval
* Credit grant service
* Credit consumption service
* Credit refund service
* Admin adjustment service foundation
* Atomic transactions
* Insufficient-credit handling
* Idempotency
* Ledger integrity
* Basic credit APIs
* Unit/integration tests

## Excluded

Do NOT implement:

* Razorpay
* Payment processing
* Subscriptions
* Monthly subscription renewal
* Paid plans
* Credit top-up purchases
* AI credit consumption integration
* Billing UI
* Payment webhooks
* Advanced billing analytics

These belong to later phases.

---

# 5. Database Design

## 5.1 Credit Wallet

Create:

```text
credit_wallets
```

Recommended fields:

```text
id
user_id
balance
lifetime_granted
lifetime_purchased
lifetime_used
created_at
updated_at
```

### Field Requirements

### `id`

* Primary key
* UUID recommended

### `user_id`

* References `users.id`
* Unique
* One wallet per user

Constraint:

```text
UNIQUE(user_id)
```

### `balance`

Current available credits.

Requirements:

```text
balance >= 0
```

### `lifetime_granted`

Total credits granted by the system.

Includes:

```text
INITIAL_GRANT
BONUS
SUBSCRIPTION_GRANT
```

Subscription-related values are future-facing and do not need to be generated in Phase 2.

### `lifetime_purchased`

Credits purchased through future payment systems.

Phase 2 should initialize this value to:

```text
0
```

### `lifetime_used`

Total credits consumed by the user.

Phase 2 may keep this at:

```text
0
```

until AI credit consumption is implemented.

### `created_at`

Wallet creation timestamp.

### `updated_at`

Last wallet modification timestamp.

---

# 6. Credit Transaction Ledger

Create:

```text
credit_transactions
```

Recommended fields:

```text
id
user_id
type
amount
balance_after
reference_id
metadata
created_at
```

The ledger is the historical record of every credit balance change.

---

# 7. Transaction Types

Supported transaction types:

```text
INITIAL_GRANT
BONUS
PURCHASE
SUBSCRIPTION_GRANT
AI_USAGE
REFUND
ADMIN_ADJUSTMENT
```

### INITIAL_GRANT

Credits granted when the wallet is initially created.

Example:

```text
+3 credits
```

### BONUS

Promotional or manually granted credits.

Example:

```text
+5 credits
```

### PURCHASE

Reserved for future credit-pack purchases.

Phase 2 should support the transaction type but must not implement payment processing.

### SUBSCRIPTION_GRANT

Reserved for future subscription credits.

Do not implement subscription logic in Phase 2.

### AI_USAGE

Reserved for Phase 3.

Do not connect AI services to this transaction type yet.

### REFUND

Credits returned to a user.

Example:

```text
AI operation failed after credit reservation
        ↓
REFUND
```

Phase 2 should provide the refund mechanism even though AI integration comes later.

### ADMIN_ADJUSTMENT

Manual administrative credit correction.

Example:

```text
+10 credits
Reason: Support compensation
```

---

# 8. Ledger Rules

The ledger must be **append-only**.

Existing transactions must never be modified to correct a balance.

Incorrect transaction:

```text
AI_USAGE -5
```

must not be edited.

Instead:

```text
AI_USAGE -5
        ↓
REFUND +5
```

This preserves a complete audit trail.

---

# 9. Transaction Amount Convention

Use signed transaction amounts.

Examples:

```text
INITIAL_GRANT       +3
BONUS               +5
PURCHASE            +20
SUBSCRIPTION_GRANT  +60
AI_USAGE            -5
REFUND              +5
ADMIN_ADJUSTMENT    +10
```

Positive values increase the balance.

Negative values decrease the balance.

---

# 10. Balance After

Every transaction must record:

```text
balance_after
```

Example:

```text
Transaction 1

amount = +3
balance_after = 3
```

Then:

```text
Transaction 2

amount = -1
balance_after = 2
```

Then:

```text
Transaction 3

amount = +10
balance_after = 12
```

This makes the ledger easier to audit and debug.

---

# 11. Credit Service

Create a centralized backend service.

Recommended:

```text
creditService
```

The application must not modify wallet balances directly from controllers.

Controllers should call the credit service.

Recommended operations:

```text
getBalance(userId)

grantCredits(userId, amount, type, reference)

consumeCredits(userId, amount, reference)

refundCredits(userId, amount, reference)

adjustCredits(userId, amount, reason)
```

---

# 12. getBalance()

Purpose:

Return the current available credit balance.

Input:

```text
userId
```

Output:

```json
{
  "balance": 10
}
```

Requirements:

* User must exist.
* Wallet must exist or be safely initialized.
* No credit transaction should be created.
* Operation must be read-only.

---

# 13. grantCredits()

Purpose:

Increase a user's credit balance.

Example:

```text
grantCredits(
    userId,
    3,
    INITIAL_GRANT,
    reference
)
```

Expected behavior:

```text
Current balance: 0

Grant: +3

New balance: 3
```

The operation must:

1. Validate user.
2. Validate amount.
3. Create wallet if necessary.
4. Increase balance.
5. Update lifetime granted where appropriate.
6. Insert ledger transaction.
7. Commit atomically.

---

# 14. consumeCredits()

Purpose:

Decrease available credits.

Example:

```text
consumeCredits(
    userId,
    5,
    AI_USAGE,
    reference
)
```

If:

```text
balance = 10
```

result:

```text
balance = 5
```

If:

```text
balance = 3
requested = 5
```

the operation must fail.

Expected error:

```text
INSUFFICIENT_CREDITS
```

The balance must remain:

```text
3
```

No ledger transaction should be created for a failed consumption.

---

# 15. Negative Balance Protection

The system must never allow:

```text
balance < 0
```

Both application logic and database constraints should protect against negative balances where supported by the database design.

Example:

```text
Balance = 2

Attempt:
consume 5

Result:
ERROR: INSUFFICIENT_CREDITS

Balance:
2
```

---

# 16. Atomic Operations

Wallet updates and ledger inserts must occur in the same database transaction.

Example:

```text
BEGIN

Read wallet
      ↓
Validate balance
      ↓
Update wallet
      ↓
Insert credit transaction
      ↓
COMMIT
```

If any step fails:

```text
ROLLBACK
```

Never allow:

```text
Wallet updated
+
Ledger insertion failed
```

or:

```text
Ledger inserted
+
Wallet update failed
```

---

# 17. Concurrency Protection

Credit operations may happen concurrently.

Example:

```text
Request A → consume 5
Request B → consume 5
```

when:

```text
balance = 5
```

Only one request should succeed.

The implementation must use appropriate PostgreSQL transaction/row-locking or atomic update techniques to prevent double spending.

The final balance must never become negative.

---

# 18. Idempotency

Credit-changing operations must support idempotency.

This is especially important for future payment webhooks.

Example:

```text
reference_id = payment_123
```

If the same operation is processed twice:

```text
PURCHASE +12
PURCHASE +12
```

the second operation must not create another credit grant.

Expected:

```text
First request:
+12

Second identical request:
ignored / return existing result
```

The database should enforce the appropriate uniqueness constraint.

Recommended logical uniqueness:

```text
user_id
type
reference_id
```

The exact constraint may be adjusted depending on the final implementation.

---

# 19. Initial Credit Grant

When a new application user receives their wallet, grant an initial amount.

The value must be configurable.

Example:

```text
INITIAL_GRANT = 3
```

Do not hard-code `3` inside business logic.

Use configuration:

```text
INITIAL_CREDIT_GRANT
```

Example:

```env
INITIAL_CREDIT_GRANT=3
```

The exact value may change later when the Free plan is finalized.

---

# 20. Wallet Creation

Wallet creation should be idempotent.

Expected:

```text
First request
    ↓
Create wallet
    ↓
Initial grant

Second request
    ↓
Existing wallet
    ↓
Do nothing
```

The system must never grant the initial credits twice.

---

# 21. User Isolation

A user must only access their own wallet.

Example:

```text
User A
    ↓
GET /api/credits
    ↓
User A wallet
```

User A must not be able to request:

```text
GET /api/credits?userId=userB
```

and receive User B's balance.

The backend must derive the user identity from the authenticated session.

Never trust a frontend-provided `userId`.

---

# 22. API Requirements

Phase 2 may expose a minimal credit API.

## GET `/api/credits`

Returns the authenticated user's current balance.

Example:

```json
{
  "balance": 3
}
```

## GET `/api/credits/transactions`

Returns the authenticated user's credit transaction history.

Requirements:

* Authentication required
* User-scoped
* Pagination supported
* Newest transactions first

Example response:

```json
{
  "transactions": [
    {
      "id": "transaction-id",
      "type": "INITIAL_GRANT",
      "amount": 3,
      "balanceAfter": 3,
      "createdAt": "2026-09-30T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1
  }
}
```

Do not expose internal metadata unnecessarily.

---

# 23. Admin Credit Operations

Phase 2 should prepare the foundation for administrative adjustments.

Admin functionality should use:

```text
adjustCredits()
```

rather than directly modifying the wallet.

Example:

```text
Admin
 ↓
+10 credits
 ↓
ADMIN_ADJUSTMENT
 ↓
Wallet +10
```

The adjustment should include a reason.

Example:

```text
reason = "Support compensation for failed processing"
```

Actual admin UI can be implemented later if required.

---

# 24. Auditability

Every credit-changing operation must be explainable.

Given a user's current balance:

```text
37
```

an administrator should be able to inspect the ledger and understand how the balance was produced.

Example:

```text
INITIAL_GRANT       +3
BONUS               +5
PURCHASE           +30
AI_USAGE            -1
AI_USAGE            -5
REFUND              +5
--------------------------------
Current Balance     37
```

The ledger must therefore be treated as an accounting history, not merely a log.

---

# 25. Error Handling

Use consistent error codes.

Recommended:

```text
UNAUTHENTICATED
USER_NOT_FOUND
WALLET_NOT_FOUND
INVALID_CREDIT_AMOUNT
INSUFFICIENT_CREDITS
DUPLICATE_TRANSACTION
INVALID_TRANSACTION_TYPE
CREDIT_OPERATION_FAILED
```

Do not expose internal database errors directly to users.

---

# 26. Validation

Credit amounts must be validated.

For grant/consume operations:

```text
amount > 0
```

Do not allow:

```text
grantCredits(userId, -10)
consumeCredits(userId, -5)
```

Signed amounts should be generated internally based on the transaction type.

Controllers/services should not accept arbitrary signed values from clients.

---

# 27. Database Indexes

Recommended indexes:

```text
credit_wallets.user_id UNIQUE
```

For transactions:

```text
credit_transactions.user_id
credit_transactions.created_at
```

For transaction history:

```text
(user_id, created_at DESC)
```

Add additional indexes only when supported by actual query patterns.

---

# 28. Testing Requirements

## Wallet Creation

Test:

```text
New user
→ wallet created
→ initial credits granted
```

## Duplicate Wallet Creation

Test:

```text
Create wallet
→ Create wallet again
→ only one wallet exists
→ initial grant happens once
```

## Grant Credits

Test:

```text
0
+
10
=
10
```

## Consume Credits

Test:

```text
10
-
4
=
6
```

## Insufficient Credits

Test:

```text
3
-
5
=
ERROR
```

Balance must remain:

```text
3
```

## Refund

Test:

```text
5
+
5
=
10
```

## Idempotency

Test the same reference twice:

```text
PURCHASE
reference = abc123
amount = 10
```

Expected:

```text
First → +10
Second → no additional credits
```

## Concurrent Consumption

Test two simultaneous requests against the same wallet.

Ensure credits cannot be double-spent.

## User Isolation

Ensure User A cannot access User B's:

* Balance
* Transactions
* Wallet

---

# 29. Security Requirements

* Credit modifications must only happen server-side.
* Frontend cannot modify balances.
* Frontend cannot create ledger entries.
* Frontend cannot select another user's wallet.
* Every operation requires authentication.
* Admin adjustments require proper authorization.
* Ledger records must not be editable through normal application APIs.
* Do not expose unnecessary metadata.
* Do not trust credit amounts from the client.

---

# 30. Phase 2 Configuration

Introduce configuration for values that may change later.

Example:

```env
INITIAL_CREDIT_GRANT=3
```

Do not hard-code future plan values such as:

```text
Starter = 20
Pro = 60
Power = 150
```

Those belong to the subscription/plan phase.

---

# 31. Recommended Project Structure

Adapt this to the existing project structure rather than creating unnecessary folders.

Example:

```text
src/
├── services/
│   └── creditService.*
│
├── controllers/
│   └── creditController.*
│
├── routes/
│   └── creditRoutes.*
│
├── middleware/
│   └── auth.*
│
└── ...
```

Database migrations should contain:

```text
credit_wallets
credit_transactions
```

Keep credit business logic centralized.

---

# 32. Definition of Done

Phase 2 is complete when all of the following are true:

* [ ] `credit_wallets` table exists.
* [ ] `credit_transactions` table exists.
* [ ] Wallet belongs to exactly one application user.
* [ ] User identity uses the existing `users.id`.
* [ ] Initial credit grant is configurable.
* [ ] Initial grant can only happen once.
* [ ] Credit transactions are append-only.
* [ ] Every balance change creates a ledger entry.
* [ ] `balance_after` is recorded.
* [ ] Negative balances are impossible.
* [ ] Credit operations are atomic.
* [ ] Concurrent consumption is safe.
* [ ] Credit-changing operations support idempotency.
* [ ] `getBalance()` exists.
* [ ] `grantCredits()` exists.
* [ ] `consumeCredits()` exists.
* [ ] `refundCredits()` exists.
* [ ] `adjustCredits()` foundation exists.
* [ ] User isolation is enforced.
* [ ] Credit APIs require authentication.
* [ ] Transaction history supports pagination.
* [ ] Unit/integration tests cover critical wallet behavior.
* [ ] No Razorpay integration exists yet.
* [ ] No subscription logic exists yet.
* [ ] No AI credit deduction exists yet.
* [ ] No billing UI exists yet.

---

# 33. Final Architecture

After Phase 2:

```text
                         ┌──────────────┐
                         │    Clerk     │
                         │     Auth     │
                         └──────┬───────┘
                                │
                                ↓
                         ┌──────────────┐
                         │ Auth Middleware
                         └──────┬───────┘
                                │
                                ↓
                         ┌──────────────┐
                         │    users     │
                         └──────┬───────┘
                                │
                                │ user.id
                                ↓
                    ┌──────────────────────┐
                    │    Credit Service    │
                    └──────────┬───────────┘
                               │
                    ┌──────────┴──────────┐
                    ↓                     ↓
             ┌──────────────┐    ┌──────────────────┐
             │ Credit Wallet│    │ Credit Transactions│
             └──────────────┘    └──────────────────┘
```

---

# 34. Future Phase Integration

Phase 2 must provide stable interfaces for future phases.

### Phase 3

AI services will call:

```text
consumeCredits()
```

and potentially:

```text
refundCredits()
```

### Phase 4

Free-plan logic will determine:

```text
initial credits
monthly limits
```

### Phase 5

Subscription plans will grant:

```text
SUBSCRIPTION_GRANT
```

### Phase 6

Credit purchases will create:

```text
PURCHASE
```

### Phase 7

Razorpay webhooks will trigger verified:

```text
PURCHASE
```

or:

```text
SUBSCRIPTION_GRANT
```

The credit service itself should not need to know how the payment was made.

---

# Phase 2 Principle

Keep the credit system independent from billing.

```text
Authentication
      ↓
Application User
      ↓
Credit Wallet
      ↓
Immutable Ledger
```

Payments, subscriptions, and AI usage should become clients of this credit system later.

The wallet is the current state.

The ledger is the history.

The credit service is the only layer allowed to change the wallet.
