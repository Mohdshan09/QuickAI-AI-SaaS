import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import toast from "react-hot-toast";
import { useAdminApi, fmtInt, fmtCost, fmtTokens, fmtDate, fmtMs, prettyLabel } from "../../lib/adminApi";
import { Card, SectionTitle, Spinner, Badge, StatusPill } from "../../components/admin/ui";

const PAID_PLAN_KEYS = ["STARTER", "PRO"];

const Row = ({ k, v }) => (
  <div className="flex justify-between py-1.5 border-b border-gray-100 last:border-0 text-sm">
    <span className="text-gray-500">{k}</span>
    <span className="text-slate-700 font-medium text-right">{v}</span>
  </div>
);

const UserDetail = () => {
  const { id } = useParams();
  const api = useAdminApi();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [subPlan, setSubPlan] = useState("STARTER");
  const [subReason, setSubReason] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api
      .getUser(id)
      .then((r) => (r.success ? setData(r) : toast.error(r.message)))
      .catch(() => toast.error("Failed to load user."));
  }, [api, id]);

  useEffect(() => {
    load();
  }, [load]);

  // Controlled, audited subscription action (spec §39). Reason is required by the API.
  const runSubAction = async (action, extra = {}) => {
    if (!subReason.trim()) return toast.error("Enter a reason (required for the audit log).");
    try {
      setBusy(true);
      const res = await api.manageSubscription(id, { action, reason: subReason.trim(), ...extra });
      if (res.success) {
        toast.success(`Subscription ${action} done.`);
        setSubReason("");
        load();
      } else {
        toast.error(res.message || "Action failed.");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.message);
    } finally {
      setBusy(false);
    }
  };

  // Controlled, audited purchase action (spec §35-36). Confirming grants the credits.
  const runPurchaseAction = async (purchaseId, action) => {
    const reason = window.prompt(`Reason for '${action}' (required for the audit log):`);
    if (reason == null) return;
    if (!reason.trim()) return toast.error("A reason is required.");
    try {
      setBusy(true);
      const res = await api.managePurchase(purchaseId, { action, reason: reason.trim() });
      if (res.success) {
        toast.success(`Purchase ${action} done.`);
        load();
      } else {
        toast.error(res.message || "Action failed.");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.message);
    } finally {
      setBusy(false);
    }
  };

  // Controlled, audited UPI payment action (Phase 7, spec §18-19). Confirm applies the benefit.
  const runPaymentAction = async (paymentId, action) => {
    const reason = window.prompt(`Reason for '${action}' (required for the audit log):`);
    if (reason == null) return;
    if (!reason.trim()) return toast.error("A reason is required.");
    try {
      setBusy(true);
      const fn =
        action === "confirm" ? api.confirmPayment : action === "reject" ? api.rejectPayment : api.refundPayment;
      const res = await fn(paymentId, { reason: reason.trim() });
      if (res.success) {
        toast.success(`Payment ${action} done.`);
        load();
      } else {
        toast.error(res.message || "Action failed.");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.message);
    } finally {
      setBusy(false);
    }
  };

  if (!data) return <Spinner />;
  const {
    account, usage, cost, services, recent, plan, entitlements = [], creditBalance,
    subscription, subscriptionHistory = [], purchases = [], payments = [],
  } = data;
  const name = [account.firstName, account.lastName].filter(Boolean).join(" ") || account.email || account.id;

  return (
    <div>
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-slate-700 mb-4">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="flex items-center gap-4 mb-6">
        {account.imageUrl && <img src={account.imageUrl} alt="" className="w-14 h-14 rounded-full" />}
        <div>
          <h1 className="text-xl font-semibold text-slate-800">{name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge tone={account.plan === "premium" ? "purple" : "gray"}>{account.plan}</Badge>
            <Badge tone={account.status === "active" ? "blue" : "amber"}>{account.status}</Badge>
            {account.adminRole && <Badge tone="purple">{prettyLabel(account.adminRole)}</Badge>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-4">
          <SectionTitle>Account</SectionTitle>
          <Row k="User ID" v={<span className="font-mono text-xs">{account.id}</span>} />
          <Row k="Email" v={account.email || "—"} />
          <Row k="Created" v={fmtDate(account.createdAt)} />
          <Row k="Last active" v={fmtDate(account.lastActiveAt)} />
        </Card>

        <Card className="p-4">
          <SectionTitle>AI Usage</SectionTitle>
          <Row k="Total requests" v={fmtInt(usage.totalRequests)} />
          <Row k="Successful" v={fmtInt(usage.successful)} />
          <Row k="Failed" v={fmtInt(usage.failed)} />
          <Row k="Input tokens" v={fmtTokens(usage.inputTokens)} />
          <Row k="Output tokens" v={fmtTokens(usage.outputTokens)} />
          <Row k="Total tokens" v={fmtTokens(usage.totalTokens)} />
        </Card>

        <Card className="p-4">
          <SectionTitle>Cost</SectionTitle>
          <Row k="Total" v={fmtCost(cost.total)} />
          <Row k="This month" v={fmtCost(cost.month)} />
          <Row k="This week" v={fmtCost(cost.week)} />
        </Card>
      </div>

      {/* Phase 4: authoritative application plan + monthly feature usage + credits. */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        <Card className="p-4">
          <SectionTitle>Plan & Credits</SectionTitle>
          <Row k="Plan" v={plan ? `${plan.name} (${plan.key})` : "—"} />
          <Row k="Status" v={plan?.status || "—"} />
          <Row k="Credit balance" v={fmtInt(creditBalance ?? 0)} />
        </Card>

        <Card className="p-4 lg:col-span-2">
          <SectionTitle>Feature Entitlements (this month)</SectionTitle>
          {entitlements.length === 0 ? (
            <p className="text-sm text-gray-400">No entitlements.</p>
          ) : (
            entitlements.map((e) => (
              <div key={e.featureKey} className="flex justify-between items-center py-1.5 text-sm border-b border-gray-100 last:border-0">
                <span className="text-slate-700">{prettyLabel(e.featureKey)}</span>
                <span className="text-gray-500">
                  {!e.enabled ? (
                    <Badge tone="amber">disabled</Badge>
                  ) : e.monthlyLimit == null ? (
                    <Badge tone="blue">credits</Badge>
                  ) : (
                    <span className="tabular-nums">{fmtInt(e.used)} / {fmtInt(e.monthlyLimit)} used</span>
                  )}
                </span>
              </div>
            ))
          )}
        </Card>
      </div>

      {/* Phase 5: subscription state + controlled, audited management (spec §39). */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        <Card className="p-4">
          <SectionTitle>Subscription</SectionTitle>
          {subscription ? (
            <>
              <Row k="Plan" v={subscription.plan ? `${subscription.plan.name} (${subscription.plan.key})` : "—"} />
              <Row k="Status" v={subscription.cancelAtPeriodEnd ? "Cancelling" : subscription.status} />
              <Row k="Renews / ends" v={fmtDate(subscription.currentPeriodEnd)} />
            </>
          ) : (
            <p className="text-sm text-gray-400">No active subscription — user is on FREE.</p>
          )}
        </Card>

        <Card className="p-4 lg:col-span-2">
          <SectionTitle>Manage (audited)</SectionTitle>
          <input
            value={subReason}
            onChange={(e) => setSubReason(e.target.value)}
            placeholder="Reason (required for the audit log)"
            className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 mb-3 outline-none"
          />
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={subPlan}
              onChange={(e) => setSubPlan(e.target.value)}
              className="text-sm border border-gray-300 rounded px-2 py-1.5"
            >
              {PAID_PLAN_KEYS.map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
            {[
              { label: "Activate", action: "activate", extra: () => ({ planKey: subPlan }), need: false },
              { label: "Change (next period)", action: "change", extra: () => ({ planKey: subPlan }), need: true },
              { label: "Change now", action: "change", extra: () => ({ planKey: subPlan, immediate: true }), need: true },
              { label: "Cancel", action: "cancel", extra: () => ({}), need: true },
              { label: "Resume", action: "resume", extra: () => ({}), need: true },
              { label: "Expire", action: "expire", extra: () => ({}), need: true },
            ].map((b) => (
              <button
                key={b.label}
                disabled={busy || (b.need && !subscription)}
                onClick={() => runSubAction(b.action, b.extra())}
                className="text-sm px-3 py-1.5 rounded border border-gray-300 text-slate-600 hover:bg-gray-50 disabled:opacity-40 cursor-pointer"
              >
                {b.label}
              </button>
            ))}
          </div>
        </Card>
      </div>

      {subscriptionHistory.length > 0 && (
        <div className="mt-4">
          <Card className="p-4">
            <SectionTitle>Subscription History</SectionTitle>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 uppercase tracking-wide text-left">
                    <th className="py-2">Plan</th>
                    <th className="py-2">Status</th>
                    <th className="py-2 text-right">Period start</th>
                    <th className="py-2 text-right">Period end</th>
                  </tr>
                </thead>
                <tbody>
                  {subscriptionHistory.map((s, i) => (
                    <tr key={i} className="border-t border-gray-100">
                      <td className="py-2">{s.plan?.name ?? "—"}</td>
                      <td className="py-2">{s.cancelAtPeriodEnd && s.status === "ACTIVE" ? "Cancelling" : s.status}</td>
                      <td className="py-2 text-right text-xs text-gray-500">{fmtDate(s.currentPeriodStart)}</td>
                      <td className="py-2 text-right text-xs text-gray-500">{fmtDate(s.currentPeriodEnd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* Phase 6: top-up purchases + controlled, audited confirm/cancel (spec §35-36). */}
      <div className="mt-4">
        <Card className="p-4">
          <SectionTitle>Credit Purchases</SectionTitle>
          {purchases.length === 0 ? (
            <p className="text-sm text-gray-400">No credit purchases.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 uppercase tracking-wide text-left">
                    <th className="py-2">Pack</th>
                    <th className="py-2 text-right">Credits</th>
                    <th className="py-2 text-right">Amount</th>
                    <th className="py-2">Status</th>
                    <th className="py-2 text-right">Created</th>
                    <th className="py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {purchases.map((p) => (
                    <tr key={p.id} className="border-t border-gray-100">
                      <td className="py-2">{p.pack?.name ?? "—"}</td>
                      <td className="py-2 text-right tabular-nums">{fmtInt(p.credits)}</td>
                      <td className="py-2 text-right tabular-nums">₹{fmtInt(p.amount)}</td>
                      <td className="py-2">
                        <Badge tone={p.status === "CONFIRMED" ? "blue" : p.status === "PENDING" ? "amber" : "gray"}>
                          {p.status}
                        </Badge>
                      </td>
                      <td className="py-2 text-right text-xs text-gray-500">{fmtDate(p.createdAt)}</td>
                      <td className="py-2 text-right">
                        {p.status === "PENDING" ? (
                          <span className="flex justify-end gap-2">
                            <button
                              disabled={busy}
                              onClick={() => runPurchaseAction(p.id, "confirm")}
                              className="text-xs px-2 py-1 rounded border border-gray-300 text-slate-600 hover:bg-gray-50 disabled:opacity-40 cursor-pointer"
                            >
                              Confirm
                            </button>
                            <button
                              disabled={busy}
                              onClick={() => runPurchaseAction(p.id, "cancel")}
                              className="text-xs px-2 py-1 rounded border border-gray-300 text-slate-600 hover:bg-gray-50 disabled:opacity-40 cursor-pointer"
                            >
                              Cancel
                            </button>
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* Phase 7: manual UPI payments + controlled, audited confirm/reject/refund (spec §18-19). */}
      <div className="mt-4">
        <Card className="p-4">
          <SectionTitle>UPI Payments</SectionTitle>
          {payments.length === 0 ? (
            <p className="text-sm text-gray-400">No payments.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 uppercase tracking-wide text-left">
                    <th className="py-2">Purpose</th>
                    <th className="py-2 text-right">Amount</th>
                    <th className="py-2">UTR</th>
                    <th className="py-2">Status</th>
                    <th className="py-2 text-right">Submitted</th>
                    <th className="py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-t border-gray-100">
                      <td className="py-2">
                        {prettyLabel(p.purpose)}
                        {p.purpose === "SUBSCRIPTION" ? ` (${p.referenceId})` : ""}
                      </td>
                      <td className="py-2 text-right tabular-nums">₹{fmtInt(p.amount)}</td>
                      <td className="py-2 font-mono text-xs">{p.utr || "—"}</td>
                      <td className="py-2">
                        <Badge tone={p.status === "CONFIRMED" ? "blue" : p.status === "ADMIN_REVIEW" ? "amber" : "gray"}>
                          {p.status}
                        </Badge>
                      </td>
                      <td className="py-2 text-right text-xs text-gray-500">{p.submittedAt ? fmtDate(p.submittedAt) : "—"}</td>
                      <td className="py-2 text-right">
                        <span className="flex justify-end gap-2">
                          {(p.status === "ADMIN_REVIEW" || p.status === "PENDING") ? (
                            <>
                              <button disabled={busy} onClick={() => runPaymentAction(p.id, "confirm")}
                                className="text-xs px-2 py-1 rounded border border-gray-300 text-slate-600 hover:bg-gray-50 disabled:opacity-40 cursor-pointer">Confirm</button>
                              <button disabled={busy} onClick={() => runPaymentAction(p.id, "reject")}
                                className="text-xs px-2 py-1 rounded border border-gray-300 text-slate-600 hover:bg-gray-50 disabled:opacity-40 cursor-pointer">Reject</button>
                            </>
                          ) : p.status === "CONFIRMED" ? (
                            <button disabled={busy} onClick={() => runPaymentAction(p.id, "refund")}
                              className="text-xs px-2 py-1 rounded border border-gray-300 text-slate-600 hover:bg-gray-50 disabled:opacity-40 cursor-pointer">Refund</button>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        <Card className="p-4">
          <SectionTitle>Service Breakdown</SectionTitle>
          {services.length === 0 ? (
            <p className="text-sm text-gray-400">No AI usage yet.</p>
          ) : (
            services.map((s) => (
              <div key={s.service} className="flex justify-between items-center py-1.5 text-sm border-b border-gray-100 last:border-0">
                <span className="text-slate-700">{prettyLabel(s.service)}</span>
                <span className="text-gray-500">
                  {fmtInt(s.requests)} req · <span className="font-medium text-slate-600">{fmtCost(s.cost)}</span>
                </span>
              </div>
            ))
          )}
        </Card>

        <Card className="p-4 lg:col-span-2">
          <SectionTitle>Recent Requests</SectionTitle>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 uppercase tracking-wide text-left">
                  <th className="py-2">Service</th>
                  <th className="py-2">Status</th>
                  <th className="py-2 text-right">Tokens</th>
                  <th className="py-2 text-right">Cost</th>
                  <th className="py-2 text-right">Latency</th>
                  <th className="py-2 text-right">When</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((r) => (
                  <tr key={r.id} className="border-t border-gray-100">
                    <td className="py-2">
                      <Link to={`/admin/requests/${r.id}`} className="text-[#3c81f6]">{prettyLabel(r.service)}</Link>
                    </td>
                    <td className="py-2"><StatusPill status={r.status} /></td>
                    <td className="py-2 text-right tabular-nums">{fmtTokens(r.total_tokens)}</td>
                    <td className="py-2 text-right tabular-nums">{fmtCost(r.total_cost)}</td>
                    <td className="py-2 text-right tabular-nums">{fmtMs(r.duration_ms)}</td>
                    <td className="py-2 text-right text-xs text-gray-500">{fmtDate(r.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default UserDetail;
