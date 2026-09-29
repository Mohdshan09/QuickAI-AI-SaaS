import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useAdminApi, fmtInt, fmtCost, fmtTokens, fmtPct, fmtMs } from "../../lib/adminApi";
import { Spinner, PageHeader, Badge } from "../../components/admin/ui";

const Models = () => {
  const api = useAdminApi();
  const [rows, setRows] = useState(null);

  useEffect(() => {
    api
      .getModels()
      .then((r) => (r.success ? setRows(r.models) : toast.error(r.message)))
      .catch(() => toast.error("Failed to load models."));
  }, [api]);

  if (!rows) return <Spinner />;

  const th = "px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide";
  const td = "px-4 py-3 text-slate-700 tabular-nums";

  return (
    <div>
      <PageHeader title="AI Models" subtitle="Usage and cost by provider and model." />
      <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50/60">
              <th className={`${th} text-left`}>Provider</th>
              <th className={`${th} text-left`}>Model</th>
              <th className={`${th} text-right`}>Requests</th>
              <th className={`${th} text-right`}>Success</th>
              <th className={`${th} text-right`}>Total Tokens</th>
              <th className={`${th} text-right`}>Cost</th>
              <th className={`${th} text-right`}>Avg/Req</th>
              <th className={`${th} text-right`}>Avg Latency</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m, i) => (
              <tr key={`${m.provider}-${m.model}-${i}`} className="border-b border-gray-100 last:border-0">
                <td className="px-4 py-3"><Badge tone="blue">{m.provider}</Badge></td>
                <td className="px-4 py-3 font-medium text-slate-700">{m.model || "—"}</td>
                <td className={`${td} text-right`}>{fmtInt(m.requests)}</td>
                <td className={`${td} text-right`}>{fmtPct(m.requests ? m.successful / m.requests : 0)}</td>
                <td className={`${td} text-right`}>{fmtTokens(m.totalTokens)}</td>
                <td className={`${td} text-right font-medium`}>{fmtCost(m.cost)}</td>
                <td className={`${td} text-right`}>{fmtCost(m.avgCostPerRequest)}</td>
                <td className={`${td} text-right`}>{fmtMs(m.avgLatencyMs)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Models;
