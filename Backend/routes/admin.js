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

adminRouter.get("/ai/requests", requireAdmin("view_requests"), listRequests);
adminRouter.get("/ai/requests/:id", requireAdmin("view_requests"), getRequest);
adminRouter.get("/ai/services", requireAdmin("view_services"), getServices);
adminRouter.get("/ai/models", requireAdmin("view_models"), getModels);
adminRouter.get("/ai/errors", requireAdmin("view_errors"), getErrors);

adminRouter.get("/costs", requireAdmin("view_costs"), getCosts);

export default adminRouter;
