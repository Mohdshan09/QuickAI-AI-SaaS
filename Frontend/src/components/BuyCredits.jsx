import React, { useState } from "react";
import axios from "axios";
import { useAuth } from "@clerk/clerk-react";
import { Coins, Plus, X } from "lucide-react";
import toast from "react-hot-toast";
import { useCreditPacks } from "../lib/useCreditPacks.js";
import { usePayments } from "../lib/usePayments.js";
import UpiPaymentModal from "./UpiPaymentModal.jsx";

axios.defaults.baseURL = import.meta.env.VITE_BASE_URL;

// One-time credit top-ups (spec §11, §27). Kept unobtrusive: a small "Buy credits" button that
// opens a pack picker, rather than a storefront grid on the dashboard. Prices/credits come from
// GET /api/credits/packs (backend is authoritative — spec §7). Nothing is recorded until the
// user submits a UTR; credits are granted only after an admin confirms (spec §29).
const BuyCredits = ({ onPaid }) => {
  const { getToken } = useAuth();
  const { packs } = useCreditPacks();
  const { createPayment, submitPayment } = usePayments();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [active, setActive] = useState(null); // the pack being paid for

  if (!packs.length) return null;

  const choose = (pack) => {
    setPickerOpen(false);
    setActive(pack);
  };

  // Called on "I Have Paid": create the purchase, its UPI payment, then submit the UTR.
  const payForPack = async (utr) => {
    const token = await getToken();
    const res = await axios.post(
      "/api/credits/purchases",
      { packKey: active.key },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const purchase = res.data?.purchase;
    if (!purchase) throw new Error(res.data?.message || "Could not start the purchase.");
    const payment = await createPayment("CREDIT_TOPUP", purchase.id);
    await submitPayment(payment.id, { utr });
  };

  return (
    <>
      <button
        onClick={() => setPickerOpen(true)}
        className="inline-flex items-center gap-1.5 text-sm text-slate-600 border border-gray-300 rounded-lg px-3 py-1.5 hover:bg-gray-50 cursor-pointer"
      >
        <Plus className="w-4 h-4" /> Buy credits
      </button>

      {/* Pack picker (opened only on demand). */}
      {pickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm bg-white rounded-2xl p-6 relative">
            <button
              onClick={() => setPickerOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-semibold text-slate-800">Buy credits</h3>
            <p className="text-sm text-gray-500">
              Credits are one shared balance for AI career tools — Match Score costs 2 credits,
              Tailored Resume 3. They're not per-feature and never expire. (Articles, images and
              other generic tools use your monthly plan limits, not credits.)
            </p>

            <div className="mt-4 space-y-2">
              {packs.map((pack) => (
                <button
                  key={pack.key}
                  onClick={() => choose(pack)}
                  className="w-full flex items-center justify-between gap-3 border border-gray-200 rounded-xl px-4 py-3 hover:border-primary hover:bg-primary/5 transition cursor-pointer text-left"
                >
                  <span className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#FF61C5] to-[#9E53EE] text-white flex justify-center items-center">
                      <Coins className="w-4" />
                    </span>
                    <span>
                      <span className="block text-sm font-medium text-slate-700">{pack.credits} credits</span>
                      <span className="block text-xs text-gray-400">
                        ≈ {Math.floor(pack.credits / 2)} Match Scores or {Math.floor(pack.credits / 3)} Tailored Resumes
                      </span>
                    </span>
                  </span>
                  <span className="text-base font-semibold text-slate-800">₹{pack.price}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {active && (
        <UpiPaymentModal
          amount={active.price}
          title={`${active.credits} credits`}
          subtitle="One-time credit top-up"
          onPay={payForPack}
          onClose={() => {
            setActive(null);
            onPaid?.();
          }}
        />
      )}
    </>
  );
};

export default BuyCredits;
