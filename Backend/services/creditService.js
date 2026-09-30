// creditService — the ONLY layer allowed to change a wallet (spec §11, §34).
//
// Every balance change is atomic: a single-statement CTE updates the wallet and
// writes the ledger row together, so they can never diverge (spec §16). The Neon
// HTTP driver has no interactive transactions, but a lone statement is atomic and
// row-locks concurrent writers, which also gives us no-double-spend (spec §17) and
// negative-balance protection via the guarded UPDATE + the CHECK constraint (§15).
import crypto from "crypto";
import sql from "../config/Neon.js";
import {
  TRANSACTION_TYPES,
  LIFETIME_COUNTER,
  CREDIT_TYPES,
  isKnownType,
  INITIAL_CREDIT_GRANT,
  INITIAL_GRANT_REFERENCE,
} from "../config/credits.js";
import { CreditError } from "../lib/creditError.js";

const { INITIAL_GRANT, AI_USAGE, REFUND, ADMIN_ADJUSTMENT } = TRANSACTION_TYPES;

// ---- helpers ------------------------------------------------------------
const isPgCode = (err, code) =>
  err?.code === code || (code === "23505" && /duplicate key|unique/i.test(err?.message || "")) ||
  (code === "23503" && /foreign key/i.test(err?.message || ""));

const validateAmount = (amount) => {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new CreditError("INVALID_CREDIT_AMOUNT", "Amount must be a positive whole number.");
  }
};

// Absolute-amount deltas for the three lifetime counters, by type.
const counters = (type, absAmount) => {
  const which = LIFETIME_COUNTER[type];
  return {
    granted: which === "granted" ? absAmount : 0,
    purchased: which === "purchased" ? absAmount : 0,
    used: which === "used" ? absAmount : 0,
  };
};

const shapeTx = (row) =>
  row && {
    id: row.id,
    type: row.type,
    amount: row.amount,
    balanceAfter: row.balance_after,
    createdAt: row.created_at,
  };

const getExistingTx = async (userId, type, referenceId) => {
  const [row] = await sql`
    SELECT id, type, amount, balance_after, created_at
    FROM credit_transactions
    WHERE user_id = ${userId} AND type = ${type} AND reference_id = ${referenceId}
    LIMIT 1
  `;
  return shapeTx(row);
};

// Wrap a mutating statement: translate the idempotency conflict into a no-op that
// returns the already-recorded transaction, and FK violations into USER_NOT_FOUND.
const runMutation = async (fn, { userId, type, referenceId }) => {
  try {
    return await fn();
  } catch (err) {
    if (isPgCode(err, "23505") && referenceId != null) {
      const existing = await getExistingTx(userId, type, referenceId);
      if (existing) return existing; // idempotent replay
      throw new CreditError("DUPLICATE_TRANSACTION", "Duplicate credit transaction.");
    }
    if (isPgCode(err, "23503")) {
      throw new CreditError("USER_NOT_FOUND", "User does not exist.");
    }
    if (err instanceof CreditError) throw err;
    console.error("credit mutation failed:", err.message);
    throw new CreditError("CREDIT_OPERATION_FAILED", "Credit operation failed.");
  }
};

// ---- atomic primitives --------------------------------------------------
// Add credits: create-or-increment the wallet and append the ledger row in one
// atomic statement. Used by all positive-amount types.
const applyCredit = ({ userId, amount, type, referenceId = null, metadata = null }) => {
  const c = counters(type, amount);
  const meta = metadata == null ? null : JSON.stringify(metadata);
  return runMutation(
    async () => {
      const [row] = await sql`
        WITH upsert AS (
          INSERT INTO credit_wallets (
            id, user_id, balance, lifetime_granted, lifetime_purchased, lifetime_used,
            created_at, updated_at
          ) VALUES (
            ${crypto.randomUUID()}, ${userId}, ${amount}, ${c.granted}, ${c.purchased}, ${c.used},
            NOW(), NOW()
          )
          ON CONFLICT (user_id) DO UPDATE SET
            balance            = credit_wallets.balance + ${amount},
            lifetime_granted   = credit_wallets.lifetime_granted + ${c.granted},
            lifetime_purchased = credit_wallets.lifetime_purchased + ${c.purchased},
            lifetime_used      = credit_wallets.lifetime_used + ${c.used},
            updated_at         = NOW()
          RETURNING balance
        )
        INSERT INTO credit_transactions (
          id, user_id, type, amount, balance_after, reference_id, metadata, created_at
        )
        SELECT ${crypto.randomUUID()}, ${userId}, ${type}, ${amount}, upsert.balance,
               ${referenceId}, ${meta}::jsonb, NOW()
        FROM upsert
        RETURNING id, type, amount, balance_after, created_at
      `;
      return shapeTx(row);
    },
    { userId, type, referenceId }
  );
};

