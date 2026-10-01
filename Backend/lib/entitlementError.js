// Typed error for the entitlement system (spec §20). Carries a stable machine
// code and the HTTP status the controller should return. Mirrors CreditError so
// lib/apiError.js can map both to the same flat JSON shape. Raw DB errors are
// wrapped in ENTITLEMENT_CHECK_FAILED / USAGE_RECORD_ERROR so internals never leak.
//
// Important (spec §20): never surface INSUFFICIENT_CREDITS when the real problem
// is entitlement, and never surface an entitlement code for a credit problem.

const STATUS = {
  FEATURE_NOT_AVAILABLE: 403,   // feature disabled on the user's plan
  USAGE_LIMIT_REACHED: 429,     // monthly limit hit
  PLAN_NOT_FOUND: 404,          // plan key does not exist
  USER_PLAN_NOT_FOUND: 404,     // user has no active plan row
  INVALID_FEATURE: 400,         // unknown feature key
  USAGE_RECORD_ERROR: 500,      // failed to write feature_usage
  ENTITLEMENT_CHECK_FAILED: 500,// unexpected failure resolving entitlement
};

export const ENTITLEMENT_ERROR_CODES = Object.keys(STATUS).reduce(
  (acc, k) => ((acc[k] = k), acc),
  {}
);

export class EntitlementError extends Error {
  /**
   * @param {keyof typeof STATUS} code
   * @param {string} [message] safe, user-facing message
   */
  constructor(code, message) {
    super(message || code);
    this.name = "EntitlementError";
    this.code = code;
    this.status = STATUS[code] ?? 500;
  }
}
