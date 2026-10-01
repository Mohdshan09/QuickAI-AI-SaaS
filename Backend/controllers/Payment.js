import {
  createPayment,
  submitPayment,
  getPayment,
  getPaymentHistory,
} from "../services/paymentService.js";
import { getPaymentConfig } from "../config/payments.js";
import { sendApiError } from "../lib/apiError.js";

// Shape a payment for the user API (spec §26-27). Only fields relevant to the user.
const publicShape = (p) =>
  p && {
    id: p.id,
    purpose: p.purpose,
    referenceId: p.referenceId,
    amount: p.amount,
    currency: p.currency,
    status: p.status,
    upiId: p.upiId,
    utr: p.utr,
    userNote: p.userNote,
    adminNote: p.adminNote, // rejection reason is shown to the user (spec §19)
    submittedAt: p.submittedAt,
    verifiedAt: p.verifiedAt,
    rejectedAt: p.rejectedAt,
    createdAt: p.createdAt,
  };

// GET /api/payments/config — the UPI payment instructions (spec §14). No secrets.
export const getConfig = async (_req, res) => {
  try {
    res.json({ success: true, config: getPaymentConfig() });
  } catch (error) {
    sendApiError(res, error);
  }
};

// POST /api/payments { purpose, referenceId } — create a PENDING payment (spec §13). The amount
// is read from the DB server-side; the client never supplies price/amount (spec §7, §31).
export const create = async (req, res) => {
  try {
    const { purpose, referenceId } = req.body ?? {};
    const payment = await createPayment(req.user.id, purpose, referenceId);
    res.status(201).json({ success: true, payment: publicShape(payment) });
  } catch (error) {
    sendApiError(res, error);
  }
};

// POST /api/payments/:paymentId/submit { utr, userNote } — user submits their UPI reference
// (spec §15). Moves the payment to ADMIN_REVIEW; does NOT grant anything (spec §29).
export const submit = async (req, res) => {
  try {
    const { utr, userNote } = req.body ?? {};
    const payment = await submitPayment(req.user.id, req.params.paymentId, { utr, userNote });
    res.json({ success: true, payment: publicShape(payment) });
  } catch (error) {
    sendApiError(res, error);
  }
};

// GET /api/payments — the caller's own payment history (spec §26).
export const list = async (req, res) => {
  try {
    const history = await getPaymentHistory(req.user.id);
    res.json({ success: true, payments: history.map(publicShape) });
  } catch (error) {
    sendApiError(res, error);
  }
};

// GET /api/payments/:paymentId — the caller's own payment, ownership-checked.
export const getOne = async (req, res) => {
  try {
    const payment = await getPayment(req.user.id, req.params.paymentId);
    res.json({ success: true, payment: publicShape(payment) });
  } catch (error) {
    sendApiError(res, error);
  }
};
