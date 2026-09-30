// Central AI accounting layer.
//
// Every AI call must flow through here so that tokens, cost, latency, model,
// status and errors are captured on ai_requests exactly once, consistently.
// Individual features must NOT compute tokens or cost themselves.
import crypto from "crypto";
import sql from "../config/Neon.js";
import { AI, AI_MODEL } from "../config/ai.js";
import { PROVIDERS } from "../config/aiServices.js";

// --- pricing -------------------------------------------------------------
// In-process cache of effective-dated prices. Pricing changes rarely and is
// seeded via migration, so a short TTL cache avoids a DB hit per AI call
// without needing Redis (V1 rule: PostgreSQL only, no external cache).
const priceCache = new Map(); // key `${provider}|${model}` -> { at, rows }
const PRICE_TTL_MS = 5 * 60 * 1000;

/**
 * Resolve the price in effect for a model at a given time.
 * @returns {Promise<{inputPrice:number, outputPrice:number}|null>}
 */
export const getPricing = async (provider, model, at = new Date()) => {
  if (!provider || !model) return null;
  const key = `${provider}|${model}`;
  const cached = priceCache.get(key);
  let rows = cached && Date.now() - cached.at < PRICE_TTL_MS ? cached.rows : null;

  if (!rows) {
    rows = await sql`
      SELECT input_price, output_price, effective_from::text AS effective_from
      FROM ai_model_pricing
      WHERE provider = ${provider} AND model = ${model}
      ORDER BY effective_from DESC
    `;
    priceCache.set(key, { at: Date.now(), rows });
  }

  // effective_from is 'YYYY-MM-DD' text; compare as calendar dates.
  const day = new Date(at).toISOString().slice(0, 10);
  const row = rows.find((r) => String(r.effective_from).slice(0, 10) <= day) || rows[rows.length - 1];
  if (!row) return null;
  return { inputPrice: Number(row.input_price), outputPrice: Number(row.output_price) };
};

// --- cost ----------------------------------------------------------------
const costOf = (inputTokens, outputTokens, price) => {
  if (!price) return { inputCost: 0, outputCost: 0, totalCost: 0 };
  const inputCost = (inputTokens / 1e6) * price.inputPrice;
  const outputCost = (outputTokens / 1e6) * price.outputPrice;
  return { inputCost, outputCost, totalCost: inputCost + outputCost };
};

// Map a raw provider error to a coarse, non-sensitive category (spec section 19).
const categorizeError = (err) => {
  const status = err?.status ?? err?.response?.status;
  const msg = String(err?.message || "").toLowerCase();
  if (status === 429 || /rate.?limit/.test(msg)) return "RATE_LIMIT";
  if (status === 401 || status === 403 || /api key|unauthor|permission/.test(msg)) return "AUTH_ERROR";
  if (/quota|exceed/.test(msg)) return "QUOTA_EXCEEDED";
  if (/timed? ?out|etimedout/.test(msg)) return "TIMEOUT";
  if (/network|econnreset|enotfound|socket/.test(msg)) return "NETWORK_ERROR";
  if (/truncated|json|expected|unexpected|validation|schema/.test(msg)) return "SCHEMA_VALIDATION";
  if (status >= 500 || /provider|server error|unavailable/.test(msg)) return "PROVIDER_ERROR";
  return "INTERNAL_ERROR";
};

// Strip anything that could leak a secret; keep a short, safe summary.
const sanitizeMessage = (msg) =>
  String(msg || "")
    .replace(/(key|token|secret|authorization|bearer)[^\s]*/gi, "[redacted]")
    .slice(0, 500);

/**
 * Insert one ai_requests row. Never throws — a tracking failure must not break
 * the user-facing feature (it is logged instead).
 */
