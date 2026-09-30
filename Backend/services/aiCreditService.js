// aiCreditService — one place that wraps every credit-consuming AI operation
// (spec §10-11). Implements pre-charge + refund-on-failure so a failed, invalid,
// or timed-out AI call never permanently costs the user, and concurrent requests
// can't overspend (the atomic consume happens before the provider is called).
import crypto from "crypto";
import sql from "../config/Neon.js";
import { ensureWallet, consumeCredits, refundCredits, getBalance } from "./creditService.js";
import { CreditError } from "../lib/creditError.js";
import { AiError, toAiError } from "../lib/aiError.js";
import { getServiceCost, AI_REQUEST_TIMEOUT_MS } from "../config/aiCredits.js";
import { TRANSACTION_TYPES } from "../config/credits.js";

// Structured, secret-free event log (spec §49). Never logs prompts/keys.
const log = (event, fields = {}) =>
  console.log(`[ai] ${JSON.stringify({ event, at: new Date().toISOString(), ...fields })}`);

// Spec-named thin aliases over the credit service.
export { getServiceCost };
export const checkCredits = async (userId, amount) => (await getBalance(userId)) >= amount;
export const consumeForAI = (userId, amount, reference, meta) =>
  consumeCredits(userId, amount, reference, meta, { type: TRANSACTION_TYPES.AI_USAGE });
export const refundAIUsage = (userId, amount, reference, meta) =>
  refundCredits(userId, amount, reference, meta);

// Reject with AI_TIMEOUT if the provider call outlasts the configured budget.
const withTimeout = (promise, ms) =>
  new Promise((resolve, reject) => {
    const t = setTimeout(
      () => reject(new AiError("AI_TIMEOUT", "The AI service took too long. Please try again.")),
      ms
    );
    Promise.resolve(promise).then(
      (v) => (clearTimeout(t), resolve(v)),
      (e) => (clearTimeout(t), reject(e))
    );
  });

const alreadyConsumed = async (userId, referenceId) => {
  const [row] = await sql`
    SELECT id FROM credit_transactions
    WHERE user_id = ${userId} AND type = ${TRANSACTION_TYPES.AI_USAGE} AND reference_id = ${referenceId}
    LIMIT 1
  `;
  return !!row;
};

/**
 * Run one credit-consuming AI operation end to end.
 * @param {object} p
 * @param {string} p.userId
 * @param {string} p.service          SERVICES.* key (drives the cost)
 * @param {string} [p.idempotencyKey] client Idempotency-Key; becomes the reference
 * @param {function} [p.validate]     (result) => boolean; false -> AI_RESPONSE_INVALID + refund
 * @param {function} p.execute        async ({ referenceId }) => result  (the AI work)
 * @returns {Promise<{ referenceId, cost, replayed, result }>}
 * @throws {CreditError|AiError} INSUFFICIENT_CREDITS / AI_* (safe, typed)
 */
export const executeWithCredits = async ({
  userId,
  service,
  idempotencyKey = null,
  validate,
  execute,
  timeoutMs = AI_REQUEST_TIMEOUT_MS,
}) => {
  if (!userId) throw new CreditError("UNAUTHENTICATED", "Authentication required.");

  await ensureWallet(userId); // spec §34: wallet always exists before AI credit ops
  const cost = getServiceCost(service);
  const referenceId = idempotencyKey || `ai_req_${crypto.randomUUID()}`;

  // Idempotent replay: same key already charged -> do not charge or run again.
  if (idempotencyKey && (await alreadyConsumed(userId, referenceId))) {
    log("IDEMPOTENCY_REPLAY", { userId, service, referenceId });
    return { referenceId, cost, replayed: true, result: null };
  }

  log("AI_REQUEST_STARTED", { userId, service, referenceId, cost });

  // Pre-charge atomically. Throws INSUFFICIENT_CREDITS before any provider call.
  if (cost > 0) {
    try {
      await consumeCredits(userId, cost, referenceId, { service }, { type: TRANSACTION_TYPES.AI_USAGE });
      log("CREDIT_CONSUMED", { userId, service, referenceId, amount: cost });
    } catch (err) {
      if (err instanceof CreditError && err.code === "INSUFFICIENT_CREDITS") {
        const available = await getBalance(userId);
        log("INSUFFICIENT_CREDITS", { userId, service, required: cost, available });
        const e = new CreditError("INSUFFICIENT_CREDITS", "You do not have enough credits for this AI operation.");
        e.required = cost;
        e.available = available;
        throw e;
      }
      throw err;
    }
  }

  try {
    const result = await withTimeout(Promise.resolve(execute({ referenceId })), timeoutMs);
    if (validate && !validate(result)) {
      throw new AiError("AI_RESPONSE_INVALID", "The AI returned an unusable result. Please try again.");
    }
    // Stamp the credits onto the operation's primary-service ai_requests row.
    if (cost > 0) {
      await sql`
        UPDATE ai_requests SET credits_consumed = ${cost}
        WHERE reference_id = ${referenceId} AND service = ${service}
      `;
    }
    log("AI_REQUEST_SUCCESS", { userId, service, referenceId });
    return { referenceId, cost, replayed: false, result };
  } catch (err) {
    const aiErr = err instanceof CreditError || err instanceof AiError ? err : toAiError(err);
    if (cost > 0) {
      try {
        await refundCredits(userId, cost, referenceId, { reason: aiErr.code });
        await sql`UPDATE ai_requests SET status = 'refunded' WHERE reference_id = ${referenceId}`;
        log("CREDIT_REFUNDED", { userId, service, referenceId, amount: cost, reason: aiErr.code });
      } catch (refundErr) {
        console.error("refund after AI failure failed:", refundErr.message);
      }
    }
    log("AI_REQUEST_FAILED", { userId, service, referenceId, code: aiErr.code });
    throw aiErr;
  }
};
