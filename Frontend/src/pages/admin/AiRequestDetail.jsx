import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import toast from "react-hot-toast";
import { useAdminApi, fmtCost, fmtInt, fmtDate, fmtMs, prettyLabel } from "../../lib/adminApi";
import { Card, SectionTitle, Spinner, StatusPill } from "../../components/admin/ui";

const Row = ({ k, v }) => (
  <div className="flex justify-between py-1.5 border-b border-gray-100 last:border-0 text-sm">
    <span className="text-gray-500">{k}</span>
    <span className="text-slate-700 font-medium text-right break-all">{v}</span>
  </div>
);

const AiRequestDetail = () => {
  const { id } = useParams();
  const api = useAdminApi();
  const navigate = useNavigate();
  const [r, setR] = useState(null);

  useEffect(() => {
    api
      .getRequest(id)
      .then((res) => (res.success ? setR(res.request) : toast.error(res.message)))
      .catch(() => toast.error("Failed to load request."));
  }, [api, id]);

  if (!r) return <Spinner />;

  return (
    <div>
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-slate-700 mb-4">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-lg font-semibold text-slate-800 font-mono">{r.id}</h1>
        <StatusPill status={r.status} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-4">
          <SectionTitle>Request Information</SectionTitle>
          <Row k="User" v={<Link to={`/admin/users/${r.user_id}`} className="text-[#3c81f6]">{r.email || r.user_id}</Link>} />
          <Row k="Service" v={prettyLabel(r.service)} />
          <Row k="Started" v={fmtDate(r.started_at)} />
          <Row k="Completed" v={fmtDate(r.completed_at)} />
          <Row k="Duration" v={fmtMs(r.duration_ms)} />
        </Card>

        <Card className="p-4">
          <SectionTitle>AI Information</SectionTitle>
          <Row k="Provider" v={r.provider} />
          <Row k="Model" v={r.model || "—"} />
          <Row k="Prompt version" v={r.prompt_version || "—"} />
          <Row k="Analysis version" v={r.analysis_version || "—"} />
          <Row k="Schema version" v={r.schema_version || "—"} />
        </Card>

        <Card className="p-4">
          <SectionTitle>Tokens</SectionTitle>
          <Row k="Input tokens" v={fmtInt(r.input_tokens)} />
          <Row k="Output tokens" v={fmtInt(r.output_tokens)} />
          <Row k="Total tokens" v={fmtInt(r.total_tokens)} />
        </Card>

        <Card className="p-4">
          <SectionTitle>Cost</SectionTitle>
          <Row k="Input cost" v={fmtCost(r.input_cost)} />
          <Row k="Output cost" v={fmtCost(r.output_cost)} />
          <Row k="Total cost" v={fmtCost(r.total_cost)} />
          <Row k="Price snapshot" v={`${fmtCost(r.input_price)} / ${fmtCost(r.output_price)} per 1M`} />
        </Card>

        {r.status === "error" && (
          <Card className="p-4 lg:col-span-2 border-red-200">
            <SectionTitle>Error</SectionTitle>
            <Row k="Error code" v={r.error_code || "—"} />
            <Row k="Message" v={r.error_message || "—"} />
          </Card>
        )}

        {(r.resume_id || r.job_id) && (
          <Card className="p-4 lg:col-span-2">
            <SectionTitle>Correlation</SectionTitle>
            {r.resume_id && <Row k="Resume ID" v={r.resume_id} />}
            {r.job_id && <Row k="Job ID" v={r.job_id} />}
          </Card>
        )}
      </div>
    </div>
  );
};

export default AiRequestDetail;
