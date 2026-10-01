import React, { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Copy, X, CheckCircle } from "lucide-react";
import toast from "react-hot-toast";
import { usePaymentConfig } from "../lib/usePaymentConfig.js";

// Build a UPI deep link that UPI apps understand, embedding the exact amount (spec §6).
const buildUpiLink = ({ upiId, accountName, amount, note }) => {
  const params = new URLSearchParams({
    pa: upiId || "",
    pn: accountName || "Quick AI",
    am: String(amount ?? ""),
    cu: "INR",
    tn: note || "Quick AI payment",
  });
  return `upi://pay?${params.toString()}`;
};

// Shared UPI payment flow used by both credit top-ups and subscriptions (spec §27-28).
// IMPORTANT: no payment record is created when this opens — a record is created only when the
// user submits a UTR via onPay(utr). So browsing/closing the modal records nothing. `amount` is
// shown + embedded in the QR; `onPay(utr)` creates the purchase/payment + submits the UTR.
// This NEVER says "payment successful" — only "awaiting verification" (spec §29).
const UpiPaymentModal = ({ amount, title, subtitle, onPay, onClose }) => {
  const { config } = usePaymentConfig();
  const [utr, setUtr] = useState("");
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const upiId = config?.upiId;
  const upiLink = buildUpiLink({
    upiId,
    accountName: config?.accountName,
    amount,
    note: title,
  });

  const copyUpi = async () => {
    try {
      await navigator.clipboard.writeText(upiId || "");
      toast.success("UPI ID copied.");
    } catch {
      toast.error("Could not copy.");
    }
  };

  const handlePay = async () => {
    if (!/^[A-Za-z0-9]{8,30}$/.test(utr.trim())) {
      return toast.error("Enter the UPI/UTR reference (8-30 letters or digits).");
    }
    try {
      setBusy(true);
      await onPay(utr.trim()); // creates the record ONLY now, then submits it for review
      setSubmitted(true);
    } catch (err) {
      toast.error(err.response?.data?.message || err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-slate-600 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {submitted ? (
          <div className="text-center py-6">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
            <h3 className="mt-3 text-lg font-semibold text-slate-800">Payment submitted</h3>
            <p className="mt-1 text-sm text-gray-500">
              Your payment is being verified. {title} will be activated after an admin confirms it.
            </p>
            <button
              onClick={onClose}
              className="mt-5 w-full py-2.5 rounded-lg text-sm font-medium bg-primary text-white cursor-pointer"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
            {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
            <p className="mt-2 text-2xl font-semibold text-slate-800">₹{amount}</p>

            {config === null ? (
              // Config still loading — show a placeholder, not the "not configured" message,
              // so the QR doesn't flash an alarming error on the first render.
              <div className="mt-4 flex justify-center">
                <div className="w-[200px] h-[200px] bg-gray-100 border border-gray-200 rounded-xl animate-pulse" />
              </div>
            ) : upiId ? (
              <>
                <div className="mt-4 flex justify-center">
                  <div className="p-3 bg-white border border-gray-200 rounded-xl">
                    <QRCodeSVG
                      value={upiLink}
                      size={176}
                      level="M"
                      marginSize={2}
                      bgColor="#ffffff"
                      fgColor="#000000"
                      style={{ display: "block", height: "auto", width: 176 }}
                    />
                  </div>
                </div>

                <p className="mt-4 text-xs text-gray-500">Pay to this UPI ID (GPay / PhonePe / Paytm / BHIM)</p>
                <div className="mt-1 flex items-center justify-between gap-2 border border-gray-200 rounded-lg px-3 py-2">
                  <span className="text-sm font-medium text-slate-700 truncate">{upiId}</span>
                  <button onClick={copyUpi} className="text-gray-400 hover:text-slate-600 cursor-pointer">
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
                <a
                  href={upiLink}
                  className="mt-2 block text-center text-xs text-primary hover:underline"
                >
                  Open a UPI app to pay
                </a>
              </>
            ) : (
              <p className="mt-4 text-sm text-amber-600">
                UPI payments aren't configured yet. Please contact support.
              </p>
            )}

            <div className="mt-5">
              <label className="text-sm text-slate-600">After paying, enter the UTR / transaction ID</label>
              <input
                value={utr}
                onChange={(e) => setUtr(e.target.value)}
                placeholder="e.g. 412345678901"
                className="mt-1 w-full text-sm border border-gray-300 rounded-lg px-3 py-2 outline-none"
              />
              <button
                onClick={handlePay}
                disabled={busy || !upiId}
                className="mt-3 w-full py-2.5 rounded-lg text-sm font-medium bg-primary text-white disabled:opacity-40 cursor-pointer"
              >
                {busy ? "Submitting…" : "I Have Paid"}
              </button>
              <p className="mt-2 text-[11px] text-gray-400 text-center">
                Credits/plan are added only after an admin verifies your payment.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default UpiPaymentModal;
