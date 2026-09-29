-- The AI request log: one immutable row per AI operation (spec section 9).
-- Insert-only by convention — usage history is never overwritten. This is the
-- source of truth for usage, token, cost, latency, error and billing analytics.
CREATE TABLE IF NOT EXISTS ai_requests (
  id              UUID        PRIMARY KEY,
  user_id         TEXT        NOT NULL,   -- Clerk id; matches users.id (not a hard FK,
                                          -- so tracking never fails if the mirror lags)
  service         TEXT        NOT NULL,
  provider        TEXT        NOT NULL,
  model           TEXT,
  status          TEXT        NOT NULL
                  CHECK (status IN ('success','error')),

  started_at      TIMESTAMPTZ NOT NULL,
  completed_at    TIMESTAMPTZ,
  duration_ms     INTEGER,

  input_tokens    INTEGER     NOT NULL DEFAULT 0,
  output_tokens   INTEGER     NOT NULL DEFAULT 0,
  total_tokens    INTEGER     NOT NULL DEFAULT 0,

  input_cost      NUMERIC     NOT NULL DEFAULT 0,
  output_cost     NUMERIC     NOT NULL DEFAULT 0,
  total_cost      NUMERIC     NOT NULL DEFAULT 0,

  -- Pricing snapshot used for this request (USD / 1M tokens) so recalculating
  -- historical cost is stable even after ai_model_pricing changes.
  input_price     NUMERIC,
  output_price    NUMERIC,

  prompt_version  TEXT,
  analysis_version TEXT,
  schema_version  TEXT,

  error_code      TEXT,       -- sanitized category (RATE_LIMIT, TIMEOUT, ...)
  error_message   TEXT,       -- sanitized; never contains keys/secrets/prompts

  -- Correlation to the feature that generated it (spec section 27).
  resume_id       INTEGER,
  job_id          INTEGER,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ai_requests_user_idx    ON ai_requests (user_id);
CREATE INDEX IF NOT EXISTS ai_requests_service_idx ON ai_requests (service);
CREATE INDEX IF NOT EXISTS ai_requests_model_idx   ON ai_requests (provider, model);
CREATE INDEX IF NOT EXISTS ai_requests_status_idx  ON ai_requests (status);
CREATE INDEX IF NOT EXISTS ai_requests_created_idx ON ai_requests (created_at DESC);
CREATE INDEX IF NOT EXISTS ai_requests_created_service_idx ON ai_requests (created_at, service);
