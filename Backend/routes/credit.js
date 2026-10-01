import express from "express";
import { auth } from "../middlewares/auth.js";
import { getCredits, getTransactions } from "../controllers/Credit.js";
import {
  listPacks,
  createCreditPurchase,
  listCreditPurchases,
  getCreditPurchase,
} from "../controllers/CreditPurchase.js";

const creditRouter = express.Router();

// All credit routes require authentication; identity is taken from req.user.
creditRouter.get("/", auth, getCredits);
creditRouter.get("/transactions", auth, getTransactions);

// Phase 6: one-time credit top-ups (spec §25-29). Users view packs, create PENDING
// purchases and read their own history; credit grants happen only on admin/server
// confirmation (spec §11, §38) — there is no user-facing confirm endpoint.
creditRouter.get("/packs", auth, listPacks);
creditRouter.post("/purchases", auth, createCreditPurchase);
creditRouter.get("/purchases", auth, listCreditPurchases);
creditRouter.get("/purchases/:id", auth, getCreditPurchase);

export default creditRouter;
