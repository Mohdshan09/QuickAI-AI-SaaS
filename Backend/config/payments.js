// Phase 7 payment configuration (spec §5, §14). Direct UPI with manual verification — no
// payment gateway. The UPI identity is server-side config, never hard-coded in the frontend
// (spec §5, §31). The frontend builds a dynamic per-amount QR from this (qrcode.react), so no
// static QR image is used. Env vars:
//   UPI_ID            e.g. "quickai@upi"   (required for real payments)
//   UPI_ACCOUNT_NAME  e.g. "Quick AI"       (payee name shown in the UPI app)

export const PAYMENT_PURPOSES = {
  SUBSCRIPTION: "SUBSCRIPTION",
  CREDIT_TOPUP: "CREDIT_TOPUP",
};

export const PAYMENT_STATUS = {
  PENDING: "PENDING",
  ADMIN_REVIEW: "ADMIN_REVIEW",
  CONFIRMED: "CONFIRMED",
  REJECTED: "REJECTED",
  REFUNDED: "REFUNDED",
};

export const isKnownPurpose = (p) =>
  Object.prototype.hasOwnProperty.call(PAYMENT_PURPOSES, p);

// Public payment config for authenticated users (spec §14). Never exposes secrets.
export const getPaymentConfig = () => ({
  upiId: process.env.UPI_ID || null,
  accountName: process.env.UPI_ACCOUNT_NAME || "Quick AI",
  currency: "INR",
});

// Basic UTR sanity check (spec §16): a valid-looking reference is still only a *claim* until
// an admin verifies it. Bank/UPI references are alphanumeric, typically 12 digits; we accept
// a reasonable alphanumeric range and reject anything obviously malformed.
export const isValidUtr = (utr) =>
  typeof utr === "string" && /^[A-Za-z0-9]{8,30}$/.test(utr.trim());
