// Typed error for the Phase 7 payment system (spec §32). Carries a stable machine code and the
// HTTP status the controller returns. Mirrors CreditError / SubscriptionError / PurchaseError
// so lib/apiError.js maps all of them to the same flat JSON shape. Raw DB errors are wrapped in
// PAYMENT_CONFIRMATION_FAILED / PAYMENT_REJECTION_FAILED so internals never leak.

const STATUS = {
  PAYMENT_NOT_FOUND: 404,
  PAYMENT_ACCESS_DENIED: 403,
  INVALID_PAYMENT_PURPOSE: 400,
  INVALID_PAYMENT_REFERENCE: 400,
  PAYMENT_ALREADY_SUBMITTED: 409,
  PAYMENT_ALREADY_CONFIRMED: 409,
  PAYMENT_ALREADY_REJECTED: 409,
  INVALID_UTR: 400,
  DUPLICATE_UTR: 409,
  PAYMENT_CONFIRMATION_FAILED: 500,
  PAYMENT_REJECTION_FAILED: 500,
  UNAUTHORIZED_PAYMENT_ACTION: 403,
};

export const PAYMENT_ERROR_CODES = Object.keys(STATUS).reduce(
  (acc, k) => ((acc[k] = k), acc),
  {}
);

export class PaymentError extends Error {
  /**
   * @param {keyof typeof STATUS} code
   * @param {string} [message] safe, user-facing message
   */
  constructor(code, message) {
    super(message || code);
    this.name = "PaymentError";
    this.code = code;
    this.status = STATUS[code] ?? 500;
  }
}
