// Typed error for the subscription system (spec §35). Carries a stable machine code
// and the HTTP status the controller should return. Mirrors CreditError /
// EntitlementError so lib/apiError.js maps all of them to the same flat JSON shape.
// Raw DB errors are wrapped in SUBSCRIPTION_OPERATION_FAILED so internals never leak.

const STATUS = {
  SUBSCRIPTION_NOT_FOUND: 404,
  NO_ACTIVE_SUBSCRIPTION: 404,
  INVALID_SUBSCRIPTION_STATE: 409,  // invalid lifecycle transition (spec §35)
  PLAN_NOT_FOUND: 404,
  SUBSCRIPTION_OPERATION_FAILED: 500,
};

export const SUBSCRIPTION_ERROR_CODES = Object.keys(STATUS).reduce(
  (acc, k) => ((acc[k] = k), acc),
  {}
);

export class SubscriptionError extends Error {
  /**
   * @param {keyof typeof STATUS} code
   * @param {string} [message] safe, user-facing message
   */
  constructor(code, message) {
    super(message || code);
    this.name = "SubscriptionError";
    this.code = code;
    this.status = STATUS[code] ?? 500;
  }
}
