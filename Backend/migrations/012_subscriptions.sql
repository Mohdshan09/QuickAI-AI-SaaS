-- Phase 5 (payment-model): the subscription domain. Decides WHICH plan a user is
-- on, independent of any payment provider (Razorpay is Phase 7). Plans gain pricing
-- + monthly credit config; subscriptions hold the lifecycle + history; an audit
-- table records manual/admin subscription changes. user_id is the internal users.id
-- (= Clerk id). UUID PKs are generated in JS. Kept as separate domains (spec §48).

-- Pricing + recurring-credit config on the Phase 4 plans table (spec §6). price is
-- whole currency units (INR); monthly_credits is granted on activation/renewal.
ALTER TABLE plans ADD COLUMN IF NOT EXISTS price            INTEGER NOT NULL DEFAULT 0;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS currency         TEXT    NOT NULL DEFAULT 'INR';
ALTER TABLE plans ADD COLUMN IF NOT EXISTS billing_interval TEXT    NOT NULL DEFAULT 'MONTHLY';
ALTER TABLE plans ADD COLUMN IF NOT EXISTS monthly_credits  INTEGER NOT NULL DEFAULT 0;

-- One row per subscription attempt/period cycle (spec §8). A user may have many
-- historical rows (spec §9, §29) but only one ACTIVE at a time (partial unique
-- below). The current plan is resolved from the active subscription (spec §11).
CREATE TABLE IF NOT EXISTS subscriptions (
  id                   UUID        PRIMARY KEY,
  user_id              TEXT        NOT NULL REFERENCES users(id),
  plan_id              UUID        NOT NULL REFERENCES plans(id),
  pending_plan_id      UUID        REFERENCES plans(id),   -- plan change applied at next renewal (spec §27-28)
  status               TEXT        NOT NULL DEFAULT 'ACTIVE'
                       CHECK (status IN ('ACTIVE','CANCELLED','EXPIRED','PAST_DUE','PAUSED')),
  billing_interval     TEXT        NOT NULL DEFAULT 'MONTHLY',
  started_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_period_end   TIMESTAMPTZ NOT NULL,
  cancel_at_period_end BOOLEAN     NOT NULL DEFAULT false,  -- renewal cancelled, access kept until period end (spec §15)
  cancelled_at         TIMESTAMPTZ,
  ended_at             TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- At most one ACTIVE subscription per user (spec §9). Partial so historical
-- CANCELLED/EXPIRED rows are never blocked.
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_one_active_idx
  ON subscriptions (user_id)
  WHERE status = 'ACTIVE';

-- History queries, newest first per user (spec §32).
CREATE INDEX IF NOT EXISTS subscriptions_user_created_idx
  ON subscriptions (user_id, created_at DESC);

-- Audit trail for subscription lifecycle changes (spec §39-40). Append-only.
CREATE TABLE IF NOT EXISTS subscription_audit (
  id              UUID        PRIMARY KEY,
  admin_user_id   TEXT,                                   -- null for system/automatic changes
  target_user_id  TEXT        NOT NULL,
  subscription_id UUID,
  action          TEXT        NOT NULL,                   -- SUBSCRIPTION_ACTIVATED / _CANCELLED / ...
  old_status      TEXT,
  new_status      TEXT,
  old_plan        TEXT,
  new_plan        TEXT,
  reason          TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS subscription_audit_target_idx
  ON subscription_audit (target_user_id, created_at DESC);
