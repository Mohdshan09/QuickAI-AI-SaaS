-- Centralized AI model pricing (spec: pricing must never be hardcoded in code).
-- Prices are USD per 1,000,000 tokens. Rows are effective-dated so historical
-- costs stay stable: a request snapshots the price that was in effect at its
-- time onto ai_requests, and new pricing is a new row, never an update.
CREATE TABLE IF NOT EXISTS ai_model_pricing (
  id             SERIAL      PRIMARY KEY,
  provider       TEXT        NOT NULL,
  model          TEXT        NOT NULL,
  input_price    NUMERIC     NOT NULL,   -- USD per 1M input tokens
  output_price   NUMERIC     NOT NULL,   -- USD per 1M output tokens
  effective_from DATE        NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, model, effective_from)
);
CREATE INDEX IF NOT EXISTS ai_model_pricing_lookup_idx
  ON ai_model_pricing (provider, model, effective_from DESC);

-- Seed: current published Gemini 2.5 Flash rates (USD / 1M tokens).
-- Verify against Google's pricing page and add a new effective-dated row if it
-- changes — do NOT edit this row (historical requests reference the snapshot).
INSERT INTO ai_model_pricing (provider, model, input_price, output_price, effective_from)
VALUES ('gemini', 'gemini-2.5-flash', 0.30, 2.50, '2026-01-01')
ON CONFLICT (provider, model, effective_from) DO NOTHING;
