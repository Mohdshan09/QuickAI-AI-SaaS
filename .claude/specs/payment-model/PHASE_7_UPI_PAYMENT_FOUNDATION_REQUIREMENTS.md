# PHASE_7_UPI_PAYMENT_FOUNDATION_REQUIREMENTS

## 1. Objective

Introduce real-money payment support for Quick AI using **direct UPI payments with manual verification**.

The initial payment system will support users paying through:

* Google Pay
* PhonePe
* Paytm
* BHIM
* Any other UPI application

No payment gateway will be integrated in Phase 7.

The system will use:

```text
UPI Payment
     ↓
User submits payment reference
     ↓
Admin verifies payment
     ↓
Payment confirmed
     ↓
Subscription / Credits activated
```

This phase is intended for the early MVP while Quick AI has a relatively small number of paying users.

---

# 2. Core Principle

The frontend must never decide that a payment was successful.

The payment lifecycle is:

```text
PENDING
   ↓
ADMIN_REVIEW
   ↓
CONFIRMED
```

or:

```text
PENDING
   ↓
REJECTED
```

Only a `CONFIRMED` payment can trigger:

* Credit top-up
* Subscription activation
* Subscription credit grant

---

# 3. Scope

## Included

* UPI payment configuration
* UPI ID configuration
* UPI QR code
* Subscription payment flow
* Credit top-up payment flow
* Payment records
* User payment submission
* UTR / transaction reference submission
* Payment status tracking
* Admin payment verification
* Payment confirmation
* Payment rejection
* Credit ledger integration
* Subscription integration
* Idempotency
* Payment history
* Admin audit logs
* Basic refund record architecture

## Not Included

* Razorpay
* Stripe
* Payment gateway
* Automatic payment verification
* Payment webhooks
* Automatic recurring payments
* Auto-renewal
* Payment gateway APIs
* International payments
* Advanced invoicing
* GST automation
* Automated refunds

---

# 4. Payment Architecture

```text
                    Quick AI
                       │
              ┌────────┴────────┐
              │                 │
        Subscription        Credit Top-up
              │                 │
              └────────┬────────┘
                       ↓
                 Payment Record
                       ↓
                UPI Instructions
                       ↓
       ┌───────────────┼───────────────┐
       ↓               ↓               ↓
    GPay            PhonePe          Paytm
       │               │               │
       └───────────────┼───────────────┘
                       ↓
                 User completes
                    payment
                       ↓
                User submits UTR
                       ↓
                ADMIN_REVIEW
                       ↓
              ┌────────┴────────┐
              ↓                 ↓
          CONFIRMED          REJECTED
              ↓
       ┌──────┴──────┐
       ↓             ↓
    Credits      Subscription
```

---

# 5. UPI Configuration

The application must have a centralized payment configuration.

Example:

```env
UPI_ID=your-upi-id
UPI_ACCOUNT_NAME=Your Business/Name
UPI_QR_IMAGE_URL=
```

Do not hard-code the UPI ID throughout the frontend.

The backend should provide the payment configuration to authenticated users.

Example:

```http
GET /api/payments/config
```

Response:

```json
{
  "upiId": "example@upi",
  "accountName": "Quick AI",
  "currency": "INR"
}
```

---

# 6. QR Code

Quick AI should provide a QR code for easy payment.

The QR should encode the configured UPI payment information.

For example:

```text
UPI QR
   ↓
User scans
   ↓
GPay / PhonePe / Paytm / BHIM
   ↓
Amount
   ↓
Payment
```

The QR should preferably include the expected payment amount when the UPI format supports it.

However, the backend must still verify the amount manually before confirmation.

---

# 7. Payment Amount

The frontend must NOT be the source of truth for payment amounts.

Correct:

```text
User selects:
PRO
     ↓
Backend
     ↓
PostgreSQL plans table
     ↓
₹249
     ↓
Payment record
```

Incorrect:

```text
Frontend
     ↓
₹249
     ↓
Payment
```

The payment record must snapshot:

```text
amount
currency
purpose
reference_id
```

so historical payment records remain accurate even if pricing changes later.

---