// Remove credits: guarded UPDATE on an existing wallet. If the balance would go
// negative the UPDATE matches 0 rows, the ledger insert writes nothing, and we
// raise INSUFFICIENT_CREDITS — no ledger row for a failed consume (spec §14).
const applyDebit = ({ userId, amount, type, referenceId = null, metadata = null }) => {
  const c = counters(type, amount);
  const meta = metadata == null ? null : JSON.stringify(metadata);
  return runMutation(
    async () => {
      const [row] = await sql`
        WITH upd AS (
          UPDATE credit_wallets SET
            balance       = balance - ${amount},
            lifetime_used = lifetime_used + ${c.used},
            updated_at    = NOW()
          WHERE user_id = ${userId} AND balance - ${amount} >= 0
          RETURNING balance
        )
        INSERT INTO credit_transactions (
          id, user_id, type, amount, balance_after, reference_id, metadata, created_at
        )
        SELECT ${crypto.randomUUID()}, ${userId}, ${type}, ${-amount}, upd.balance,
               ${referenceId}, ${meta}::jsonb, NOW()
        FROM upd
        RETURNING id, type, amount, balance_after, created_at
      `;
      if (!row) throw new CreditError("INSUFFICIENT_CREDITS", "Not enough credits.");
      return shapeTx(row);
    },
    { userId, type, referenceId }
  );
};

// ---- public API ---------------------------------------------------------

/** Current available balance (read-only; 0 if no wallet yet). Spec §12. */
export const getBalance = async (userId) => {
  const [row] = await sql`SELECT balance FROM credit_wallets WHERE user_id = ${userId}`;
  return row?.balance ?? 0;
};

/**
 * Idempotently ensure a wallet exists and its one-time initial grant is applied
 * (spec §19–20). Safe to call on every login / credit access — never grants twice.
 */
export const ensureWallet = async (userId) => {
  if (INITIAL_CREDIT_GRANT > 0) {
    // grantCredits creates the wallet on first call; the fixed reference makes the
    // grant idempotent, so repeat calls return the existing transaction as a no-op.
    await grantCredits(userId, INITIAL_CREDIT_GRANT, INITIAL_GRANT, INITIAL_GRANT_REFERENCE);
  } else {
    // No initial grant configured — still make sure an (empty) wallet row exists.
    try {
      await sql`
        INSERT INTO credit_wallets (id, user_id, created_at, updated_at)
        VALUES (${crypto.randomUUID()}, ${userId}, NOW(), NOW())
        ON CONFLICT (user_id) DO NOTHING
      `;
    } catch (err) {
      if (isPgCode(err, "23503")) throw new CreditError("USER_NOT_FOUND", "User does not exist.");
      throw new CreditError("CREDIT_OPERATION_FAILED", "Wallet creation failed.");
    }
  }
  return { balance: await getBalance(userId) };
};

/** Add credits of a positive-credit type (INITIAL_GRANT/BONUS/PURCHASE/SUBSCRIPTION_GRANT/REFUND). */
export const grantCredits = async (userId, amount, type, referenceId = null, metadata = null) => {
  validateAmount(amount);
  if (!isKnownType(type) || !CREDIT_TYPES.has(type)) {
    throw new CreditError("INVALID_TRANSACTION_TYPE", "Not a valid grant type.");
  }
  return applyCredit({ userId, amount, type, referenceId, metadata });
};

/** Consume credits (default AI_USAGE). Fails with INSUFFICIENT_CREDITS if short. */
export const consumeCredits = async (
  userId,
  amount,
  referenceId = null,
  metadata = null,
  { type = AI_USAGE } = {}
) => {
  validateAmount(amount);
  if (!isKnownType(type) || CREDIT_TYPES.has(type)) {
    throw new CreditError("INVALID_TRANSACTION_TYPE", "Not a valid consumption type.");
  }
  return applyDebit({ userId, amount, type, referenceId, metadata });
};

/** Return previously-consumed credits (spec §7, §8). */
export const refundCredits = async (userId, amount, referenceId = null, metadata = null) => {
  validateAmount(amount);
  return applyCredit({ userId, amount, type: REFUND, referenceId, metadata });
};

/**
 * Admin manual correction (spec §23). Signed delta; negative adjustments cannot
 * drive the balance below zero (INSUFFICIENT_CREDITS). Reason is recorded.
 */
export const adjustCredits = async (userId, delta, reason, referenceId = null) => {
  if (!Number.isInteger(delta) || delta === 0) {
    throw new CreditError("INVALID_CREDIT_AMOUNT", "Adjustment must be a non-zero whole number.");
  }
  const metadata = { reason: reason ?? null };
  return delta > 0
    ? applyCredit({ userId, amount: delta, type: ADMIN_ADJUSTMENT, referenceId, metadata })
    : applyDebit({ userId, amount: -delta, type: ADMIN_ADJUSTMENT, referenceId, metadata });
};

/** Paginated, newest-first ledger for a user (spec §22). Metadata is not exposed. */
export const listTransactions = async (userId, { page = 1, limit = 20 } = {}) => {
  const offset = (page - 1) * limit;
  const [{ count }] = await sql`
    SELECT count(*)::int AS count FROM credit_transactions WHERE user_id = ${userId}
  `;
  const rows = await sql`
    SELECT id, type, amount, balance_after, created_at
    FROM credit_transactions
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
  return { transactions: rows.map(shapeTx), total: count };
};
