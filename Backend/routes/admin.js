import express from "express";
import { requireAdmin } from "../middlewares/requireAdmin.js";
import { getDashboard, getUsageOverview } from "../controllers/admin/dashboard.js";
import { listUsers, getUserProfile } from "../controllers/admin/users.js";
import {
  listRequests,
  getRequest,
  getServices,
  getModels,
  getErrors,
} from "../controllers/admin/aiRequests.js";
import { getCosts } from "../controllers/admin/analytics.js";
import { getMe } from "../controllers/admin/me.js";
import { adjustUserCredits } from "../controllers/admin/credits.js";
import { assignUserPlan } from "../controllers/admin/plan.js";
import { manageUserSubscription } from "../controllers/admin/subscriptions.js";
import {
  listCreditPacks,
  createCreditPack,
  updateCreditPack,
  disableCreditPack,
} from "../controllers/admin/creditPacks.js";
import { managePurchase, getAdminPurchase } from "../controllers/admin/creditPurchases.js";
import {
  adminListPayments,
  adminGetPayment,
  adminConfirmPayment,
  adminRejectPayment,
  adminRefundPayment,
} from "../controllers/admin/payments.js";

const adminRouter = express.Router();

// Auth-only: reports admin status and runs the bootstrap promotion. The admin
// UI calls this to decide access (so env-allowlist bootstrap works on first visit).
adminRouter.get("/me", getMe);

// Every admin route verifies auth (mounted after requireAuth in server.js),
// an admin role, and — where set — a specific permission. Phase 1 is read-only.
adminRouter.get("/dashboard", requireAdmin("view_usage"), getDashboard);
adminRouter.get("/usage/overview", requireAdmin("view_usage"), getUsageOverview);

adminRouter.get("/users", requireAdmin("view_users"), listUsers);
adminRouter.get("/users/:id", requireAdmin("view_users"), getUserProfile);

// Credit adjustment foundation (Phase 2, spec §23). Write action -> manage_users.
adminRouter.post("/users/:id/credits", requireAdmin("manage_users"), adjustUserCredits);

// Manual plan assignment (Phase 4, spec §33). Write action -> manage_users; audited.
adminRouter.post("/users/:id/plan", requireAdmin("manage_users"), assignUserPlan);

// Subscription management (Phase 5, spec §39). Write action -> manage_users; audited.
adminRouter.post("/users/:id/subscription", requireAdmin("manage_users"), manageUserSubscription);

// Credit top-ups (Phase 6). Pack catalog management + purchase confirmation/cancellation.
// Reads -> view_users; writes -> manage_users; every mutation is audited (spec §34-36).
adminRouter.get("/credit-packs", requireAdmin("view_users"), listCreditPacks);
adminRouter.post("/credit-packs", requireAdmin("manage_users"), createCreditPack);
adminRouter.patch("/credit-packs/:key", requireAdmin("manage_users"), updateCreditPack);
adminRouter.post("/credit-packs/:key/disable", requireAdmin("manage_users"), disableCreditPack);
adminRouter.get("/purchases/:id", requireAdmin("view_users"), getAdminPurchase);
adminRouter.post("/purchases/:id", requireAdmin("manage_users"), managePurchase);

// Phase 7: manual UPI payment verification (spec §18-19, §23, §33). Reads -> view_users;
// confirm/reject/refund -> manage_users; every action is audited.
adminRouter.get("/payments", requireAdmin("view_users"), adminListPayments);
adminRouter.get("/payments/:id", requireAdmin("view_users"), adminGetPayment);
adminRouter.post("/payments/:id/confirm", requireAdmin("manage_users"), adminConfirmPayment);
adminRouter.post("/payments/:id/reject", requireAdmin("manage_users"), adminRejectPayment);
adminRouter.post("/payments/:id/refund", requireAdmin("manage_users"), adminRefundPayment);

adminRouter.get("/ai/requests", requireAdmin("view_requests"), listRequests);
adminRouter.get("/ai/requests/:id", requireAdmin("view_requests"), getRequest);
adminRouter.get("/ai/services", requireAdmin("view_services"), getServices);
adminRouter.get("/ai/models", requireAdmin("view_models"), getModels);
adminRouter.get("/ai/errors", requireAdmin("view_errors"), getErrors);

adminRouter.get("/costs", requireAdmin("view_costs"), getCosts);

export default adminRouter;
