import { ensureUserPlan, getUserEntitlements } from "../services/entitlementService.js";
import { sendApiError } from "../lib/apiError.js";

// GET /api/entitlements — the authenticated user's current plan and the features
// available to them (spec §21). Identity comes from req.user (session), never from
// a client-supplied plan (spec §22). The frontend is display-only; it must not use
// this to make access decisions — the server enforces them.
export const getEntitlements = async (req, res) => {
  try {
    // Safety net: make sure the user has an active plan before reading it (idempotent;
    // mirrors ensureWallet in GET /api/credits).
    await ensureUserPlan(req.user.id);
    const { plan, features } = await getUserEntitlements(req.user.id);
    res.json({ success: true, plan: { key: plan.key, name: plan.name }, features });
  } catch (error) {
    sendApiError(res, error);
  }
};