# 8. Payment Table

Create:

## `payments`

Suggested fields:

```text
id
user_id
purpose
reference_id
amount
currency
status
upi_id
utr
user_note
admin_note
submitted_at
verified_at
verified_by
rejected_at
rejected_by
created_at
updated_at
```

---

# 9. Payment Purpose

Allowed values:

```text
SUBSCRIPTION
CREDIT_TOPUP
```

---

# 10. Payment Status

Allowed values:

```text
PENDING
ADMIN_REVIEW
CONFIRMED
REJECTED
REFUNDED
```

### Meaning

### PENDING

Payment record exists but user has not submitted payment proof/reference.

### ADMIN_REVIEW

User claims payment was completed and submitted the UTR/reference.

### CONFIRMED

Admin verified the payment.

Only this status can activate business benefits.

### REJECTED

Admin rejected the payment submission.

### REFUNDED

Payment was refunded manually.

---

# 11. Credit Top-Up Flow

Example:

```text
₹49 → 5 Credits
```

Flow:

```text
User
 ↓
Select ₹49 Credit Pack
 ↓
POST /api/credits/purchases
 ↓
Purchase created
 ↓
Payment created
 ↓
Display UPI ID + QR
 ↓
User pays using GPay/PhonePe/Paytm/etc.
 ↓
User submits UTR
 ↓
Payment = ADMIN_REVIEW
 ↓
Admin verifies
 ↓
Payment = CONFIRMED
 ↓
Purchase = CONFIRMED
 ↓
creditService.grantCredits()
 ↓
PURCHASE ledger transaction
 ↓
Wallet +5
```

---

# 12. Subscription Payment Flow

Example:

```text
PRO
₹249/month
60 credits
```

Flow:

```text
User
 ↓
Select PRO
 ↓
Create subscription payment request
 ↓
Display ₹249 UPI payment
 ↓
User pays
 ↓
User submits UTR
 ↓
Payment = ADMIN_REVIEW
 ↓
Admin verifies
 ↓
Payment = CONFIRMED
 ↓
Subscription = ACTIVE
 ↓
Subscription credit grant
 ↓
Wallet +60
```

---

# 13. Payment Creation API

```http
POST /api/payments
```

Request:

```json
{
  "purpose": "CREDIT_TOPUP",
  "referenceId": "purchase-id"
}
```

Backend must:

1. Authenticate the user.
2. Validate the referenced purchase/subscription.
3. Verify ownership.
4. Read the actual price from PostgreSQL.
5. Create the payment record.
6. Snapshot the amount.
7. Return payment instructions.

The user must not submit an arbitrary amount.

---

# 14. Payment Configuration API

```http
GET /api/payments/config
```

Returns:

```json
{
  "upiId": "example@upi",
  "accountName": "Quick AI",
  "currency": "INR"
}
```

Do not expose sensitive backend configuration.

---

# 15. Submit Payment API

```http
POST /api/payments/:paymentId/submit
```

Request:

```json
{
  "utr": "123456789012",
  "userNote": "Paid using PhonePe"
}
```

Backend must:

1. Authenticate user.
2. Verify payment ownership.
3. Verify payment is still payable.
4. Validate UTR format.
5. Store UTR.
6. Set status to `ADMIN_REVIEW`.
7. Store submission timestamp.

---

# 16. UTR Validation

The backend should validate basic UTR requirements.

Examples:

* Required
* Reasonable length
* Allowed characters
* No obvious malicious input
* Cannot be changed after confirmation

Do not attempt to determine payment success from the UTR alone.

A valid-looking UTR is still only a **payment claim** until manually verified.

---

# 17. Duplicate UTR Protection

The system should prevent accidental reuse of the same UTR.

Recommended constraint:

```text
UNIQUE(utr)
```

However, this must be applied carefully if the payment provider/bank can produce unusual duplicate references.

If duplicate UTR is detected:

```text
DUPLICATE_UTR
```

and the payment should require admin investigation.

---

# 18. Admin Payment Verification

Admin endpoint:

```http
POST /api/admin/payments/:paymentId/confirm
```

Admin must verify:

