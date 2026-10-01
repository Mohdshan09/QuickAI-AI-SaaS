-- Phase 7 (payment-model): manual UPI payment foundation. A `payments` record is the
-- manual-verification gate IN FRONT OF the existing Phase 5/6 confirm/activate ops — it does
-- NOT touch the wallet/ledger/subscription domains (spec §36-37). Only an admin-CONFIRMED
-- payment triggers a benefit (confirmPurchase for CREDIT_TOPUP, activateSubscription for
-- SUBSCRIPTION). No payment gateway. UUID PKs in JS; user_id is the internal users.id.

CREATE TABLE IF NOT EXISTS payments (
  id            UUID        PRIMARY KEY,
  user_id       TEXT        NOT NULL REFERENCES users(id),
  purpose       TEXT        NOT NULL CHECK (purpose IN ('SUBSCRIPTION','CREDIT_TOPUP')),
  reference_id  TEXT        NOT NULL,                 -- credit_purchases.id (topup) or plan key (subscription) — spec §34
  amount        INTEGER     NOT NULL,                 -- snapshot from DB, never the client (spec §7)
  currency      TEXT        NOT NULL DEFAULT 'INR',
  status        TEXT        NOT NULL DEFAULT 'PENDING'
                CHECK (status IN ('PENDING','ADMIN_REVIEW','CONFIRMED','REJECTED','REFUNDED')),
  upi_id        TEXT,                                 -- the business UPI id shown to the user
  utr           TEXT,                                 -- the bank/UPI reference the user submits (spec §16)
  user_note     TEXT,
  admin_note    TEXT,                                 -- rejection reason / admin remarks
  submitted_at  TIMESTAMPTZ,
  verified_at   TIMESTAMPTZ,
  verified_by   TEXT,
  rejected_at   TIMESTAMPTZ,
  rejected_by   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- History queries, newest first per user (spec §26).
CREATE INDEX IF NOT EXISTS payments_user_created_idx
  ON payments (user_id, created_at DESC);

-- Prevent accidental reuse of the same UTR (spec §17). Partial so many un-submitted
-- (NULL utr) payments never collide; a duplicate submission raises 23505 -> DUPLICATE_UTR.
CREATE UNIQUE INDEX IF NOT EXISTS payments_utr_idx
  ON payments (utr)
  WHERE utr IS NOT NULL;

-- Audit trail for every admin payment action (spec §25). Append-only.
CREATE TABLE IF NOT EXISTS payment_audit (
  id             UUID        PRIMARY KEY,
  admin_user_id  TEXT,
  target_user_id TEXT,
  payment_id     UUID,
  action         TEXT        NOT NULL,                -- PAYMENT_CONFIRMED / PAYMENT_REJECTED / PAYMENT_REFUNDED
  old_state      TEXT,
  new_state      TEXT,
  reason         TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS payment_audit_target_idx
  ON payment_audit (target_user_id, created_at DESC);
