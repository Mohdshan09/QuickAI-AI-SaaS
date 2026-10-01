import {
  confirmPurchase,
  cancelPurchase,
  getPurchase,
} from "../../services/creditPurchaseService.js";
import { sendApiError } from "../../lib/apiError.js";

// POST /api/admin/purchases/:id — controlled, audited purchase management for testing/support
// (spec §35-36). Admin-only (requireAdmin in the route). This is how a PENDING purchase is
// confirmed (granting its credits) before payments exist; Phase 7's verified webhook will
// call the same confirmPurchase. Body: { action: confirm|cancel, reason }.
export const managePurchase = async (req, res) => {
  try {
    const purchaseId = req.params.id;
    const adminUserId = req.auth().userId;
    const { action, reason } = req.body ?? {};

    if (typeof reason !== "string" || reason.trim().length === 0 || reason.length > 500) {
      return res.status(400).json({ success: false, message: "A reason (1-500 chars) is required." });
    }
    const opts = { adminUserId, reason: reason.trim() };

    let purchase;
    switch (action) {
      case "confirm":
        purchase = await confirmPurchase(purchaseId, opts);
        break;
      case "cancel":
        purchase = await cancelPurchase(purchaseId, opts);
        break;
      default:
        return res.status(400).json({ success: false, message: "Unknown action." });
    }

    res.json({ success: true, purchase });
  } catch (error) {
    sendApiError(res, error);
  }
};

// GET /api/admin/purchases/:id — inspect any purchase (spec §35). Admin bypasses ownership.
export const getAdminPurchase = async (req, res) => {
  try {
    const purchase = await getPurchase(null, req.params.id, { asAdmin: true });
    res.json({ success: true, purchase });
  } catch (error) {
    sendApiError(res, error);
  }
};
