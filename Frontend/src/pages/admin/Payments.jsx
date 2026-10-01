import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useAdminApi, fmtInt, fmtDate, prettyLabel } from "../../lib/adminApi";
import { Card, PageHeader, Spinner, Badge } from "../../components/admin/ui";

// Admin UPI payment dashboard + verification (Phase 7, spec §23-24). List payments with
// filters; confirm applies the benefit (credits/subscription), reject/refund are recorded.
// Every action is audited server-side and requires a reason.
const STATUSES = ["", "ADMIN_REVIEW", "PENDING", "CONFIRMED", "REJECTED", "REFUNDED"];
const PURPOSES = ["", "CREDIT_TOPUP", "SUBSCRIPTION"];

const statusTone = (s) =>
  s === "CONFIRMED" ? "blue" : s === "ADMIN_REVIEW" ? "amber" : s === "REJECTED" ? "gray" : "gray";

const Payments = () => {
  const api = useAdminApi();
  const [payments, setPayments] = useState(null);
  const [status, setStatus] = useState("ADMIN_REVIEW");
  const [purpose, setPurpose] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api
      .listPayments({ status: status || undefined, purpose: purpose || undefined })
      .then((r) => (r.success ? setPayments(r.payments) : toast.error(r.message)))
      .catch(() => toast.error("Failed to load payments."));
  }, [api, status, purpose]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (id, action) => {
    const reason = window.prompt(`Reason for '${action}' (required for the audit log):`);
    if (reason == null) return;
    if (!reason.trim()) return toast.error("A reason is required.");
    try {
      setBusy(true);
      const fn =
        action === "confirm" ? api.confirmPayment : action === "reject" ? api.rejectPayment : api.refundPayment;
      const res = await fn(id, { reason: reason.trim() });
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

  return (
    <div>
      <PageHeader title="Payments" subtitle="Verify manual UPI payments. Confirm applies credits or activates the plan." />

      <Card className="p-4 mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm text-gray-500">Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)}
            className="text-sm border border-gray-300 rounded px-2 py-1.5">
            {STATUSES.map((s) => <option key={s} value={s}>{s === "" ? "All" : prettyLabel(s)}</option>)}
          </select>
          <label className="text-sm text-gray-500 ml-2">Purpose</label>
          <select value={purpose} onChange={(e) => setPurpose(e.target.value)}
            className="text-sm border border-gray-300 rounded px-2 py-1.5">
            {PURPOSES.map((p) => <option key={p} value={p}>{p === "" ? "All" : prettyLabel(p)}</option>)}
          </select>
        </div>
      </Card>

      {!payments ? (
        <Spinner />
      ) : (
        <Card className="p-4">
          {payments.length === 0 ? (
            <p className="text-sm text-gray-400">No payments match these filters.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 uppercase tracking-wide text-left">
                    <th className="py-2">User</th>
                    <th className="py-2">Purpose</th>
                    <th className="py-2 text-right">Amount</th>
                    <th className="py-2">UTR</th>
                    <th className="py-2 text-right">Submitted</th>
                    <th className="py-2">Status</th>
                    <th className="py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-t border-gray-100">
                      <td className="py-2 font-mono text-xs">{p.userId}</td>
                      <td className="py-2">{prettyLabel(p.purpose)}{p.purpose === "SUBSCRIPTION" ? ` (${p.referenceId})` : ""}</td>
                      <td className="py-2 text-right tabular-nums">₹{fmtInt(p.amount)}</td>
                      <td className="py-2 font-mono text-xs">{p.utr || "—"}</td>
                      <td className="py-2 text-right text-xs text-gray-500">{p.submittedAt ? fmtDate(p.submittedAt) : "—"}</td>
                      <td className="py-2"><Badge tone={statusTone(p.status)}>{p.status}</Badge></td>
                      <td className="py-2 text-right">
                        <span className="flex justify-end gap-2">
                          {(p.status === "ADMIN_REVIEW" || p.status === "PENDING") && (
                            <>
                              <button disabled={busy} onClick={() => act(p.id, "confirm")}
                                className="text-xs px-2 py-1 rounded border border-gray-300 text-slate-600 hover:bg-gray-50 disabled:opacity-40 cursor-pointer">Confirm</button>
                              <button disabled={busy} onClick={() => act(p.id, "reject")}
                                className="text-xs px-2 py-1 rounded border border-gray-300 text-slate-600 hover:bg-gray-50 disabled:opacity-40 cursor-pointer">Reject</button>
                            </>
                          )}
                          {p.status === "CONFIRMED" && (
                            <button disabled={busy} onClick={() => act(p.id, "refund")}
                              className="text-xs px-2 py-1 rounded border border-gray-300 text-slate-600 hover:bg-gray-50 disabled:opacity-40 cursor-pointer">Refund</button>
                          )}
                          {p.status !== "ADMIN_REVIEW" && p.status !== "PENDING" && p.status !== "CONFIRMED" && (
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
      )}
    </div>
  );
};

export default Payments;
