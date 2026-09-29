-- Local mirror of Clerk users. Clerk remains the source of truth for identity;
-- this table exists so admin analytics can paginate/sort/filter/join users by
-- usage and cost server-side (which the Clerk API can't do efficiently).
-- Kept in sync by a lazy upsert in the auth middleware + a one-time backfill.
CREATE TABLE IF NOT EXISTS users (
  id               TEXT        PRIMARY KEY,          -- Clerk user id
  email            TEXT,
  first_name       TEXT,
  last_name        TEXT,
  image_url        TEXT,
  plan             TEXT        NOT NULL DEFAULT 'free',
  status           TEXT        NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active','suspended')),
  admin_role       TEXT,                             -- mirror of Clerk publicMetadata.role
  clerk_created_at TIMESTAMPTZ,
  last_active_at   TIMESTAMPTZ,
  synced_at        TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS users_email_idx       ON users (email);
CREATE INDEX IF NOT EXISTS users_plan_idx        ON users (plan);
CREATE INDEX IF NOT EXISTS users_status_idx      ON users (status);
CREATE INDEX IF NOT EXISTS users_last_active_idx ON users (last_active_at DESC);
CREATE INDEX IF NOT EXISTS users_admin_role_idx  ON users (admin_role);
