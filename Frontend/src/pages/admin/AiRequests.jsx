import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useAdminApi, fmtCost, fmtTokens, fmtDate, fmtMs, prettyLabel } from "../../lib/adminApi";
import DataTable from "../../components/admin/DataTable";
import { PageHeader, StatusPill } from "../../components/admin/ui";

const SERVICES = [
  "RESUME_PARSING", "JD_ANALYSIS", "MATCH_ANALYSIS", "RESUME_OPTIMIZATION",
  "RESUME_REVIEW", "ARTICLE", "BLOG_TITLE", "IMAGE_GENERATION", "IMAGE_EDIT", "OTHER",
];

const AiRequests = () => {
  const api = useAdminApi();
  const navigate = useNavigate();
  const [q, setQ] = useState({ page: 1, sort: "created_at", order: "desc", service: "", status: "" });
  const [data, setData] = useState({ rows: [], total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .listRequests({ ...q, limit: 25 })
      .then((r) => (r.success ? setData(r) : toast.error(r.message)))
      .catch(() => toast.error("Failed to load requests."))
      .finally(() => setLoading(false));
  }, [api, q]);

  const columns = [
    { key: "id", label: "Request", render: (r) => <span className="font-mono text-xs text-[#3c81f6]">{String(r.id).slice(0, 8)}</span> },
    { key: "email", label: "User", render: (r) => <span className="text-slate-600">{r.email || r.user_id}</span> },
    { key: "service", label: "Service", render: (r) => prettyLabel(r.service) },
    { key: "model", label: "Model", render: (r) => <span className="text-xs text-gray-500">{r.model || "—"}</span> },
    { key: "status", label: "Status", render: (r) => <StatusPill status={r.status} /> },
    { key: "tokens", label: "Tokens", sortable: true, align: "right", render: (r) => fmtTokens(r.total_tokens) },
    { key: "cost", label: "Cost", sortable: true, align: "right", render: (r) => fmtCost(r.total_cost) },
    { key: "duration", label: "Latency", sortable: true, align: "right", render: (r) => fmtMs(r.duration_ms) },
    { key: "created_at", label: "When", sortable: true, align: "right", render: (r) => <span className="text-xs text-gray-500">{fmtDate(r.created_at)}</span> },
  ];

  const Select = ({ value, onChange, options, placeholder }) => (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-slate-600">
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>
      ))}
    </select>
  );

  return (
    <div>
      <PageHeader title="AI Requests" subtitle="Every AI operation, newest first." />

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Select
          value={q.service}
          onChange={(v) => setQ((p) => ({ ...p, service: v, page: 1 }))}
          options={SERVICES.map((s) => ({ value: s, label: prettyLabel(s) }))}
          placeholder="All services"
        />
        <Select
          value={q.status}
          onChange={(v) => setQ((p) => ({ ...p, status: v, page: 1 }))}
          options={["success", "error"]}
          placeholder="All statuses"
        />
      </div>

      <DataTable
        columns={columns}
        rows={data.rows}
        loading={loading}
        sort={q.sort}
        order={q.order}
        onSort={(sort, order) => setQ((p) => ({ ...p, sort, order }))}
        page={data.page || q.page}
        pages={data.pages}
        total={data.total}
        onPage={(page) => setQ((p) => ({ ...p, page }))}
        onRowClick={(r) => navigate(`/admin/requests/${r.id}`)}
      />
    </div>
  );
};

export default AiRequests;
