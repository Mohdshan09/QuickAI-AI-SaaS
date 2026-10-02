import React, { useEffect, useState } from "react";
import {
  Coins,
  FileText,
  Gem,
  Hash,
  Image,
  Layers,
  Sparkles,
  SquarePen,
} from "lucide-react";
import CreationItem from "../components/CreationItem";
import { useAuth } from "@clerk/clerk-react";
import toast from "react-hot-toast";
import axios from "axios";
import { useEntitlements } from "../lib/useEntitlements.js";
import { useCredits } from "../lib/useCredits.js";
import { useSubscription } from "../lib/useSubscription.js";
import { useCreditHistory } from "../lib/useCreditHistory.js";
import { usePayments } from "../lib/usePayments.js";
import BuyCredits from "../components/BuyCredits.jsx";

axios.defaults.baseURL = import.meta.env.VITE_BASE_URL;

const PREVIEW_COUNT = 3;

// snake_case feature key -> "Title Case" label for display.
const featureLabel = (key) =>
  key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString() : "");

const CATEGORIES = [
  { type: "article", label: "Articles", Icon: SquarePen, color: "from-[#226BFF] to-[#65ADFF]" },
  { type: "blog-title", label: "Blog Titles", Icon: Hash, color: "from-[#C341F6] to-[#8E37EB]" },
  { type: "image", label: "Images", Icon: Image, color: "from-[#20C363] to-[#11B97E]" },
  { type: "resume-review", label: "Resume Reviews", Icon: FileText, color: "from-[#12B7AC] to-[#08B6CE]" },
];

const OTHER_CATEGORY = { label: "Other", Icon: Layers, color: "from-[#64748B] to-[#94A3B8]" };

// Payment status → user-facing label + colour. Never says "successful" before confirmation.
const PAYMENT_LABEL = {
  PENDING: "Not paid",
  ADMIN_REVIEW: "Awaiting verification",
  CONFIRMED: "Confirmed",
  REJECTED: "Rejected",
  REFUNDED: "Refunded",
};
const PAYMENT_TONE = {
  ADMIN_REVIEW: "text-amber-600",
  CONFIRMED: "text-green-600",
  REJECTED: "text-red-500",
};

// Placeholder card shown while data is loading, so the layout doesn't jump (no blank-then-pop).
const SkeletonCard = () => (
  <div className="w-72 p-4 px-6 bg-white rounded-xl border border-gray-200 animate-pulse">
    <div className="h-3 w-24 bg-gray-200 rounded" />
    <div className="mt-3 h-5 w-16 bg-gray-200 rounded" />
  </div>
);

