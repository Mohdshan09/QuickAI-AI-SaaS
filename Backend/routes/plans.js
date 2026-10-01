import express from "express";
import { listPlans } from "../controllers/Plans.js";

const plansRouter = express.Router();

// Active public plans + pricing (spec §31). PUBLIC — pricing is shown on the landing
// page to logged-out visitors, and it exposes no user data. Mounted before the auth
// gate in server.js. The controller never reads req.user.
plansRouter.get("/", listPlans);

export default plansRouter;
