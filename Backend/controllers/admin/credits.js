import { adjustCredits, getBalance } from "../../services/creditService.js";
import { CreditError } from "../../lib/creditError.js";

// POST /api/admin/users/:id/credits — manual credit correction (spec §23).
// Admin-only (gated by requireAdmin in the route). The signed `amount` and a
// human `reason` are recorded as an ADMIN_ADJUSTMENT ledger entry via the credit
// service — the wallet is never modified directly.
export const adjustUserCredits = async (req, res) => {
  try {
    const targetUserId = req.params.id;
    const { amount, reason } = req.body;

    if (!Number.isInteger(amount) || amount === 0) {
      return res.status(400).json({
        success: false,
        code: "INVALID_CREDIT_AMOUNT",
        message: "amount must be a non-zero whole number.",
      });
    }
    if (typeof reason !== "string" || reason.trim().length === 0 || reason.length > 500) {
      return res.status(400).json({ success: false, message: "A reason (1-500 chars) is required." });
    }

    const transaction = await adjustCredits(targetUserId, amount, reason.trim());
    const balance = await getBalance(targetUserId);
    res.json({ success: true, balance, transaction });
  } catch (error) {
    if (error instanceof CreditError) {
      return res.status(error.status).json({ success: false, code: error.code, message: error.message });
    }
    console.error("adjustUserCredits failed:", error);
    res.status(500).json({ success: false, message: "Credit adjustment failed." });
  }
};
