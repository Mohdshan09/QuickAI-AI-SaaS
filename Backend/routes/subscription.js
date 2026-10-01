import express from "express";
import { auth } from "../middlewares/auth.js";
import { getSubscription, getHistory, cancel, resume } from "../controllers/Subscription.js";

const subscriptionRouter = express.Router();

// All routes require authentication; identity is taken from req.user (spec §41).
// There is NO public activation/plan-change endpoint — paid plans are activated only
// by controlled admin/server-side operations (spec §16). Cancel/resume only toggle
// the renewal flag on the caller's own subscription.
subscriptionRouter.get("/", auth, getSubscription);
subscriptionRouter.get("/history", auth, getHistory);
subscriptionRouter.post("/cancel", auth, cancel);
subscriptionRouter.post("/resume", auth, resume);

export default subscriptionRouter;