```text
User
Amount
UPI transaction
UTR
Payment date/time
Recipient account
```

After verification:

```text
Payment
  ↓
CONFIRMED
```

Then the backend performs the associated business operation.

---

# 19. Admin Payment Rejection

Endpoint:

```http
POST /api/admin/payments/:paymentId/reject
```

Request:

```json
{
  "reason": "Payment amount does not match the requested purchase."
}
```

Result:

```text
Payment = REJECTED
```

The user should see the rejection reason.

---

# 20. Confirmation Must Be Atomic

Payment confirmation and business benefit must happen inside a database transaction.

For credit purchase:

```text
BEGIN TRANSACTION

Payment → CONFIRMED

Purchase → CONFIRMED

creditService.grantCredits()

Credit ledger → PURCHASE

COMMIT
```

If any step fails:

```text
ROLLBACK
```

This prevents:

```text
Payment confirmed
but credits not granted
```

or:

```text
Credits granted
but payment remains pending
```

---

# 21. Credit Grant Idempotency

Credit confirmation must use:

```text
PURCHASE:{purchase_id}
```

as the ledger reference.

If an admin accidentally attempts to confirm the same payment twice:

```text
First confirmation
→ +12 credits

Second confirmation
→ duplicate reference
→ +0 credits
```

Never grant credits twice.

---

# 22. Subscription Grant Idempotency

Use:

```text
SUBSCRIPTION_GRANT:{subscription_id}:{period_start}
```

as the ledger reference.

This prevents duplicate monthly credit grants.

---

# 23. Admin Payment Dashboard

Admin should have:

```text
Payments
```

with:

```text
Pending Review
Confirmed
Rejected
Refunded
```

Filters:

```text
User
Purpose
Status
Amount
Date
UTR
```

Each payment should show:

```text
Payment ID
User
Purpose
Amount
UTR
Submitted At
Status
```

---

# 24. Admin Verification Screen

Example:

```text
Payment Verification

User:
Mohammad

Purpose:
Credit Top-up

Pack:
12 Credits

Amount:
₹99

UPI Reference:
123456789012

Submitted:
01 Oct 2026, 08:31 PM

User Note:
Paid using PhonePe

--------------------------------

[ Confirm Payment ]

[ Reject Payment ]
```

Admin must explicitly confirm the payment.

---

# 25. Audit Logging

Every administrative payment action must create an audit log.

Examples:

```text
PAYMENT_CONFIRMED
PAYMENT_REJECTED
PAYMENT_REFUNDED
```

Audit record:

```text
admin_id
action
payment_id
reason
metadata
created_at
```

This makes payment operations traceable.

---

# 26. User Payment History

Endpoint:

```http
GET /api/payments
```

User should see:

```text
Date
Purpose
Amount
Status
UTR
```

Example:

```text
01 Oct 2026
Credit Top-up
₹99
12 Credits
Confirmed
```

---

# 27. Payment UI

## Credit Purchase

```text
12 Credits
₹99

Pay using UPI

[ QR CODE ]

UPI ID:
example@upi

[ Copy UPI ID ]

After completing payment:

UTR / Transaction ID
[________________]

[ I Have Paid ]
```

After submission:

```text
Payment submitted.

Your payment is being verified.
Credits will be added after confirmation.
```

---

# 28. Subscription UI

```text
PRO

₹249/month
60 AI credits

Pay using UPI

[ QR CODE ]

UPI ID:
example@upi

[ Copy UPI ID ]

UTR / Transaction ID
[________________]

[ I Have Paid ]
```

After submission:

```text
Payment submitted for verification.
```

The plan must NOT become active immediately.

---

# 29. No Automatic Payment Claims

The system must never display:

```text
Payment successful
```

before admin confirmation.

Before confirmation:

```text
Payment submitted
Awaiting verification
```

After confirmation:

```text
Payment confirmed
Credits added
```

---

# 30. Refund Foundation

Phase 7 does not implement automated refunds.

However, the system should support:

```text
CONFIRMED
   ↓
REFUNDED
```

Refunds must create a separate ledger transaction where applicable.

Never delete or modify the original payment/ledger history.

