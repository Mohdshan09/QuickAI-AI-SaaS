// Centralized credit configuration and transaction-type registry (spec §7, §30).
// Kept in one place so the ledger's CHECK constraint, the service, and future
// phases agree on the vocabulary and on which lifetime counter each type moves.

// Every ledger transaction type. Values are stored verbatim on
// credit_transactions.type (and must match the CHECK in migration 009).
export const TRANSACTION_TYPES = {
  INITIAL_GRANT: "INITIAL_GRANT",
  BONUS: "BONUS",
  PURCHASE: "PURCHASE",
  SUBSCRIPTION_GRANT: "SUBSCRIPTION_GRANT",
  AI_USAGE: "AI_USAGE",
  REFUND: "REFUND",
  ADMIN_ADJUSTMENT: "ADMIN_ADJUSTMENT",
};

export const isKnownType = (t) =>
  Object.prototype.hasOwnProperty.call(TRANSACTION_TYPES, t);

// Which lifetime_* counter a type increments (by the absolute amount). Balance is
// always adjusted; these are the cumulative stats. REFUND and ADMIN_ADJUSTMENT
// move only the balance (no lifetime counter) to keep the stats meaningful.
//   granted   -> lifetime_granted
//   purchased -> lifetime_purchased
//   used      -> lifetime_used
//   null      -> balance only
export const LIFETIME_COUNTER = {
  INITIAL_GRANT: "granted",
  BONUS: "granted",
  SUBSCRIPTION_GRANT: "granted",
  PURCHASE: "purchased",
  AI_USAGE: "used",
  REFUND: null,
  ADMIN_ADJUSTMENT: null,
};

// Types that add credits (positive amount). The rest are debits (AI_USAGE) or
// signed (ADMIN_ADJUSTMENT, handled explicitly by adjustCredits).
export const CREDIT_TYPES = new Set([
  TRANSACTION_TYPES.INITIAL_GRANT,
  TRANSACTION_TYPES.BONUS,
  TRANSACTION_TYPES.PURCHASE,
  TRANSACTION_TYPES.SUBSCRIPTION_GRANT,
  TRANSACTION_TYPES.REFUND,
]);

// Configurable initial grant for a new wallet (spec §19). Never hard-coded in
// business logic. Defaults to 3; may change when the Free plan is finalized.
export const INITIAL_CREDIT_GRANT = Math.max(
  0,
  parseInt(process.env.INITIAL_CREDIT_GRANT ?? "3", 10) || 0
);

// Fixed reference for the one-time initial grant, so the idempotency key
// (user_id, type, reference_id) guarantees it can never be granted twice.
export const INITIAL_GRANT_REFERENCE = "initial";
