import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useAdminApi, fmtInt, fmtDate, prettyLabel } from "../../lib/adminApi";
import { Spinner, PageHeader } from "../../components/admin/ui";

const GROUPS = [
  { key: "error_code", label: "Error type" },
  { key: "service", label: "Service" },
  { key: "model", label: "Model" },
];

const Errors = () => {
  const api = useAdminApi();
  const [groupBy, setGroupBy] = useState("error_code");
  const [rows, setRows] = useState(null);

  useEffect(() => {
    setRows(null);
    api
      .getErrors({ groupBy, range: "30d" })
      .then((r) => (r.success ? setRows(r.errors) : toast.error(r.message)))
      .catch(() => toast.error("Failed to load errors."));
  }, [api, groupBy]);

  const th = "px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide";

  return (
    <div>
      <PageHeader
        title="Failed AI Requests"
        subtitle="Errors over the last 30 days."
        right={
          <div className="flex gap-1 bg-white border border-gray-200 rounded-lg p-1">
            {GROUPS.map((g) => (
              <button
                key={g.key}
                onClick={() => setGroupBy(g.key)}
                className={`px-3 py-1 text-xs rounded-md ${
                  groupBy === g.key ? "bg-gradient-to-r from-[#3c81f6] to-[#9234EA] text-white" : "text-gray-500"
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
        }
      />

      {!rows ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <div className="py-16 text-center text-sm text-gray-400">No failed requests in this window. 🎉</div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/60">
                <th className={`${th} text-left`}>{GROUPS.find((g) => g.key === groupBy)?.label}</th>
                <th className={`${th} text-right`}>Count</th>
                <th className={`${th} text-right`}>Affected Users</th>
                <th className={`${th} text-right`}>Last Occurrence</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e, i) => (
                <tr key={i} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-3 font-medium text-slate-700">{prettyLabel(e.group_key)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-red-600 font-medium">{fmtInt(e.count)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{fmtInt(e.affected_users)}</td>
                  <td className="px-4 py-3 text-right text-xs text-gray-500">{fmtDate(e.last_occurrence)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Errors;