---

# 31. Security Requirements

* Authentication required for payment creation.
* Users can access only their own payments.
* Users cannot confirm their own payments.
* Only authorized admins can confirm payments.
* Payment amount comes from the backend.
* UPI ID comes from server configuration.
* UTR cannot be edited after confirmation.
* Admin actions require audit logging.
* No client-side credit granting.
* No client-side subscription activation.
* No negative wallet balance.
* All payment-to-credit operations are transactional.
* All credit grants are idempotent.

---

# 32. Error Codes

Add:

```text
PAYMENT_NOT_FOUND
PAYMENT_ACCESS_DENIED
INVALID_PAYMENT_PURPOSE
INVALID_PAYMENT_REFERENCE
PAYMENT_ALREADY_SUBMITTED
PAYMENT_ALREADY_CONFIRMED
INVALID_UTR
DUPLICATE_UTR
PAYMENT_CONFIRMATION_FAILED
PAYMENT_REJECTION_FAILED
PAYMENT_ALREADY_REJECTED
UNAUTHORIZED_PAYMENT_ACTION
```

Existing credit and subscription errors remain unchanged.

---

# 33. Phase 7 APIs

## User

```http
GET    /api/payments/config
POST   /api/payments
POST   /api/payments/:paymentId/submit
GET    /api/payments
GET    /api/payments/:paymentId
```

## Admin

```http
GET    /api/admin/payments
GET    /api/admin/payments/:paymentId
POST   /api/admin/payments/:paymentId/confirm
POST   /api/admin/payments/:paymentId/reject
POST   /api/admin/payments/:paymentId/refund
```

---

# 34. Phase 7 Database Relationships

```text
users
  │
  ├── payments
  │      │
  │      ├── credit_purchases
  │      │
  │      └── subscriptions
  │
  └── credit_wallets
          │
          └── credit_transactions
```

Payment should reference the relevant business object.

```text
payments.reference_id
```

must point logically to:

```text
credit_purchases.id
```

or:

```text
subscriptions.id
```

depending on the payment purpose.

---

# 35. Phase 7 Definition of Done

* [ ] UPI ID configured
* [ ] UPI QR generated
* [ ] GPay payment tested
* [ ] PhonePe payment tested
* [ ] Paytm payment tested
* [ ] Credit top-up payment flow implemented
* [ ] Subscription payment flow implemented
* [ ] Payment table created
* [ ] Payment creation API implemented
* [ ] Payment submission API implemented
* [ ] UTR validation implemented
* [ ] Duplicate UTR protection implemented
* [ ] Admin payment dashboard implemented
* [ ] Admin confirmation implemented
* [ ] Admin rejection implemented
* [ ] Payment confirmation is transactional
* [ ] Credit grant is idempotent
* [ ] Subscription grant is idempotent
* [ ] Payment history implemented
* [ ] Audit logging implemented
* [ ] Refund state supported
* [ ] No automatic payment success claims
* [ ] No client-side credit/subscription authority
* [ ] Complete end-to-end UPI test completed

---

# 36. Future Migration to Payment Gateway

Phase 7 intentionally uses:

```text
Manual UPI
```

Later, when Quick AI needs automated payment verification:

```text
Phase 7
Manual UPI
      ↓
Future Payment Gateway
      ↓
Automatic Verification
      ↓
Webhook
      ↓
Existing Payment Service
      ↓
Existing Credit / Subscription Services
```

The payment service should therefore be designed so that the rest of Quick AI does not depend directly on manual UPI verification.

The future gateway should replace the **payment confirmation mechanism**, not the wallet, ledger, subscription, or entitlement architecture.

---

# 37. Core Principle

```text
UPI Payment
      ≠
Payment Confirmation
      ≠
Credit Grant
      ≠
Subscription Activation
```

Each step must be explicit.

For Phase 7:

```text
User pays
    ↓
User submits UTR
    ↓
Admin verifies
    ↓
Payment confirmed
    ↓
Business transaction executes
    ↓
Ledger records the change
```

This provides a simple payment system for the early Quick AI MVP while keeping the architecture ready for automated payment processing later.
