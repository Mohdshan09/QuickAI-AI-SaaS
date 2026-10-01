import React, { useState } from "react";
import { Check } from "lucide-react";
import toast from "react-hot-toast";
import { usePlans } from "../lib/usePlans.js";
import { useSubscription } from "../lib/useSubscription.js";
import { usePayments } from "../lib/usePayments.js";
import UpiPaymentModal from "./UpiPaymentModal.jsx";
import { useUser } from "@clerk/clerk-react";

// Included-feature bullets shown on every plan card (access is the same across plans;
// paid tiers differ by monthly credits + higher usage limits). Kept presentational —
// the authoritative values (price, credits) come from GET /api/plans (spec §4, §41).
const FEATURES = [
  "Match Analysis & Resume Optimization",
  "Article & Blog title generation",
  "Image generation & editing",
  "Resume review",
];

const Plans = () => {
  const { plans, loading } = usePlans();
  const { user } = useUser();
  // Only logged-in users have a subscription to compare against; guard the hook's fetch.
  const { subscription } = useSubscription();
  const { createPayment, submitPayment } = usePayments();
  const currentKey = user ? subscription?.plan?.key || "FREE" : null;

  const [active, setActive] = useState(null); // the plan the modal is open for

  // Subscribing opens the UPI modal (spec §12, §28). No payment record is created yet — only when
  // the user actually submits a UTR (below), so just browsing records nothing. The plan does NOT
  // activate until an admin confirms the payment (spec §29).
  const subscribe = (plan) => setActive(plan);

  // Called on "I Have Paid": create the subscription payment, then submit the UTR for review.
  const payForPlan = async (utr) => {
    const payment = await createPayment("SUBSCRIPTION", active.key);
    await submitPayment(payment.id, { utr });
  };

  return (
    <div id="plans" className="max-w-5xl mx-auto z-20 my-30 px-4">
      <div className="text-center">
        <h2 className="text-slate-700 text-[42px] font-semibold">Choose Your Plan</h2>
        <p className="text-gray-500 max-w-lg mx-auto">
          Start for free and scale up as you grow. Find the perfect plan for your
          content creating needs.
        </p>
      </div>

      <div className="mt-14 flex flex-wrap justify-center items-stretch gap-6">
        {/* Skeleton cards while /api/plans loads, so pricing doesn't pop in after a blank gap. */}
        {loading && plans.length === 0 &&
          Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="w-full max-w-xs flex flex-col p-6 rounded-2xl bg-white border border-gray-200 shadow-sm animate-pulse"
            >
              <div className="h-5 w-24 bg-gray-200 rounded" />
              <div className="mt-4 h-8 w-20 bg-gray-200 rounded" />
              <div className="mt-3 h-4 w-32 bg-gray-200 rounded" />
              <div className="mt-6 space-y-2 flex-1">
                {Array.from({ length: 4 }).map((__, j) => (
                  <div key={j} className="h-3 w-full bg-gray-100 rounded" />
                ))}
              </div>
              <div className="mt-6 h-10 w-full bg-gray-200 rounded-lg" />
            </div>
          ))}
        {plans.map((plan) => {
          const isCurrent = plan.key === currentKey;
          const isPaid = plan.price > 0;
          return (
            <div
              key={plan.key}
              className={`w-full max-w-xs flex flex-col p-6 rounded-2xl bg-white border transition ${
                isCurrent ? "border-primary shadow-lg" : "border-gray-200 shadow-sm"
              }`}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-700">{plan.name}</h3>
                {isCurrent && (
                  <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                    Current plan
                  </span>
                )}
              </div>

              <div className="mt-4">
                <span className="text-3xl font-semibold text-slate-800">
                  {plan.price === 0 ? "Free" : `₹${plan.price}`}
                </span>
                {isPaid && <span className="text-sm text-gray-500"> / month</span>}
              </div>

              <p className="mt-3 text-sm font-medium text-slate-600">
                {plan.monthlyCredits} AI credits / month
              </p>

              <ul className="mt-4 space-y-2 flex-1">
                {FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
                    <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    {f}
                  </li>
                ))}
                {isPaid && (
                  <li className="flex items-start gap-2 text-sm text-gray-600">
                    <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    Higher monthly usage limits
                  </li>
                )}
              </ul>

              {/* Paid plans are purchased via UPI (spec §28); FREE and the current plan are inert. */}
              <button
                onClick={() => user && isPaid && !isCurrent && subscribe(plan)}
                disabled={!user || !isPaid || isCurrent}
                className={`mt-6 w-full py-2.5 rounded-lg text-sm font-medium ${
                  !isPaid || isCurrent
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "bg-primary text-white cursor-pointer disabled:opacity-40"
                }`}
              >
                {isCurrent
                  ? "Your current plan"
                  : !isPaid
                  ? "Free plan"
                  : !user
                  ? "Sign in to subscribe"
                  : "Subscribe with UPI"}
              </button>
            </div>
          );
        })}
      </div>

      {active && (
        <UpiPaymentModal
          amount={active.price}
          title={`${active.name} plan`}
          subtitle={`₹${active.price}/month · ${active.monthlyCredits} credits`}
          onPay={payForPlan}
          onClose={() => setActive(null)}
        />
      )}
    </div>
  );
};

export default Plans;
