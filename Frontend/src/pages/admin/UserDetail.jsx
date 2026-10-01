import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import toast from "react-hot-toast";
import { useAdminApi, fmtInt, fmtCost, fmtTokens, fmtDate, fmtMs, prettyLabel } from "../../lib/adminApi";
import { Card, SectionTitle, Spinner, Badge, StatusPill } from "../../components/admin/ui";

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

  useEffect(() => {
    api
      .getUser(id)
      .then((r) => (r.success ? setData(r) : toast.error(r.message)))
      .catch(() => toast.error("Failed to load user."));
  }, [api, id]);

  if (!data) return <Spinner />;
  const { account, usage, cost, services, recent, plan, entitlements = [], creditBalance } = data;
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
