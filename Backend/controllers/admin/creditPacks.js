import crypto from "crypto";
import sql from "../../config/Neon.js";
import {
  getPack,
  createPack,
  updatePack,
  disablePack,
} from "../../services/creditPackService.js";
import { sendApiError } from "../../lib/apiError.js";

// Append an admin audit row for a pack action (spec §36). Best-effort; never blocks the op.
const auditPack = async ({ adminUserId, creditPackId = null, action, oldState = null, newState = null, reason = null }) => {
  try {
    await sql`
      INSERT INTO credit_purchase_audit (id, admin_user_id, action, credit_pack_id, old_state, new_state, reason, created_at)
      VALUES (${crypto.randomUUID()}, ${adminUserId}, ${action}, ${creditPackId}, ${oldState}, ${newState}, ${reason}, NOW())
    `;
  } catch (err) {
    console.error("credit pack audit failed:", err.message);
  }
};

// GET /api/admin/credit-packs — all packs incl. inactive (spec §34). Read-only.
export const listCreditPacks = async (_req, res) => {
  try {
    const rows = await sql`
      SELECT id, key, name, description, credits, price, currency, is_active
      FROM credit_packs ORDER BY price ASC
    `;
    res.json({
      success: true,
      packs: rows.map((r) => ({
        id: r.id, key: r.key, name: r.name, description: r.description,
        credits: r.credits, price: r.price, currency: r.currency, isActive: r.is_active,
      })),
    });
  } catch (error) {
    sendApiError(res, error);
  }
};

// POST /api/admin/credit-packs — create a pack (spec §34, §36). Audited.
export const createCreditPack = async (req, res) => {
  try {
    const { key, name, description, credits, price, currency, reason } = req.body ?? {};
    const pack = await createPack({ key, name, description, credits, price, currency });
    await auditPack({ adminUserId: req.auth().userId, creditPackId: pack.id, action: "CREDIT_PACK_CREATED", newState: pack.key, reason: reason ?? null });
    res.status(201).json({ success: true, pack });
  } catch (error) {
    sendApiError(res, error);
  }
};

// PATCH /api/admin/credit-packs/:key — edit a pack (spec §34, §36). Audited.
export const updateCreditPack = async (req, res) => {
  try {
    const before = await getPack(req.params.key);
    const pack = await updatePack(req.params.key, req.body ?? {});
    await auditPack({ adminUserId: req.auth().userId, creditPackId: pack.id, action: "CREDIT_PACK_UPDATED", oldState: before ? JSON.stringify({ credits: before.credits, price: before.price, isActive: before.isActive }) : null, newState: JSON.stringify({ credits: pack.credits, price: pack.price, isActive: pack.isActive }), reason: req.body?.reason ?? null });
    res.json({ success: true, pack });
  } catch (error) {
    sendApiError(res, error);
  }
};

// POST /api/admin/credit-packs/:key/disable — disable a pack (spec §34, §36). Audited.
export const disableCreditPack = async (req, res) => {
  try {
    const pack = await disablePack(req.params.key);
    await auditPack({ adminUserId: req.auth().userId, creditPackId: pack.id, action: "CREDIT_PACK_DISABLED", oldState: "active", newState: "inactive", reason: req.body?.reason ?? null });
    res.json({ success: true, pack });
  } catch (error) {
    sendApiError(res, error);
  }
};
