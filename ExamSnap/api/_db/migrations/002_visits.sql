CREATE TABLE IF NOT EXISTS visits (
  id          BIGSERIAL PRIMARY KEY,
  anon_id     TEXT NOT NULL,
  is_admin    BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS visits_anon ON visits (anon_id);
