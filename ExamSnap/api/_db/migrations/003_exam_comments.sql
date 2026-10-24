-- Public, anonymous exam discussions. Aliases are display names only; anon_id is never returned.
CREATE TABLE IF NOT EXISTS exam_comments (
  id         BIGSERIAL PRIMARY KEY,
  exam_ref   TEXT NOT NULL CHECK (length(exam_ref) <= 120),
  alias      TEXT NOT NULL CHECK (length(alias) BETWEEN 1 AND 32),
  body       TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 1000),
  parent_id  BIGINT REFERENCES exam_comments(id) ON DELETE CASCADE,
  anon_id    TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'hidden')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS exam_comments_visible_by_exam
  ON exam_comments (exam_ref, created_at DESC) WHERE status = 'published';
