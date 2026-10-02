CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS exams (
  id            SERIAL PRIMARY KEY,
  slug          TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL,
  normalized    TEXT UNIQUE NOT NULL,
  status        TEXT NOT NULL CHECK (status IN ('requested','community','verified','flagged')),
  spec          JSONB,
  spec_hash     TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS exams_normalized_trgm ON exams USING gin (normalized gin_trgm_ops);

CREATE TABLE IF NOT EXISTS exam_aliases (
  alias_normalized TEXT PRIMARY KEY,
  exam_id          INT REFERENCES exams(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS exam_requests (
  id            BIGSERIAL PRIMARY KEY,
  raw_name      TEXT NOT NULL CHECK (length(raw_name) <= 120),
  normalized    TEXT NOT NULL,
  exam_id       INT REFERENCES exams(id),
  anon_id       TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS exam_requests_normalized ON exam_requests (normalized);

CREATE TABLE IF NOT EXISTS spec_submissions (
  id               BIGSERIAL PRIMARY KEY,
  normalized       TEXT NOT NULL,
  exam_id          INT REFERENCES exams(id),
  documents        JSONB NOT NULL,
  spec_hash        TEXT NOT NULL,
  notification_url TEXT CHECK (length(notification_url) <= 500),
  anon_id          TEXT NOT NULL,
  created_at       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS spec_submissions_hash ON spec_submissions (normalized, spec_hash);

CREATE TABLE IF NOT EXISTS outcomes (
  id             BIGSERIAL PRIMARY KEY,
  normalized     TEXT NOT NULL,
  exam_id        INT REFERENCES exams(id),
  spec_hash      TEXT NOT NULL,
  result         TEXT NOT NULL CHECK (result IN ('accepted','rejected')),
  document_type  TEXT,
  portal_error   TEXT CHECK (length(portal_error) <= 300),
  anon_id        TEXT NOT NULL,
  created_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS outcomes_hash ON outcomes (normalized, spec_hash, result);

CREATE TABLE IF NOT EXISTS quality_feedback (
  id             BIGSERIAL PRIMARY KEY,
  exam_ref       TEXT NOT NULL,
  document_type  TEXT NOT NULL,
  rating         SMALLINT NOT NULL CHECK (rating IN (-1, 1)),
  reason         TEXT CHECK (length(reason) <= 40),
  anon_id        TEXT NOT NULL,
  created_at     TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rate_limits (
  key          TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  count        INT NOT NULL DEFAULT 1,
  PRIMARY KEY (key, window_start)
);
