import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { useAdminApi, fmtInt, fmtCost, fmtTokens, fmtDay, prettyLabel } from "../../lib/adminApi";
import { Card, SectionTitle, Spinner, PageHeader } from "../../components/admin/ui";

const DIMS = [
  { key: "day", label: "By Day" },
  { key: "service", label: "By Service" },
  { key: "user", label: "By User" },
  { key: "model", label: "By Model" },
  { key: "provider", label: "By Provider" },
];

const Costs = () => {
  const api = useAdminApi();
  const [by, setBy] = useState("day");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .getCosts({ by, range: "30d" })
      .then((r) => (r.success ? setData(r) : toast.error(r.message)))
      .catch(() => toast.error("Failed to load cost analytics."))
      .finally(() => setLoading(false));
  }, [api, by]);

  const rows = data?.rows || [];
  const chartData = rows.map((r) => ({
    ...r,
    name: by === "day" ? fmtDay(r.label) : prettyLabel(String(r.label ?? r.key)),
  }));

  return (
    <div>
      <PageHeader
        title="Cost Analytics"
        subtitle="AI cost breakdown over the last 30 days."
        right={
          <div className="flex flex-wrap gap-1 bg-white border border-gray-200 rounded-lg p-1">
            {DIMS.map((d) => (
              <button
                key={d.key}
                onClick={() => setBy(d.key)}
                className={`px-3 py-1 text-xs rounded-md ${
                  by === d.key ? "bg-gradient-to-r from-[#3c81f6] to-[#9234EA] text-white" : "text-gray-500"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        }
      />

      {loading ? (
        <Spinner />
      ) : (
        <>
          <Card className="p-4 mb-4">
            <SectionTitle>Cost {DIMS.find((d) => d.key === by)?.label.toLowerCase()}</SectionTitle>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, stroke: "#94a3b8" }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 11, stroke: "#94a3b8" }} tickFormatter={(v) => `$${v.toFixed(2)}`} />
                  <Tooltip formatter={(v) => fmtCost(v)} />
                  <Bar dataKey="cost" fill="#9234EA" radius={[3, 3, 0, 0]} name="Cost" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/60 text-xs text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-3 text-left">{by === "day" ? "Day" : prettyLabel(by)}</th>
                  <th className="px-4 py-3 text-right">Requests</th>
                  <th className="px-4 py-3 text-right">Tokens</th>
                  <th className="px-4 py-3 text-right">Cost</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-b border-gray-100 last:border-0">
                    <td className="px-4 py-3 text-slate-700">
                      {by === "user" && r.key ? (
                        <Link to={`/admin/users/${r.key}`} className="text-[#3c81f6]">{r.label || r.key}</Link>
                      ) : by === "day" ? (
                        fmtDay(r.label)
                      ) : (
                        prettyLabel(String(r.label ?? r.key))
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{fmtInt(r.requests)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{fmtTokens(r.tokens)}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium">{fmtCost(r.cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

export default Costs;
