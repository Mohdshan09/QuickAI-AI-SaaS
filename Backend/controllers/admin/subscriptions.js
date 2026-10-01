import {
  activateSubscription,
  cancelSubscription,
  resumeSubscription,
  expireSubscription,
  changeSubscriptionPlan,
  getCurrentSubscription,
} from "../../services/subscriptionService.js";
import { isKnownPlan } from "../../config/plans.js";
import { SubscriptionError } from "../../lib/subscriptionError.js";
import { sendApiError } from "../../lib/apiError.js";

// POST /api/admin/users/:id/subscription — controlled, audited subscription ops for
// testing/support (spec §16, §39-40). Admin-only (requireAdmin in the route). This is
// the ONLY way to activate/change a paid plan; there is no public activation endpoint.
// Body: { action: activate|change|cancel|resume|expire, planKey?, immediate?, reason }.
export const manageUserSubscription = async (req, res) => {
  try {
    const targetUserId = req.params.id;
    const adminUserId = req.auth().userId;
    const { action, planKey, immediate, reason } = req.body;

    if (typeof reason !== "string" || reason.trim().length === 0 || reason.length > 500) {
      return res.status(400).json({ success: false, message: "A reason (1-500 chars) is required." });
    }
    const opts = { adminUserId, reason: reason.trim() };

    const requireCurrent = async () => {
      const cur = await getCurrentSubscription(targetUserId);
      if (!cur) throw new SubscriptionError("NO_ACTIVE_SUBSCRIPTION", "User has no active subscription.");
      return cur;
    };

    let subscription;
    switch (action) {
      case "activate":
        if (!isKnownPlan(planKey)) {
          return res.status(400).json({ success: false, code: "PLAN_NOT_FOUND", message: "Unknown plan key." });
        }
        subscription = await activateSubscription(targetUserId, planKey, opts);
        break;
      case "change": {
        if (!isKnownPlan(planKey)) {
          return res.status(400).json({ success: false, code: "PLAN_NOT_FOUND", message: "Unknown plan key." });
        }
        const cur = await requireCurrent();
        subscription = await changeSubscriptionPlan(cur.id, planKey, { ...opts, immediate: !!immediate });
        break;
      }
      case "cancel":
        subscription = await cancelSubscription((await requireCurrent()).id, opts);
        break;
      case "resume":
        subscription = await resumeSubscription((await requireCurrent()).id, opts);
        break;
      case "expire":
        subscription = await expireSubscription((await requireCurrent()).id, opts);
        break;
      default:
        return res.status(400).json({ success: false, message: "Unknown action." });
    }

    res.json({ success: true, subscription });
  } catch (error) {
    sendApiError(res, error);
  }
};
