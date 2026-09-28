-- Cache a structured (parsed) form of each resume so we can render it with a
-- deterministic template and target edits by id. Parsed once, reused per job.
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS structured JSONB;
