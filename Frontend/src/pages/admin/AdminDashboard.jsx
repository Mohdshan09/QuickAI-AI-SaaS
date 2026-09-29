import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Users, Activity, DollarSign, CheckCircle2 } from "lucide-react";
import toast from "react-hot-toast";
import {
  useAdminApi,
  fmtInt,
  fmtCost,
  fmtTokens,
  fmtPct,
  prettyLabel,
} from "../../lib/adminApi";
import KpiCard from "../../components/admin/KpiCard";
import { Card, SectionTitle, Spinner, PageHeader } from "../../components/admin/ui";

const MiniTable = ({ head, rows }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-sm">
      <thead>
        <tr className="text-xs text-gray-400 uppercase tracking-wide">
          {head.map((h, i) => (
            <th key={h} className={`py-2 font-medium ${i === 0 ? "text-left" : "text-right"}`}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{rows}</tbody>
    </table>
  </div>
);

const AdminDashboard = () => {
  const api = useAdminApi();
  const [data, setData] = useState(null);

  useEffect(() => {
    api
      .getDashboard()
      .then((r) => (r.success ? setData(r) : toast.error(r.message)))
      .catch(() => toast.error("Failed to load dashboard."));
  }, [api]);

  if (!data) return <Spinner />;
  const { kpis, top } = data;

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Platform-wide usage, cost and reliability at a glance." />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Users"
          value={fmtInt(kpis.users.total)}
          Icon={Users}
          sub={[
            ["Active (30d)", fmtInt(kpis.users.active)],
            ["New this week", fmtInt(kpis.users.newWeek)],
            ["Suspended", fmtInt(kpis.users.suspended)],
          ]}
        />
        <KpiCard
          label="AI Requests"
          value={fmtInt(kpis.usage.totalRequests)}
          Icon={Activity}
          sub={[
            ["Successful", fmtInt(kpis.usage.successful)],
            ["Failed", fmtInt(kpis.usage.failed)],
            ["Total tokens", fmtTokens(kpis.usage.totalTokens)],
          ]}
        />
        <KpiCard
          label="AI Cost"
          value={fmtCost(kpis.cost.total)}
          accent="text-[#9234EA]"
          Icon={DollarSign}
          sub={[
            ["Today", fmtCost(kpis.cost.today)],
            ["This month", fmtCost(kpis.cost.month)],
            ["Avg / request", fmtCost(kpis.cost.avgPerRequest)],
          ]}
        />
        <KpiCard
          label="Success Rate"
          value={fmtPct(kpis.usage.successRate)}
          accent="text-green-600"
          Icon={CheckCircle2}
          sub={[
            ["Avg tokens / req", fmtInt(Math.round(kpis.usage.avgTokensPerRequest))],
            ["Avg cost / user", fmtCost(kpis.cost.avgPerUser)],
            ["Premium users", fmtInt(kpis.users.premium)],
          ]}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
        <Card className="p-4">
          <SectionTitle right={<Link to="/admin/users" className="text-xs text-[#3c81f6]">View all</Link>}>
            Top Users by Cost
          </SectionTitle>
          <MiniTable
            head={["User", "Requests", "Tokens", "Cost"]}
            rows={top.usersByCost.map((u) => (
              <tr key={u.user_id} className="border-t border-gray-100">
                <td className="py-2 text-left">
                  <Link to={`/admin/users/${u.user_id}`} className="text-slate-700 hover:text-[#3c81f6]">
                    {u.email || u.user_id}
                  </Link>
                </td>
                <td className="py-2 text-right tabular-nums">{fmtInt(u.requests)}</td>
                <td className="py-2 text-right tabular-nums">{fmtTokens(u.tokens)}</td>
                <td className="py-2 text-right tabular-nums font-medium">{fmtCost(u.cost)}</td>
              </tr>
            ))}
          />
        </Card>

        <Card className="p-4">
          <SectionTitle right={<Link to="/admin/services" className="text-xs text-[#3c81f6]">View all</Link>}>
            Top Services by Cost
          </SectionTitle>
          <MiniTable
            head={["Service", "Requests", "Tokens", "Cost"]}
            rows={top.servicesByCost.map((s) => (
              <tr key={s.service} className="border-t border-gray-100">
                <td className="py-2 text-left">{prettyLabel(s.service)}</td>
                <td className="py-2 text-right tabular-nums">{fmtInt(s.requests)}</td>
                <td className="py-2 text-right tabular-nums">{fmtTokens(s.tokens)}</td>
                <td className="py-2 text-right tabular-nums font-medium">{fmtCost(s.cost)}</td>
              </tr>
            ))}
          />
        </Card>
      </div>

      <Card className="p-4 mt-4">
        <SectionTitle right={<Link to="/admin/requests" className="text-xs text-[#3c81f6]">View all</Link>}>
          Most Expensive Requests
        </SectionTitle>
        <MiniTable
          head={["Request", "User", "Service", "Tokens", "Cost"]}
          rows={top.expensiveRequests.map((r) => (
            <tr key={r.id} className="border-t border-gray-100">
              <td className="py-2 text-left">
                <Link to={`/admin/requests/${r.id}`} className="font-mono text-xs text-[#3c81f6]">
                  {String(r.id).slice(0, 8)}
                </Link>
              </td>
              <td className="py-2 text-right tabular-nums">{r.email || r.user_id}</td>
              <td className="py-2 text-right">{prettyLabel(r.service)}</td>
              <td className="py-2 text-right tabular-nums">{fmtTokens(r.total_tokens)}</td>
              <td className="py-2 text-right tabular-nums font-medium">{fmtCost(r.total_cost)}</td>
            </tr>
          ))}
        />
      </Card>
    </div>
  );
};

export default AdminDashboard;
