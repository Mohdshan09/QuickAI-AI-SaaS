import express from "express";
import { auth } from "../middlewares/auth.js";
import { getMe } from "../controllers/Me.js";

const meRouter = express.Router();

// GET /api/me — the authenticated application user.
meRouter.get("/", auth, getMe);

export default meRouter;
