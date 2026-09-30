-- Phase 2 (payment-model): internal credit accounting foundation.
-- Two tables: credit_wallets (current state, one per user) and credit_transactions
-- (append-only ledger, the history). Only the credit service mutates these.
-- Credits are whole numbers (INTEGER). user_id is the internal users.id (= Clerk id).

CREATE TABLE IF NOT EXISTS credit_wallets (
  id                 UUID        PRIMARY KEY,
  user_id            TEXT        NOT NULL UNIQUE REFERENCES users(id),  -- one wallet per user
  balance            INTEGER     NOT NULL DEFAULT 0 CHECK (balance >= 0),
  lifetime_granted   INTEGER     NOT NULL DEFAULT 0,   -- INITIAL_GRANT + BONUS + SUBSCRIPTION_GRANT
  lifetime_purchased INTEGER     NOT NULL DEFAULT 0,   -- PURCHASE (future)
  lifetime_used      INTEGER     NOT NULL DEFAULT 0,   -- AI_USAGE (future)
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Append-only ledger. Every balance change is one immutable row; corrections are
-- made by adding a compensating row (e.g. REFUND), never by editing history.
CREATE TABLE IF NOT EXISTS credit_transactions (
  id            UUID        PRIMARY KEY,
  user_id       TEXT        NOT NULL REFERENCES users(id),
  type          TEXT        NOT NULL
                CHECK (type IN (
                  'INITIAL_GRANT','BONUS','PURCHASE','SUBSCRIPTION_GRANT',
                  'AI_USAGE','REFUND','ADMIN_ADJUSTMENT'
                )),
  amount        INTEGER     NOT NULL,                        -- signed: +grant / -consume
  balance_after INTEGER     NOT NULL CHECK (balance_after >= 0),
  reference_id  TEXT,                                        -- idempotency / correlation key
  metadata      JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- History queries: newest-first per user.
CREATE INDEX IF NOT EXISTS credit_transactions_user_created_idx
  ON credit_transactions (user_id, created_at DESC);

-- Idempotency (spec §18): a given (user, type, reference_id) may exist at most once.
-- Partial so rows without a reference_id (ad-hoc grants) are never blocked.
CREATE UNIQUE INDEX IF NOT EXISTS credit_transactions_idem_key
  ON credit_transactions (user_id, type, reference_id)
  WHERE reference_id IS NOT NULL;
