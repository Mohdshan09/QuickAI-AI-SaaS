import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import toast from "react-hot-toast";
import { useAdminApi, fmtInt, fmtCost, fmtTokens, fmtDate } from "../../lib/adminApi";
import DataTable from "../../components/admin/DataTable";
import { PageHeader, Badge } from "../../components/admin/ui";

const Users = () => {
  const api = useAdminApi();
  const navigate = useNavigate();
  const [q, setQ] = useState({ page: 1, sort: "cost", order: "desc", search: "", status: "", plan: "" });
  const [search, setSearch] = useState("");
  const [data, setData] = useState({ rows: [], total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);

  // Debounce the search box into the query.
  useEffect(() => {
    const t = setTimeout(() => setQ((p) => ({ ...p, search, page: 1 })), 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setLoading(true);
    api
      .listUsers({ ...q, limit: 25 })
      .then((r) => (r.success ? setData(r) : toast.error(r.message)))
      .catch(() => toast.error("Failed to load users."))
      .finally(() => setLoading(false));
  }, [api, q]);

  const columns = [
    {
      key: "email",
      label: "User",
      sortable: true,
      render: (u) => (
        <div>
          <p className="font-medium text-slate-700">{u.email || "—"}</p>
          <p className="text-xs text-gray-400 font-mono">{u.id}</p>
        </div>
      ),
    },
    { key: "plan", label: "Plan", sortable: true, render: (u) => <Badge tone={u.plan === "premium" ? "purple" : "gray"}>{u.plan}</Badge> },
    { key: "status", label: "Status", sortable: true, render: (u) => <Badge tone={u.status === "active" ? "blue" : "amber"}>{u.status}</Badge> },
    { key: "requests", label: "Requests", sortable: true, align: "right", render: (u) => fmtInt(u.requests) },
    { key: "tokens", label: "Tokens", sortable: true, align: "right", render: (u) => fmtTokens(u.tokens) },
    { key: "cost", label: "Cost", sortable: true, align: "right", render: (u) => <span className="font-medium">{fmtCost(u.cost)}</span> },
    { key: "last_active", label: "Last Active", sortable: true, align: "right", render: (u) => <span className="text-xs text-gray-500">{fmtDate(u.last_active_at)}</span> },
  ];

  const Select = ({ value, onChange, options, placeholder }) => (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-slate-600"
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  );

  return (
    <div>
      <PageHeader title="Users" subtitle="Everyone on the platform, with their AI usage and cost." />

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email or user ID…"
            className="w-full text-sm border border-gray-200 rounded-lg pl-9 pr-3 py-2 bg-white"
          />
        </div>
        <Select value={q.status} onChange={(v) => setQ((p) => ({ ...p, status: v, page: 1 }))} options={["active", "suspended"]} placeholder="All statuses" />
        <Select value={q.plan} onChange={(v) => setQ((p) => ({ ...p, plan: v, page: 1 }))} options={["free", "premium"]} placeholder="All plans" />
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
        onRowClick={(u) => navigate(`/admin/users/${u.id}`)}
      />
    </div>
  );
};

export default Users;
