-- Phase 3 (payment-model): link AI requests to credit consumption.
-- Additive + re-runnable. reference_id correlates every ai_requests row of an
-- operation to its credit_transactions entries; credits_consumed is stamped once
-- (on the operation's primary-service row). 'refunded' status marks operations
-- whose credits were returned after a failed/invalid/timed-out AI call.

ALTER TABLE ai_requests ADD COLUMN IF NOT EXISTS reference_id     TEXT;
ALTER TABLE ai_requests ADD COLUMN IF NOT EXISTS credits_consumed INTEGER NOT NULL DEFAULT 0;

-- Allow the refunded terminal state alongside the existing success/error.
ALTER TABLE ai_requests DROP CONSTRAINT IF EXISTS ai_requests_status_check;
ALTER TABLE ai_requests ADD  CONSTRAINT ai_requests_status_check
  CHECK (status IN ('success','error','refunded'));

CREATE INDEX IF NOT EXISTS ai_requests_reference_idx    ON ai_requests (reference_id);
CREATE INDEX IF NOT EXISTS ai_requests_user_created_idx ON ai_requests (user_id, created_at);
