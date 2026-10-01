import { assignPlan } from "../../services/entitlementService.js";
import { isKnownPlan } from "../../config/plans.js";
import { EntitlementError } from "../../lib/entitlementError.js";

// POST /api/admin/users/:id/plan — manual plan assignment for testing/support
// (spec §33). Admin-only (gated by requireAdmin). Every change writes a
// plan_change_audit record via the entitlement service. This is the ONLY way to
// change a plan server-side; there is no public plan-switching endpoint.
export const assignUserPlan = async (req, res) => {
  try {
    const targetUserId = req.params.id;
    const { planKey, reason } = req.body;

    if (typeof planKey !== "string" || !isKnownPlan(planKey)) {
      return res.status(400).json({ success: false, code: "PLAN_NOT_FOUND", message: "Unknown plan key." });
    }
    if (typeof reason !== "string" || reason.trim().length === 0 || reason.length > 500) {
      return res.status(400).json({ success: false, message: "A reason (1-500 chars) is required." });
    }

    const adminUserId = req.auth().userId; // Clerk id of the acting admin
    const { plan, oldPlan } = await assignPlan(targetUserId, planKey, {
      adminUserId,
      reason: reason.trim(),
    });

    res.json({ success: true, plan, oldPlan });
  } catch (error) {
    if (error instanceof EntitlementError) {
      return res.status(error.status).json({ success: false, code: error.code, message: error.message });
    }
    console.error("assignUserPlan failed:", error);
    res.status(500).json({ success: false, message: "Plan assignment failed." });
  }
};