const CategorySection = ({ category, items }) => {
  const [showAll, setShowAll] = useState(false);
  const { label, Icon, color } = category;
  const visible = showAll ? items : items.slice(0, PREVIEW_COUNT);
  const hiddenCount = items.length - PREVIEW_COUNT;

  return (
    <section className="max-w-5xl">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${color} flex justify-center items-center`}>
          <Icon className="w-4 text-white" />
        </div>
        <h2 className="font-semibold text-slate-700">{label}</h2>
        <span className="text-xs text-gray-500 bg-white border border-gray-200 px-2 py-0.5 rounded-full">
          {items.length}
        </span>
      </div>

      {visible.map((item) => (
        <CreationItem key={item.id} item={item} />
      ))}

      {hiddenCount > 0 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="text-sm text-[#4a7aff] hover:underline"
        >
          {showAll ? "Show less" : `Show ${hiddenCount} more`}
        </button>
      )}
    </section>
  );
};

const Dashboard = () => {
  const [creations, setCreations] = useState([]);
  const [loading, setLoading] = useState(true);

  //Token
  const { getToken } = useAuth();

  // Authoritative plan + monthly usage from the backend (display-only).
  const { plan, features, loading: entLoading } = useEntitlements();
  // Live credit wallet balance (display-only; backend is authoritative).
  const { balance: creditBalance, refresh: refreshCredits } = useCredits();
  // Current subscription + the only user actions in Phase 5: cancel / resume renewal.
  const { subscription, cancel, resume } = useSubscription();
  // Recent credit ledger activity across all sources (purchases, grants, usage) — spec §32.
  const { transactions, refresh: refreshHistory } = useCreditHistory({ limit: 8 });
  // UPI payment history (Phase 7, spec §26). Hide PENDING (never-submitted) rows from the user.
  const { payments, refresh: refreshPayments } = usePayments();
  const submittedPayments = payments.filter((p) => p.status !== "PENDING");

  const onCancel = async () => {
    try {
      await cancel();
      toast.success("Renewal cancelled. Your plan stays active until the period ends.");
    } catch (err) {
      toast.error(err.response?.data?.message || err.message);
    }
  };
  const onResume = async () => {
    try {
      await resume();
      toast.success("Renewal resumed.");
    } catch (err) {
      toast.error(err.response?.data?.message || err.message);
    }
  };

  const getDashboardData = async () => {
    try {
      const { data } = await axios.get("/api/user/get-user-creations", {
        headers: { Authorization: `Bearer ${await getToken()}` },
      });

      if (data.success) {
        setCreations(data.creations);
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error(error.message);
    }

    setLoading(false);
  };

  useEffect(() => {
    getDashboardData();
  }, []);

  // Group creations by type, newest first within each category
  const sorted = [...creations].sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  );
  const knownTypes = CATEGORIES.map((c) => c.type);
  const groups = [
    ...CATEGORIES.map((category) => ({
      category,
      items: sorted.filter((item) => item.content_type === category.type),
    })),
    {
      category: OTHER_CATEGORY,
      items: sorted.filter((item) => !knownTypes.includes(item.content_type)),
    },
  ].filter((group) => group.items.length > 0);

  const usageFeatures = features
    ? Object.entries(features).filter(([, f]) => f.monthlyLimit != null)
    : [];
  const creditFeatures = features
    ? Object.entries(features).filter(([, f]) => f.monthlyLimit == null && f.creditCost != null)
    : [];

  return (
    <div className="h-full overflow-y-scroll p-6">
      {/* Discreet top-up action, top-right (Phase 6/7). Opens the pack picker on demand. */}
      <div className="flex justify-end mb-4">
        <BuyCredits onPaid={() => { refreshPayments(); refreshHistory(); refreshCredits(); }} />
      </div>

      <div className="flex justify-start gap-4 flex-wrap">
        {/* Total Creation Card */}
        <div className="flex justify-between items-center w-72 p-4 px-6 bg-white rounded-xl border border-gray-200">
          <div className="text-slate-600">
            <p className="text-sm">Total Creations</p>
            <h2 className="text-xl font-semibold">{creations.length}</h2>
          </div>
          <div className="w-10 h-10 rounded-lg  bg-gradient-to-br from-[#3588F2] to-[#0BB0D7] text-white flex justify-center items-center">
            <Sparkles className="w-5 text-white " />
          </div>
        </div>

        {/* Active Plan Name */}

        <div className="flex justify-between items-center w-72 p-4 px-6 bg-white rounded-xl border border-gray-200">
          <div className="text-slate-600">
            <p className="text-sm">Active Plan</p>
            <h2 className="text-xl font-semibold">
              {plan?.name ? plan.name : entLoading ? "…" : "Free"}
            </h2>
          </div>
          <div className="w-10 h-10 rounded-lg  bg-gradient-to-br from-[#FF61C5] to-[#9E53EE] text-white flex justify-center items-center">
            <Gem className="w-5 text-white " />
          </div>
        </div>

        {/* Credit balance — the live wallet balance (top-ups land here). */}
        <div className="flex justify-between items-center w-72 p-4 px-6 bg-white rounded-xl border border-gray-200">
          <div className="text-slate-600">
            <p className="text-sm">Credits</p>
            <h2 className="text-xl font-semibold">
              {creditBalance == null ? "…" : creditBalance}
            </h2>
          </div>
          <div className="w-10 h-10 rounded-lg  bg-gradient-to-br from-[#F59E0B] to-[#F97316] text-white flex justify-center items-center">
            <Coins className="w-5 text-white " />
          </div>
        </div>
      </div>

      {/* Subscription status + cancel/resume (active paid subscription only; spec §38) */}
      {subscription && (
        <div className="mt-6 max-w-xl p-4 px-6 bg-white rounded-xl border border-gray-200">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="text-slate-600">
              <p className="text-sm">
                {subscription.cancelAtPeriodEnd
                  ? `Your ${subscription.plan?.name} plan remains active until ${fmtDate(subscription.currentPeriodEnd)}.`
                  : `${subscription.plan?.name} plan — renews ${fmtDate(subscription.currentPeriodEnd)}.`}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                Status: {subscription.cancelAtPeriodEnd ? "Cancelling" : subscription.status}
              </p>
            </div>
            {subscription.cancelAtPeriodEnd ? (
              <button
                onClick={onResume}
                className="text-sm px-4 py-2 rounded-lg bg-primary text-white cursor-pointer"
              >
                Resume renewal
              </button>
            ) : (
              <button
                onClick={onCancel}
                className="text-sm px-4 py-2 rounded-lg border border-gray-300 text-slate-600 cursor-pointer"
              >
                Cancel plan
              </button>
            )}
          </div>
        </div>
      )}

      {/* This month's usage (from the backend; display-only). Skeletons while loading so the
          section reserves its space instead of popping in after the fetch. */}
      {(entLoading || features) && (
        <div className="mt-6">
          <h2 className="font-semibold text-slate-700 mb-3">This month's usage</h2>
          <div className="flex justify-start gap-4 flex-wrap">
            {!features
              ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
              : null}
            {usageFeatures.map(([key, f]) => (
              <div
                key={key}
                className="w-72 p-4 px-6 bg-white rounded-xl border border-gray-200 text-slate-600"
              >
                <p className="text-sm">{featureLabel(key)}</p>
                <h2 className="text-xl font-semibold">
                  {f.used} / {f.monthlyLimit}{" "}
                  <span className="text-sm font-normal text-gray-400">used</span>
                </h2>
              </div>
            ))}
            {creditFeatures.map(([key, f]) => (
              <div
                key={key}
                className="w-72 p-4 px-6 bg-white rounded-xl border border-gray-200 text-slate-600"
              >
                <p className="text-sm">{featureLabel(key)}</p>
                <h2 className="text-xl font-semibold">
                  {f.creditCost}{" "}
                  <span className="text-sm font-normal text-gray-400">credits</span>
                </h2>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* UPI payment history (Phase 7, spec §26). Status reflects admin verification, not the UI.
          PENDING = user opened the modal but never submitted a UTR — not a real payment, so it's
          hidden from the user's history. */}
      {submittedPayments.length > 0 && (
        <div className="mt-8 max-w-3xl">
          <h2 className="font-semibold text-slate-700 mb-3">Payments</h2>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {submittedPayments.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between px-5 py-3 border-b border-gray-100 last:border-0 text-sm"
              >
                <div>
                  <span className="text-slate-700">
                    {p.purpose === "CREDIT_TOPUP" ? "Credit top-up" : "Subscription"}
                  </span>
                  {p.status === "REJECTED" && p.adminNote && (
                    <p className="text-xs text-red-500 mt-0.5">Rejected: {p.adminNote}</p>
                  )}
                </div>
                <div className="flex items-center gap-6">
                  <span className="font-semibold tabular-nums text-slate-700">₹{p.amount}</span>
                  <span className={`text-xs w-28 text-right ${PAYMENT_TONE[p.status] || "text-gray-400"}`}>
                    {PAYMENT_LABEL[p.status] || p.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Credit history — every source in one place (purchases, grants, usage); spec §32. */}
      {transactions.length > 0 && (
        <div className="mt-8 max-w-3xl">
          <h2 className="font-semibold text-slate-700 mb-3">Credit History</h2>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {transactions.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between px-5 py-3 border-b border-gray-100 last:border-0 text-sm"
              >
                <span className="text-slate-700">{featureLabel(t.type)}</span>
                <div className="flex items-center gap-6">
                  <span
                    className={`font-semibold tabular-nums ${
                      t.amount >= 0 ? "text-green-600" : "text-slate-500"
                    }`}
                  >
                    {t.amount >= 0 ? `+${t.amount}` : t.amount}
                  </span>
                  <span className="text-xs text-gray-400 w-28 text-right">
                    {fmtDate(t.createdAt)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center h-3/4">
          <span className="w-11 h-11 my-1 rounded-full border-3 border-purple-500 border-t-transparent animate-spin"></span>
        </div>
      ) : (
        <div className="mt-8 space-y-8">
          {groups.length === 0 ? (
            <p className="text-sm text-gray-500">
              No creations yet. Pick a tool from the sidebar to get started.
            </p>
          ) : (
            groups.map(({ category, items }) => (
              <CategorySection key={category.label} category={category} items={items} />
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default Dashboard;
