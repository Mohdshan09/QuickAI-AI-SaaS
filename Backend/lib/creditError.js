// Typed error for the credit system (spec §25). Carries a stable machine code
// and the HTTP status the controller should return. Raw DB errors are always
// wrapped in CREDIT_OPERATION_FAILED so internals never leak to clients.

const STATUS = {
  UNAUTHENTICATED: 401,
  USER_NOT_FOUND: 404,
  WALLET_NOT_FOUND: 404,
  INVALID_CREDIT_AMOUNT: 400,
  INSUFFICIENT_CREDITS: 409,
  DUPLICATE_TRANSACTION: 409,
  INVALID_TRANSACTION_TYPE: 400,
  CREDIT_OPERATION_FAILED: 500,
};

export const CREDIT_ERROR_CODES = Object.keys(STATUS).reduce(
  (acc, k) => ((acc[k] = k), acc),
  {}
);

export class CreditError extends Error {
  /**
   * @param {keyof typeof STATUS} code
   * @param {string} [message] safe, user-facing message
   */
  constructor(code, message) {
    super(message || code);
    this.name = "CreditError";
    this.code = code;
    this.status = STATUS[code] ?? 500;
  }
}
