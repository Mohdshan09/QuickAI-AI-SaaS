import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useAdminApi, fmtInt, fmtCost, fmtTokens, fmtPct, fmtMs, prettyLabel } from "../../lib/adminApi";
import { Spinner, PageHeader } from "../../components/admin/ui";

const Services = () => {
  const api = useAdminApi();
  const [rows, setRows] = useState(null);

  useEffect(() => {
    api
      .getServices()
      .then((r) => (r.success ? setRows(r.services) : toast.error(r.message)))
      .catch(() => toast.error("Failed to load services."));
  }, [api]);

  if (!rows) return <Spinner />;

  const th = "px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide";
  const td = "px-4 py-3 text-slate-700 tabular-nums";

  return (
    <div>
      <PageHeader title="AI Services" subtitle="Usage, tokens and cost broken down by feature." />
      <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50/60">
              <th className={`${th} text-left`}>Service</th>
              <th className={`${th} text-right`}>Requests</th>
              <th className={`${th} text-right`}>Success</th>
              <th className={`${th} text-right`}>Users</th>
              <th className={`${th} text-right`}>Input</th>
              <th className={`${th} text-right`}>Output</th>
              <th className={`${th} text-right`}>Total Tokens</th>
              <th className={`${th} text-right`}>Cost</th>
              <th className={`${th} text-right`}>Avg/Req</th>
              <th className={`${th} text-right`}>Avg Latency</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.service} className="border-b border-gray-100 last:border-0">
                <td className="px-4 py-3 font-medium text-slate-700">{prettyLabel(s.service)}</td>
                <td className={`${td} text-right`}>{fmtInt(s.requests)}</td>
                <td className={`${td} text-right`}>{fmtPct(s.requests ? s.successful / s.requests : 0)}</td>
                <td className={`${td} text-right`}>{fmtInt(s.users)}</td>
                <td className={`${td} text-right`}>{fmtTokens(s.inputTokens)}</td>
                <td className={`${td} text-right`}>{fmtTokens(s.outputTokens)}</td>
                <td className={`${td} text-right`}>{fmtTokens(s.totalTokens)}</td>
                <td className={`${td} text-right font-medium`}>{fmtCost(s.cost)}</td>
                <td className={`${td} text-right`}>{fmtCost(s.avgCostPerRequest)}</td>
                <td className={`${td} text-right`}>{fmtMs(s.avgLatencyMs)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Services;
