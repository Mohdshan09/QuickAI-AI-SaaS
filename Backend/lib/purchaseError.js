// Typed error for the credit top-up system (spec §37). Carries a stable machine code
// and the HTTP status the controller should return. Mirrors CreditError /
// SubscriptionError so lib/apiError.js maps all of them to the same flat JSON shape.
// Raw DB errors are wrapped in PURCHASE_OPERATION_FAILED so internals never leak.

const STATUS = {
  PACK_NOT_FOUND: 404,
  PACK_INACTIVE: 409,              // pack exists but is disabled (spec §34)
  PURCHASE_NOT_FOUND: 404,
  INVALID_PURCHASE_STATE: 409,    // invalid lifecycle transition (spec §42)
  PURCHASE_FORBIDDEN: 403,        // accessing another user's purchase (spec §29, §38)
  PURCHASE_OPERATION_FAILED: 500,
};

export const PURCHASE_ERROR_CODES = Object.keys(STATUS).reduce(
  (acc, k) => ((acc[k] = k), acc),
  {}
);

export class PurchaseError extends Error {
  /**
   * @param {keyof typeof STATUS} code
   * @param {string} [message] safe, user-facing message
   */
  constructor(code, message) {
    super(message || code);
    this.name = "PurchaseError";
    this.code = code;
    this.status = STATUS[code] ?? 500;
  }
}
