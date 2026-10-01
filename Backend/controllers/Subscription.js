import {
  getCurrentSubscription,
  getSubscriptionHistory,
  cancelSubscription,
  resumeSubscription,
} from "../services/subscriptionService.js";
import { SubscriptionError } from "../lib/subscriptionError.js";
import { sendApiError } from "../lib/apiError.js";

// Shape a subscription for the API (spec §30). Only fields relevant to the user.
const publicShape = (s) =>
  s && {
    status: s.status,
    plan: s.plan,
    billingInterval: s.billingInterval,
    currentPeriodStart: s.currentPeriodStart,
    currentPeriodEnd: s.currentPeriodEnd,
    cancelAtPeriodEnd: s.cancelAtPeriodEnd,
  };

// GET /api/subscription — the caller's current subscription, or null for FREE users
// (spec §30). Identity from req.user; never trust a client-supplied plan (spec §41).
export const getSubscription = async (req, res) => {
  try {
    const sub = await getCurrentSubscription(req.user.id);
    res.json({ success: true, subscription: publicShape(sub) });
  } catch (error) {
    sendApiError(res, error);
  }
};

// GET /api/subscription/history — the caller's own history only (spec §32).
export const getHistory = async (req, res) => {
  try {
    const history = await getSubscriptionHistory(req.user.id);
    res.json({
      success: true,
      history: history.map((s) => ({
        status: s.status,
        plan: s.plan,
        billingInterval: s.billingInterval,
        currentPeriodStart: s.currentPeriodStart,
        currentPeriodEnd: s.currentPeriodEnd,
        cancelAtPeriodEnd: s.cancelAtPeriodEnd,
        endedAt: s.endedAt,
      })),
    });
  } catch (error) {
    sendApiError(res, error);
  }
};

// POST /api/subscription/cancel — request cancellation of the caller's own active
// subscription (keeps access until period end). Not an activation/payment (spec §33).
export const cancel = async (req, res) => {
  try {
    const sub = await getCurrentSubscription(req.user.id);
    if (!sub) throw new SubscriptionError("NO_ACTIVE_SUBSCRIPTION", "You have no active subscription.");
    const updated = await cancelSubscription(sub.id, { reason: "user requested cancellation" });
    res.json({ success: true, subscription: publicShape(updated) });
  } catch (error) {
    sendApiError(res, error);
  }
};

// POST /api/subscription/resume — undo a pending cancellation before period end (spec §34).
export const resume = async (req, res) => {
  try {
    const sub = await getCurrentSubscription(req.user.id);
    if (!sub) throw new SubscriptionError("NO_ACTIVE_SUBSCRIPTION", "You have no active subscription.");
    const updated = await resumeSubscription(sub.id, { reason: "user resumed subscription" });
    res.json({ success: true, subscription: publicShape(updated) });
  } catch (error) {
    sendApiError(res, error);
  }
};
