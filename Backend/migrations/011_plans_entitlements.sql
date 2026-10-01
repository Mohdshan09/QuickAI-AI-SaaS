-- Phase 4 (payment-model): plan + entitlement layer.
-- Sits between authentication and credits: the application database (not Clerk)
-- is authoritative for a user's plan and feature access. Five tables, kept as
-- separate domains (spec §36): plans + plan_entitlements define access rules,
-- user_plans assigns one active plan per user, feature_usage tracks per-feature
-- monthly usage, plan_change_audit records manual admin plan changes.
-- user_id is the internal users.id (= Clerk id). UUID PKs are generated in JS.
-- Tables only — initial data is seeded idempotently by scripts/seedPlans.js.

-- Available application plans (spec §10). Only FREE is active in Phase 4;
-- STARTER/PRO/POWER can be added later without schema changes.
CREATE TABLE IF NOT EXISTS plans (
  id          UUID        PRIMARY KEY,
  key         TEXT        NOT NULL UNIQUE,              -- 'FREE', ...
  name        TEXT        NOT NULL,
  description TEXT,
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Per-plan feature access rules (spec §11). monthly_limit NULL = unlimited OR
-- credit-metered (career ops track usage via the credit ledger, not here).
CREATE TABLE IF NOT EXISTS plan_entitlements (
  id            UUID        PRIMARY KEY,
  plan_id       UUID        NOT NULL REFERENCES plans(id),
  feature_key   TEXT        NOT NULL,                   -- e.g. 'resume_review'
  enabled       BOOLEAN     NOT NULL DEFAULT true,
  monthly_limit INTEGER,                                -- NULL = unlimited / credit-metered
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (plan_id, feature_key)                         -- spec §34
);

-- One active application plan per user (spec §12). user_id UNIQUE enforces this
-- at the database level; ensureUserPlan() relies on it for idempotency.
CREATE TABLE IF NOT EXISTS user_plans (
  id         UUID        PRIMARY KEY,
  user_id    TEXT        NOT NULL UNIQUE REFERENCES users(id),
  plan_id    UUID        NOT NULL REFERENCES plans(id),
  status     TEXT        NOT NULL DEFAULT 'ACTIVE'
             CHECK (status IN ('ACTIVE','CANCELED','EXPIRED')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,                               -- NULL for FREE (never expires)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Monthly per-feature usage (spec §13). A new month is a NEW row, never a reset
-- of usage_count (spec §29), so history is preserved. The unique key makes the
-- atomic conditional increment in consumeFeatureUsage concurrency-safe (spec §30).
CREATE TABLE IF NOT EXISTS feature_usage (
  id           UUID        PRIMARY KEY,
  user_id      TEXT        NOT NULL REFERENCES users(id),
  feature_key  TEXT        NOT NULL,
  period_start DATE        NOT NULL,                    -- first day of the month
  period_end   DATE        NOT NULL,                    -- last day of the month
  usage_count  INTEGER     NOT NULL DEFAULT 0 CHECK (usage_count >= 0),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, feature_key, period_start)          -- spec §13, §34
);

-- Audit trail for manual/admin plan changes (spec §33). Append-only.
CREATE TABLE IF NOT EXISTS plan_change_audit (
  id             UUID        PRIMARY KEY,
  admin_user_id  TEXT,                                  -- null for system changes
  target_user_id TEXT        NOT NULL,
  old_plan       TEXT,
  new_plan       TEXT        NOT NULL,
  reason         TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS plan_change_audit_target_idx
  ON plan_change_audit (target_user_id, created_at DESC);
