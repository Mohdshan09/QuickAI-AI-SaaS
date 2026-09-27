import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, ExternalLink, Lock, Sparkles, ArrowRight } from "lucide-react";
import toast from "react-hot-toast";
import { useCareerApi, scoreColor } from "../../lib/careerApi";
import { Card, ScoreRing, FactorBar } from "../../components/career/MatchVisuals";

const STATUSES = ["saved", "applied", "interviewing", "offer", "rejected"];

const MatchTab = ({ match, history, hasResumes, onOpenReport }) => {
  const c = scoreColor(match?.score ?? null);

  if (!hasResumes) {
    return (
      <Card className="text-center py-10">
        <p className="text-sm text-gray-500">Upload a resume first to check your match.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-wrap items-center gap-5">
          <ScoreRing score={match?.score ?? null} size={112} />
          <div className="flex-1 min-w-[240px] space-y-3">
            <div>
              <p className={`text-sm font-medium ${c.text}`}>{c.label}</p>
              <p className="text-sm text-slate-600 mt-0.5">
                {match
                  ? match.summary
                  : "Check how well your resume matches this job. You'll get an explained score — matched, partial and missing skills, your experience gap and a skill-gap plan."}
              </p>
              {match && history.length > 1 && (
                <p className="text-xs text-gray-500 mt-1">
                  Progress: {history.map((h) => h.score).join(" → ")}
                </p>
              )}
            </div>
            <button
              onClick={onOpenReport}
              className="flex items-center gap-2 bg-gradient-to-r from-[#226bff] to-[#65adff] text-white px-4 py-1.5 rounded-lg text-sm w-fit"
            >
              {match ? "View full report" : "Check my match"}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </Card>

      {match && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold">Score breakdown</h3>
            <button
              onClick={onOpenReport}
              className="flex items-center gap-1 text-sm text-[#4a7aff] hover:underline"
            >
              Full explanation <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="grid sm:grid-cols-2 gap-x-8 gap-y-4">
            <FactorBar label="Required skills" value={match.breakdown.required} />
            <FactorBar label="Nice-to-have" value={match.breakdown.nice} />
            <FactorBar label="Experience fit" value={match.breakdown.experience} />
            <FactorBar label="Role relevance" value={match.breakdown.relevance} />
          </div>
          <div className="flex flex-wrap gap-4 mt-4 text-xs">
            <span className="text-green-700">✓ {(match.matched || []).length} matched</span>
            <span className="text-amber-600">△ {(match.partial || []).length} partial</span>
            <span className="text-red-500">? {(match.missing || []).length} missing</span>
          </div>
        </Card>
      )}
    </div>
  );
};

const LockedTab = ({ name }) => (
  <Card className="flex flex-col items-center justify-center text-center py-12 text-gray-500">
    <Lock className="w-8 h-8 mb-2 text-gray-400" />
    <p className="text-sm">{name} is coming soon.</p>
  </Card>
);

const TABS = ["Match", "Tailored resume", "Cover letter", "Interview prep", "Posting"];

const JobDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const api = useCareerApi();

  const [job, setJob] = useState(null);
  const [outputs, setOutputs] = useState({});
  const [history, setHistory] = useState([]);
  const [hasResumes, setHasResumes] = useState(false);
  const [tab, setTab] = useState("Match");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const [jobData, resumeData] = await Promise.all([api.getJob(id), api.listResumes()]);
      if (jobData.success) {
        setJob(jobData.job);
        setOutputs(jobData.outputs);
        setHistory(jobData.scoreHistory || []);
      } else {
        toast.error(jobData.message);
        navigate("/ai/jobs");
        return;
      }
      if (resumeData.success) setHasResumes(resumeData.resumes.length > 0);
    } catch (err) {
      toast.error(err.response?.data?.message || err.message);
      navigate("/ai/jobs");
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const match = useMemo(() => outputs.match?.data ?? null, [outputs]);

  const changeStatus = async (status) => {
    const prev = job.status;
    setJob((j) => ({ ...j, status }));
    try {
      const data = await api.updateJob(id, { status });
      if (!data.success) throw new Error(data.message);
    } catch (err) {
      setJob((j) => ({ ...j, status: prev }));
      toast.error(err.response?.data?.message || err.message);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <span className="w-10 h-10 rounded-full border-3 border-[#4a7aff] border-t-transparent animate-spin" />
      </div>
    );
  }
  if (!job) return null;

  return (
    <div className="h-full overflow-y-scroll p-6 text-slate-700">
      <div className="max-w-5xl">
        <button
          onClick={() => navigate("/ai/jobs")}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-slate-700 mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> All jobs
        </button>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">{job.role}</h1>
            <p className="text-sm text-gray-500">{job.company}</p>
            {job.url && (
              <a
                href={job.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-[#4a7aff] hover:underline mt-1"
              >
                View posting <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
          <select
            value={job.status}
            onChange={(e) => changeStatus(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm capitalize outline-none"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-1 border-b border-gray-200 mt-5 mb-5 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-2 text-sm whitespace-nowrap border-b-2 -mb-px transition ${
                tab === t
                  ? "border-[#4a7aff] text-[#4a7aff] font-medium"
                  : "border-transparent text-gray-500 hover:text-slate-700"
              }`}
            >
              {t === "Match" && <Sparkles className="w-3.5 h-3.5 inline mr-1" />}
              {t}
            </button>
          ))}
        </div>

        {tab === "Match" && (
          <MatchTab
            match={match}
            history={history}
            hasResumes={hasResumes}
            onOpenReport={() => navigate(`/ai/jobs/${id}/match`)}
          />
        )}
        {tab === "Tailored resume" && <LockedTab name="Tailored resume" />}
        {tab === "Cover letter" && <LockedTab name="Cover letter" />}
        {tab === "Interview prep" && <LockedTab name="Interview prep" />}
        {tab === "Posting" && (
          <Card>
            <pre className="text-sm text-slate-600 whitespace-pre-wrap font-sans">
              {job.description}
            </pre>
          </Card>
        )}
      </div>
    </div>
  );
};

export default JobDetail;
