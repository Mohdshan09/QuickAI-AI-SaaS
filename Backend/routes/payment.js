import express from "express";
import { auth } from "../middlewares/auth.js";
import { getConfig, create, submit, list, getOne } from "../controllers/Payment.js";

const paymentRouter = express.Router();

// Phase 7: manual UPI payments (spec §33). All routes require authentication; identity is taken
// from req.user. Amounts are server-authoritative; there is no user-facing confirm (spec §31).
paymentRouter.get("/config", auth, getConfig);
paymentRouter.post("/", auth, create);
paymentRouter.post("/:paymentId/submit", auth, submit);
paymentRouter.get("/", auth, list);
paymentRouter.get("/:paymentId", auth, getOne);

export default paymentRouter;
