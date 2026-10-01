import express from "express";
import { auth } from "../middlewares/auth.js";
import { getEntitlements } from "../controllers/Entitlement.js";

const entitlementsRouter = express.Router();

// All entitlement routes require authentication; identity is taken from req.user
// (spec §22). Read-only: there is no public plan-switching endpoint (spec §33).
entitlementsRouter.get("/", auth, getEntitlements);

export default entitlementsRouter;
