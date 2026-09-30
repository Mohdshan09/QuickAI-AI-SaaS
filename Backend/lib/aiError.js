// Typed error for AI execution (spec §45). Stable machine codes + HTTP status.
// Credit-related codes live in lib/creditError.js; these cover the AI provider
// side. Raw provider errors are always wrapped so internals never leak (spec §24).

const STATUS = {
  AI_PROVIDER_ERROR: 502,
  AI_TIMEOUT: 504,
  AI_RESPONSE_INVALID: 502,
  AI_SERVICE_UNAVAILABLE: 503,
  AI_REQUEST_FAILED: 500,
  IDEMPOTENCY_CONFLICT: 409,
};

export const AI_ERROR_CODES = Object.keys(STATUS).reduce((a, k) => ((a[k] = k), a), {});

export class AiError extends Error {
  /** @param {keyof typeof STATUS} code @param {string} [message] safe, user-facing */
  constructor(code, message) {
    super(message || code);
    this.name = "AiError";
    this.code = code;
    this.status = STATUS[code] ?? 500;
  }
}

// Map a raw provider/execution error to a safe AiError (never exposes provider text).
export const toAiError = (err) => {
  if (err instanceof AiError) return err;
  const msg = String(err?.message || "").toLowerCase();
  if (/timed? ?out|etimedout|timeout/.test(msg)) {
    return new AiError("AI_TIMEOUT", "The AI service took too long. Please try again.");
  }
  if (/invalid response|failed validation|truncated|no json|json/.test(msg)) {
    return new AiError("AI_RESPONSE_INVALID", "The AI returned an unusable result. Please try again.");
  }
  if (/unavailable|503|service is busy/.test(msg)) {
    return new AiError("AI_SERVICE_UNAVAILABLE", "The AI service is temporarily unavailable.");
  }
  return new AiError("AI_PROVIDER_ERROR", "The AI service is temporarily unavailable.");
};
