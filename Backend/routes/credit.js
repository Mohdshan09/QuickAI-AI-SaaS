import express from "express";
import { auth } from "../middlewares/auth.js";
import { getCredits, getTransactions } from "../controllers/Credit.js";

const creditRouter = express.Router();

// All credit routes require authentication; identity is taken from req.user.
creditRouter.get("/", auth, getCredits);
creditRouter.get("/transactions", auth, getTransactions);

export default creditRouter;
