CREATE TABLE IF NOT EXISTS creations (
  id           SERIAL PRIMARY KEY,
  user_id      TEXT        NOT NULL,
  prompt       TEXT        NOT NULL,
  content      TEXT        NOT NULL,
  content_type TEXT        NOT NULL,
  publish      BOOLEAN     NOT NULL DEFAULT FALSE,
  likes        TEXT[]      NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
