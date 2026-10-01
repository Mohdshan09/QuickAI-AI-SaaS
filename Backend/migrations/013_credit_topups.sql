-- Phase 6 (payment-model): one-time credit top-ups. A top-up is NOT a subscription
-- (spec §4, §51) — it buys one-time credits that land in the existing Phase 2 wallet
-- via the existing immutable ledger (type PURCHASE, already allowed by migration 009).
-- Payment-provider independent (Razorpay is Phase 7): a purchase is confirmed by a
-- controlled server-side/admin op, and only a CONFIRMED purchase grants credits.
-- UUID PKs are generated in JS; user_id is the internal users.id (= Clerk id).

-- Configurable credit-pack catalog (spec §5-6). price is whole currency units (INR);
-- credits is granted once when a purchase of this pack is confirmed. Admin-editable.
CREATE TABLE IF NOT EXISTS credit_packs (
  id          UUID        PRIMARY KEY,
  key         TEXT        NOT NULL UNIQUE,
  name        TEXT        NOT NULL,
  description TEXT,
  credits     INTEGER     NOT NULL,
  price       INTEGER     NOT NULL,
  currency    TEXT        NOT NULL DEFAULT 'INR',
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One row per top-up purchase (spec §8). credits/amount/currency are SNAPSHOTTED from
-- the pack at creation (spec §9) so historical purchases keep their original values even
-- if the pack's pricing later changes. A purchase grants credits only once CONFIRMED.
CREATE TABLE IF NOT EXISTS credit_purchases (
  id              UUID        PRIMARY KEY,
  user_id         TEXT        NOT NULL REFERENCES users(id),
  credit_pack_id  UUID        NOT NULL REFERENCES credit_packs(id),
  status          TEXT        NOT NULL DEFAULT 'PENDING'
                  CHECK (status IN ('PENDING','CONFIRMED','CANCELLED','FAILED','REFUNDED')),
  credits         INTEGER     NOT NULL,   -- snapshot (spec §9)
  amount          INTEGER     NOT NULL,   -- snapshot: price paid, whole currency units
  currency        TEXT        NOT NULL,   -- snapshot
  idempotency_key TEXT,                   -- optional client key to dedupe creation (spec §41)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at    TIMESTAMPTZ,
  cancelled_at    TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- History queries, newest first per user (spec §28).
CREATE INDEX IF NOT EXISTS credit_purchases_user_created_idx
  ON credit_purchases (user_id, created_at DESC);

-- Idempotent creation (spec §41, §44): a client-supplied key dedupes per user. Partial
-- so purchases created without a key are never blocked.
CREATE UNIQUE INDEX IF NOT EXISTS credit_purchases_idempotency_idx
  ON credit_purchases (user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Audit trail for admin pack + purchase actions (spec §36). Append-only.
CREATE TABLE IF NOT EXISTS credit_purchase_audit (
  id             UUID        PRIMARY KEY,
  admin_user_id  TEXT,                                 -- null for system/automatic changes
  target_user_id TEXT,                                 -- the purchase owner (null for pack-only actions)
  purchase_id    UUID,
  credit_pack_id UUID,
  action         TEXT        NOT NULL,                 -- PURCHASE_CONFIRMED / CREDIT_PACK_CREATED / ...
  old_state      TEXT,
  new_state      TEXT,
  reason         TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS credit_purchase_audit_target_idx
  ON credit_purchase_audit (target_user_id, created_at DESC);
