import { ensureWallet, getWallet, listTransactions } from "../services/creditService.js";
import { parseList } from "../lib/adminQuery.js";
import { CreditError } from "../lib/creditError.js";

// Map a thrown error to a consistent JSON response (spec §25). CreditErrors carry
// a safe code + status; anything else becomes a generic 500 (no internals leaked).
const sendError = (res, error) => {
  if (error instanceof CreditError) {
    return res.status(error.status).json({ success: false, code: error.code, message: error.message });
  }
  console.error("credit controller error:", error);
  return res.status(500).json({ success: false, code: "CREDIT_OPERATION_FAILED", message: "Credit operation failed." });
};

// GET /api/credits — the authenticated user's current balance. Identity comes
// from req.user (session), never from a client-supplied id (spec §21).
export const getCredits = async (req, res) => {
  try {
    await ensureWallet(req.user.id); // safe: idempotent, initial grant happens once
    const wallet = await getWallet(req.user.id);
    // Flat `balance` kept for back-compat; lifetime counters added for Phase 3 (§38).
    res.json({ success: true, balance: wallet.balance, ...wallet });
  } catch (error) {
    sendError(res, error);
  }
};

// GET /api/credits/transactions — user-scoped, newest-first, paginated history.
export const getTransactions = async (req, res) => {
  try {
    const { page, limit } = parseList(req.query, { sortable: [], defaultSort: "created_at", maxLimit: 100 });
    const { transactions, total } = await listTransactions(req.user.id, { page, limit });
    res.json({ success: true, transactions, pagination: { page, limit, total } });
  } catch (error) {
    sendError(res, error);
  }
};
