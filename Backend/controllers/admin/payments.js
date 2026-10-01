import {
  listPayments,
  getPayment,
  confirmPayment,
  rejectPayment,
  refundPayment,
  countPendingReviews,
} from "../../services/paymentService.js";
import { sendApiError } from "../../lib/apiError.js";

// GET /api/admin/payments-pending-count — size of the review queue, for the admin nav badge.
export const adminPendingPaymentCount = async (_req, res) => {
  try {
    res.json({ success: true, count: await countPendingReviews() });
  } catch (error) {
    sendApiError(res, error);
  }
};

// GET /api/admin/payments?status&purpose&userId — payment dashboard list (spec §23). Read-only.
export const adminListPayments = async (req, res) => {
  try {
    const { status, purpose, userId } = req.query;
    const payments = await listPayments({
      status: status || null,
      purpose: purpose || null,
      userId: userId || null,
    });
    res.json({ success: true, payments });
  } catch (error) {
    sendApiError(res, error);
  }
};

// GET /api/admin/payments/:id — full payment detail for the verification screen (spec §24).
export const adminGetPayment = async (req, res) => {
  try {
    const payment = await getPayment(null, req.params.id, { asAdmin: true });
    res.json({ success: true, payment });
  } catch (error) {
    sendApiError(res, error);
  }
};

// A reason is required on every admin action so the audit log is meaningful (spec §25).
const requireReason = (req, res) => {
  const reason = req.body?.reason;
  if (typeof reason !== "string" || reason.trim().length === 0 || reason.length > 500) {
    res.status(400).json({ success: false, message: "A reason (1-500 chars) is required." });
    return null;
  }
  return reason.trim();
};

// POST /api/admin/payments/:id/confirm — verify a payment and apply the benefit (spec §18).
export const adminConfirmPayment = async (req, res) => {
  try {
    const reason = requireReason(req, res);
    if (reason === null) return;
    const payment = await confirmPayment(req.params.id, { adminUserId: req.auth().userId, reason });
    res.json({ success: true, payment });
  } catch (error) {
    sendApiError(res, error);
  }
};

// POST /api/admin/payments/:id/reject — reject a payment submission (spec §19).
export const adminRejectPayment = async (req, res) => {
  try {
    const reason = requireReason(req, res);
    if (reason === null) return;
    const payment = await rejectPayment(req.params.id, { adminUserId: req.auth().userId, reason });
    res.json({ success: true, payment });
  } catch (error) {
    sendApiError(res, error);
  }
};

// POST /api/admin/payments/:id/refund — mark a confirmed payment refunded (spec §30, record only).
export const adminRefundPayment = async (req, res) => {
  try {
    const reason = requireReason(req, res);
    if (reason === null) return;
    const payment = await refundPayment(req.params.id, { adminUserId: req.auth().userId, reason });
    res.json({ success: true, payment });
  } catch (error) {
    sendApiError(res, error);
  }
};
