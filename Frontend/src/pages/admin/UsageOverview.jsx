import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { useAdminApi, fmtInt, fmtCost, fmtTokens, fmtDay } from "../../lib/adminApi";
import KpiCard from "../../components/admin/KpiCard";
import { Card, SectionTitle, Spinner, PageHeader } from "../../components/admin/ui";

const RANGES = [
  { key: "today", label: "Today" },
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "90d", label: "90 days" },
];

const RangeTabs = ({ range, setRange }) => (
  <div className="flex gap-1 bg-white border border-gray-200 rounded-lg p-1">
    {RANGES.map((r) => (
      <button
        key={r.key}
        onClick={() => setRange(r.key)}
        className={`px-3 py-1 text-xs rounded-md ${
          range === r.key ? "bg-gradient-to-r from-[#3c81f6] to-[#9234EA] text-white" : "text-gray-500"
        }`}
      >
        {r.label}
      </button>
    ))}
  </div>
);

const ChartCard = ({ title, children }) => (
  <Card className="p-4">
    <SectionTitle>{title}</SectionTitle>
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  </Card>
);

const axis = { fontSize: 11, stroke: "#94a3b8" };

const UsageOverview = () => {
  const api = useAdminApi();
  const [range, setRange] = useState("30d");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .getUsageOverview({ range })
      .then((r) => (r.success ? setData(r) : toast.error(r.message)))
      .catch(() => toast.error("Failed to load usage overview."))
      .finally(() => setLoading(false));
  }, [api, range]);

  const series = (data?.series || []).map((d) => ({ ...d, label: fmtDay(d.day) }));
  const au = data?.activeUsers || {};

  return (
    <div>
      <PageHeader
        title="Usage Overview"
        subtitle="AI requests, tokens and cost over time."
        right={<RangeTabs range={range} setRange={setRange} />}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <KpiCard label="Daily Active Users" value={fmtInt(au.dau)} />
        <KpiCard label="Weekly Active Users" value={fmtInt(au.wau)} />
        <KpiCard label="Monthly Active Users" value={fmtInt(au.mau)} />
      </div>

      {loading ? (
        <Spinner />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard title="AI Requests / day">
            <AreaChart data={series}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
              <XAxis dataKey="label" tick={axis} />
              <YAxis tick={axis} allowDecimals={false} />
              <Tooltip />
              <Area type="monotone" dataKey="successful" stackId="1" stroke="#3c81f6" fill="#3c81f6" fillOpacity={0.25} name="Successful" />
              <Area type="monotone" dataKey="failed" stackId="1" stroke="#ef4444" fill="#ef4444" fillOpacity={0.3} name="Failed" />
            </AreaChart>
          </ChartCard>

          <ChartCard title="Tokens / day">
            <BarChart data={series}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
              <XAxis dataKey="label" tick={axis} />
              <YAxis tick={axis} tickFormatter={fmtTokens} />
              <Tooltip formatter={(v) => fmtTokens(v)} />
              <Bar dataKey="inputTokens" stackId="t" fill="#9234EA" name="Input" />
              <Bar dataKey="outputTokens" stackId="t" fill="#c084fc" name="Output" />
            </BarChart>
          </ChartCard>

          <ChartCard title="Cost / day">
            <AreaChart data={series}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
              <XAxis dataKey="label" tick={axis} />
              <YAxis tick={axis} tickFormatter={(v) => `$${v.toFixed(2)}`} />
              <Tooltip formatter={(v) => fmtCost(v)} />
              <Area type="monotone" dataKey="cost" stroke="#16a34a" fill="#16a34a" fillOpacity={0.2} name="Cost" />
            </AreaChart>
          </ChartCard>

          <ChartCard title="Active users / day">
            <BarChart data={series}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
              <XAxis dataKey="label" tick={axis} />
              <YAxis tick={axis} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="activeUsers" fill="#3c81f6" name="Active users" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ChartCard>
        </div>
      )}
    </div>
  );
};

export default UsageOverview;
