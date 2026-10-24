CREATE TABLE IF NOT EXISTS comment_reports (
  id               BIGSERIAL PRIMARY KEY,
  comment_id       BIGINT NOT NULL REFERENCES exam_comments(id) ON DELETE CASCADE,
  reporter_anon_id TEXT NOT NULL,
  reason           TEXT NOT NULL CHECK (reason IN ('spam', 'harmful', 'misleading', 'other')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (comment_id, reporter_anon_id)
);

CREATE INDEX IF NOT EXISTS comment_reports_by_comment ON comment_reports (comment_id);
