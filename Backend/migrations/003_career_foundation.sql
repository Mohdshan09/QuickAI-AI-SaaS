CREATE TABLE IF NOT EXISTS resumes (
  id          SERIAL PRIMARY KEY,
  user_id     TEXT        NOT NULL,
  title       TEXT        NOT NULL,
  text        TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS resumes_user_idx ON resumes (user_id);

CREATE TABLE IF NOT EXISTS jobs (
  id           SERIAL PRIMARY KEY,
  user_id      TEXT        NOT NULL,
  resume_id    INTEGER     REFERENCES resumes(id) ON DELETE SET NULL,
  company      TEXT        NOT NULL,
  role         TEXT        NOT NULL,
  description  TEXT        NOT NULL,
  url          TEXT,
  status       TEXT        NOT NULL DEFAULT 'saved'
               CHECK (status IN ('saved','applied','interviewing','offer','rejected')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS jobs_user_idx ON jobs (user_id);

CREATE TABLE IF NOT EXISTS job_outputs (
  id          SERIAL PRIMARY KEY,
  job_id      INTEGER     NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  resume_id   INTEGER     REFERENCES resumes(id) ON DELETE SET NULL,
  user_id     TEXT        NOT NULL,
  kind        TEXT        NOT NULL
              CHECK (kind IN ('match','tailored','cover_letter','interview')),
  data        JSONB       NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS job_outputs_job_idx ON job_outputs (job_id, kind, created_at DESC);
CREATE INDEX IF NOT EXISTS job_outputs_user_kind_idx ON job_outputs (user_id, kind);
