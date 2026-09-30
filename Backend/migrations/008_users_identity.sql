-- Phase 1 (payment-model) auth foundation: formalize the Clerk <-> app identity
-- contract on the existing `users` mirror WITHOUT a destructive re-key.
--
-- Decision: the Clerk id stays the internal user id (users.id, and the value in
-- every user_id column across creations/resumes/jobs/job_outputs/ai_requests).
-- We add clerk_user_id as an explicit, UNIQUE mapping column (so identity is
-- enforced at the DB and future code has a single place the two ids meet),
-- plus updated_at (sync timestamp) and deleted_at (soft delete via Clerk
-- user.deleted webhook). Non-destructive and safe to re-run.

ALTER TABLE users ADD COLUMN IF NOT EXISTS clerk_user_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at    TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at    TIMESTAMPTZ;

-- Backfill the new columns from existing data (id already IS the Clerk id).
UPDATE users SET clerk_user_id = id                          WHERE clerk_user_id IS NULL;
UPDATE users SET updated_at    = COALESCE(synced_at, created_at) WHERE updated_at    IS NULL;

-- clerk_user_id is now the required, unique mapping key (spec section 6):
-- no two application users may share one Clerk id.
ALTER TABLE users ALTER COLUMN clerk_user_id SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS users_clerk_user_id_key ON users (clerk_user_id);

-- Soft delete lives on deleted_at; the status CHECK (active|suspended) is left
-- untouched so admin suspend/reactivate and deletion stay independent concerns.
CREATE INDEX IF NOT EXISTS users_deleted_at_idx ON users (deleted_at);
