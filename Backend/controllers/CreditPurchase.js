import {
  createPurchase,
  getPurchase,
  getPurchaseHistory,
} from "../services/creditPurchaseService.js";
import { getActivePacks } from "../services/creditPackService.js";
import { sendApiError } from "../lib/apiError.js";

// Shape a purchase for the API (spec §27). Only fields relevant to the user.
const publicShape = (p) =>
  p && {
    id: p.id,
    status: p.status,
    pack: p.pack,
    credits: p.credits,
    amount: p.amount,
    currency: p.currency,
    createdAt: p.createdAt,
    confirmedAt: p.confirmedAt,
  };

// GET /api/credits/packs — the active credit packs (spec §25). Prices/credits are
// authoritative from the DB; the client never supplies them.
export const listPacks = async (req, res) => {
  try {
    const packs = await getActivePacks();
    res.json({
      success: true,
      packs: packs.map((p) => ({
        key: p.key,
        name: p.name,
        description: p.description,
        credits: p.credits,
        price: p.price,
        currency: p.currency,
      })),
    });
  } catch (error) {
    sendApiError(res, error);
  }
};

// POST /api/credits/purchases { packKey } — create a PENDING purchase for the caller
// (spec §26). The body may ONLY carry packKey; price/credits are snapshotted server-side
// from the pack (spec §7). An optional Idempotency-Key header dedupes retries (spec §41).
// No credits are granted here — confirmation is a controlled admin/server op (spec §11, §38).
export const createCreditPurchase = async (req, res) => {
  try {
    const { packKey } = req.body ?? {};
    if (typeof packKey !== "string" || !packKey.trim()) {
      return res.status(400).json({ success: false, code: "PACK_NOT_FOUND", message: "A packKey is required." });
    }
    const idempotencyKey = req.get("Idempotency-Key") || req.body?.idempotencyKey || null;
    const purchase = await createPurchase(req.user.id, packKey.trim(), { idempotencyKey });
    res.status(201).json({ success: true, purchase: publicShape(purchase) });
  } catch (error) {
    sendApiError(res, error);
  }
};

// GET /api/credits/purchases — the caller's own purchase history (spec §28).
export const listCreditPurchases = async (req, res) => {
  try {
    const history = await getPurchaseHistory(req.user.id);
    res.json({ success: true, purchases: history.map(publicShape) });
  } catch (error) {
    sendApiError(res, error);
  }
};

// GET /api/credits/purchases/:id — the caller's own purchase, ownership-checked (spec §29).
export const getCreditPurchase = async (req, res) => {
  try {
    const purchase = await getPurchase(req.user.id, req.params.id);
    res.json({ success: true, purchase: publicShape(purchase) });
  } catch (error) {
    sendApiError(res, error);
  }
};