export const recordUsage = async ({
  requestId = crypto.randomUUID(),
  userId,
  service,
  provider,
  model = null,
  status,
  startedAt,
  completedAt = new Date(),
  inputTokens = 0,
  outputTokens = 0,
  totalTokens = inputTokens + outputTokens,
  inputCost = 0,
  outputCost = 0,
  totalCost = 0,
  inputPrice = null,
  outputPrice = null,
  promptVersion = null,
  analysisVersion = null,
  schemaVersion = null,
  errorCode = null,
  errorMessage = null,
  resumeId = null,
  jobId = null,
  referenceId = null,
} = {}) => {
  try {
    const durationMs =
      startedAt && completedAt ? new Date(completedAt) - new Date(startedAt) : null;
    await sql`
      INSERT INTO ai_requests (
        id, user_id, service, provider, model, status,
        started_at, completed_at, duration_ms,
        input_tokens, output_tokens, total_tokens,
        input_cost, output_cost, total_cost, input_price, output_price,
        prompt_version, analysis_version, schema_version,
        error_code, error_message, resume_id, job_id, reference_id
      ) VALUES (
        ${requestId}, ${userId ?? "unknown"}, ${service}, ${provider}, ${model}, ${status},
        ${startedAt ?? new Date()}, ${completedAt}, ${durationMs},
        ${inputTokens}, ${outputTokens}, ${totalTokens},
        ${inputCost}, ${outputCost}, ${totalCost}, ${inputPrice}, ${outputPrice},
        ${promptVersion}, ${analysisVersion}, ${schemaVersion},
        ${errorCode}, ${errorMessage}, ${resumeId}, ${jobId}, ${referenceId}
      )
    `;
  } catch (e) {
    console.error("recordUsage failed (request still served):", e.message);
  }
  return requestId;
};

/**
 * The single chokepoint for LLM chat calls. Wraps the OpenAI-compatible Gemini
 * client, captures usage/cost, records an ai_requests row (success or error),
 * and returns the raw response plus the requestId.
 *
 * @returns {Promise<{res:object, requestId:string, usage:object, cost:object}>}
 */
export const runChat = async ({
  service,
  userId,
  model = AI_MODEL,
  provider = PROVIDERS.GEMINI,
  meta = {},
  promptVersion = null,
  analysisVersion = null,
  schemaVersion = null,
  ...openaiOpts
} = {}) => {
  const requestId = crypto.randomUUID();
  const startedAt = new Date();

  try {
    const res = await AI.chat.completions.create({ model, ...openaiOpts });

    const u = res?.usage || {};
    const inputTokens = u.prompt_tokens ?? 0;
    const outputTokens = u.completion_tokens ?? 0;
    const totalTokens = u.total_tokens ?? inputTokens + outputTokens;

    const price = await getPricing(provider, model, startedAt);
    const cost = costOf(inputTokens, outputTokens, price);

    await recordUsage({
      requestId,
      userId,
      service,
      provider,
      model,
      status: "success",
      startedAt,
      inputTokens,
      outputTokens,
      totalTokens,
      inputCost: cost.inputCost,
      outputCost: cost.outputCost,
      totalCost: cost.totalCost,
      inputPrice: price?.inputPrice ?? null,
      outputPrice: price?.outputPrice ?? null,
      promptVersion,
      analysisVersion,
      schemaVersion,
      resumeId: meta.resumeId ?? null,
      jobId: meta.jobId ?? null,
      referenceId: meta.referenceId ?? null,
    });

    return { res, requestId, usage: { inputTokens, outputTokens, totalTokens }, cost };
  } catch (err) {
    await recordUsage({
      requestId,
      userId,
      service,
      provider,
      model,
      status: "error",
      startedAt,
      errorCode: categorizeError(err),
      errorMessage: sanitizeMessage(err?.message),
      promptVersion,
      analysisVersion,
      schemaVersion,
      resumeId: meta.resumeId ?? null,
      jobId: meta.jobId ?? null,
      referenceId: meta.referenceId ?? null,
    });
    throw err;
  }
};
