import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  Copy,
  Check,
  Minus,
  HelpCircle,
  TrendingUp,
  Sparkles,
  Lightbulb,
  Target,
  RefreshCw,
} from "lucide-react";
import toast from "react-hot-toast";
import { useCareerApi, scoreColor } from "../../lib/careerApi";
import { useCredits, AI_ACTION_COSTS, isInsufficientCredits } from "../../lib/useCredits";
import { Card, ScoreRing, FactorBar } from "../../components/career/MatchVisuals";

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString() : "");

const SkillGroup = ({ title, Icon, tone, items, hint }) => (
  <div>
    <div className={`flex items-center gap-1.5 text-sm font-medium ${tone.head}`}>
      <Icon className="w-4 h-4" /> {title}
      <span className="text-xs text-gray-400 font-normal">({items.length})</span>
    </div>
    <p className="text-xs text-gray-400 mt-0.5">{hint}</p>
    {items.length === 0 ? (
      <p className="text-xs text-gray-400 mt-2">—</p>
    ) : (
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {items.map((k) => (
          <span
            key={k}
            className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border ${tone.chip}`}
          >
            <Icon className="w-3 h-3 shrink-0" />
            {k}
          </span>
        ))}
      </div>
    )}
  </div>
);

const Badge = ({ children, className }) => (
  <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${className}`}>{children}</span>
);

const PRIORITY_STYLE = {
  High: "bg-red-50 text-red-600",
  Medium: "bg-amber-50 text-amber-700",
  Low: "bg-gray-100 text-gray-500",
};
const TYPE_STYLE = {
  resume: "bg-[#EEF4FF] text-[#4a7aff]",
  skill: "bg-purple-50 text-purple-600",
};
const TYPE_LABEL = { resume: "Resume change", skill: "Skill building" };

const PlanItem = ({ item, done, onToggle }) => (
  <label className="flex gap-3 border border-gray-100 rounded-lg p-3 bg-gray-50/60 cursor-pointer hover:border-gray-200 transition">
    <input
      type="checkbox"
      checked={done}
      onChange={onToggle}
      className="mt-0.5 w-4 h-4 accent-[#4a7aff] shrink-0"
    />
    <div className="flex-1 min-w-0">
      <div className="flex items-start justify-between gap-2">
        <p className={`text-sm font-medium ${done ? "line-through text-gray-400" : "text-slate-700"}`}>
          {item.title}
        </p>
        <div className="flex items-center gap-1.5 shrink-0">
          <Badge className={PRIORITY_STYLE[item.priority]}>{item.priority}</Badge>
          <Badge className={TYPE_STYLE[item.type]}>{TYPE_LABEL[item.type]}</Badge>
        </div>
      </div>
      <p className="text-xs text-gray-500 mt-1.5">
        <span className="font-medium text-slate-600">Why: </span>
        {item.why}
      </p>
      <p className="text-xs text-slate-600 mt-1 flex items-start gap-1.5">
        <Lightbulb className="w-3.5 h-3.5 text-[#4a7aff] mt-0.5 shrink-0" />
        <span>
          <span className="font-medium">Do: </span>
          {item.what}
        </span>
      </p>
      <p className="text-[11px] text-gray-400 mt-1.5">Related requirement: {item.requirement}</p>
    </div>
  </label>
);

const MatchReport = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const api = useCareerApi();
  const { balance, refresh: refreshCredits } = useCredits();

  const [job, setJob] = useState(null);
  const [resumes, setResumes] = useState([]);
  const [resumeId, setResumeId] = useState("");
  const [match, setMatch] = useState(null);
  const [progress, setProgress] = useState({});
  const [analyzedAt, setAnalyzedAt] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false); // loading a saved report
  const [running, setRunning] = useState(false); // generating a new one
  const [confirming, setConfirming] = useState(false); // re-analyze confirm step
  const [limitReached, setLimitReached] = useState(false);

  // Load the job + resumes once.
  useEffect(() => {
    (async () => {
      try {
        const [jobData, resumeData] = await Promise.all([api.getJob(id), api.listResumes()]);
        if (!jobData.success) {
          toast.error(jobData.message);
          navigate("/ai/jobs");
          return;
        }
        setJob(jobData.job);
        setHistory(jobData.scoreHistory || []);
        if (resumeData.success) {
          setResumes(resumeData.resumes);
          const preselect = Number(params.get("resumeId"));
          setResumeId(
            preselect > 0
              ? preselect
              : jobData.job.resume_id || resumeData.resumes[0]?.id || ""
          );
        }
      } catch (err) {
        toast.error(err.response?.data?.message || err.message);
        navigate("/ai/jobs");
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Whenever the selected resume changes, load its SAVED report — no AI call.
  useEffect(() => {
    if (!resumeId) {
      setMatch(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setChecking(true);
        const data = await api.getMatch(id, resumeId);
        if (cancelled) return;
        setMatch(data.match);
        setProgress(data.match?.progress || {});
        setAnalyzedAt(data.analyzedAt);
        setHistory(data.history || []);
      } catch (err) {
        if (!cancelled) toast.error(err.response?.data?.message || err.message);
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeId]);

  const c = scoreColor(match?.score ?? null);

  const runMatch = async (force = false) => {
    if (!resumeId) return;
    setConfirming(false);
    try {
      setRunning(true);
      const data = await api.runMatch(id, resumeId, force);
      if (data.success) {
        setMatch(data.match);
        setProgress(data.match.progress || {});
        setAnalyzedAt(data.analyzedAt);
        setHistory(data.history);
        toast.success(`Match: ${data.match.score}%`);
        refreshCredits(); // pull the authoritative balance after the charge
      } else {
        toast.error(data.message);
      }
    } catch (err) {
      if (isInsufficientCredits(err)) {
        const { required, available } = err.response.data;
        setLimitReached(true);
        toast.error(
          required != null
            ? `Not enough credits: this uses ${required}, you have ${available}.`
            : "You do not have enough credits for this action."
        );
      } else {
        toast.error(err.response?.data?.message || err.message);
      }
    } finally {
      setRunning(false);
    }
  };

  const togglePlan = async (itemId) => {
    const next = !progress[itemId];
    setProgress((p) => ({ ...p, [itemId]: next }));
    try {
      const data = await api.setMatchProgress(id, resumeId, itemId, next);
      if (data.success) setProgress(data.progress);
    } catch (err) {
      setProgress((p) => ({ ...p, [itemId]: !next })); // revert on failure
      toast.error(err.response?.data?.message || err.message);
    }
  };

  const share = () => {
    if (!match) return;
    navigator.clipboard.writeText(
      `My resume matches ${job.role} at ${job.company} ${match.score}% — via QuickAI`
    );
    toast.success("Copied to clipboard");
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <span className="w-10 h-10 rounded-full border-3 border-[#4a7aff] border-t-transparent animate-spin" />
      </div>
    );
  }
  if (!job) return null;

  const ex = match?.explanations || {};
  const plan = match?.plan || [];
  const doneCount = plan.filter((i) => progress[i.id]).length;

  return (
    <div className="h-full overflow-y-scroll p-6 text-slate-700">
      <div className="max-w-5xl">
        <button
          onClick={() => navigate(`/ai/jobs/${id}`)}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-slate-700 mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> Back to job
        </button>

        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-5 h-5 text-[#4a7aff]" />
          <h1 className="text-xl font-semibold">Match report</h1>
        </div>
        <p className="text-sm text-gray-500 mb-5">
          {job.role} · {job.company}
        </p>

        {/* Hero: score + summary + resume picker */}
        <Card>
          <div className="flex flex-wrap items-center gap-6">
            <ScoreRing score={match?.score ?? null} size={128} />
            <div className="flex-1 min-w-[240px] space-y-3">
              <div>
                <p className={`text-sm font-semibold ${c.text}`}>{c.label}</p>
                <p className="text-sm text-slate-600 mt-0.5">
                  {match
                    ? match.summary
                    : checking
                    ? "Loading saved report…"
                    : "This resume hasn't been analyzed for this job yet. Run one check to get a full, explained breakdown."}
                </p>
                {match && history.length > 1 && (
                  <p className="flex items-center gap-1 text-xs text-gray-500 mt-1.5">
                    <TrendingUp className="w-3.5 h-3.5" /> Progress:{" "}
                    {history.map((h) => h.score).join(" → ")}
                  </p>
                )}
              </div>

              {resumes.length === 0 ? (
                <p className="text-sm text-gray-500">Upload a resume first to check your match.</p>
              ) : limitReached ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                  <p className="text-sm text-amber-700">
                    Not enough credits to run a match
                    {balance != null ? ` (you have ${balance}, this uses ${AI_ACTION_COSTS.match})` : ""}.{" "}
                    <button
                      onClick={() => setLimitReached(false)}
                      className="font-medium text-[#4a7aff] hover:underline"
                    >
                      Dismiss
                    </button>
                  </p>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={resumeId}
                    onChange={(e) => setResumeId(Number(e.target.value))}
                    className="border border-gray-300 rounded-md px-3 py-1.5 text-sm outline-none"
                  >
                    {resumes.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.title}
                      </option>
                    ))}
                  </select>

                  {match ? (
                    <>
                      <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                        <Check className="w-3.5 h-3.5 text-green-600" /> Saved result
                        {analyzedAt ? ` · ${fmtDate(analyzedAt)}` : ""}
                      </span>
                      <button
                        onClick={share}
                        className="flex items-center gap-1 text-sm text-[#4a7aff] hover:underline"
                      >
                        <Copy className="w-3.5 h-3.5" /> Share
                      </button>
                      {confirming ? (
                        <span className="inline-flex items-center gap-2 text-xs">
                          <span className="text-gray-500">Runs a new check · uses {AI_ACTION_COSTS.match} credits.</span>
                          <button
                            onClick={() => runMatch(true)}
                            disabled={running}
                            className="font-medium text-[#4a7aff] hover:underline disabled:opacity-60"
                          >
                            Re-analyze
                          </button>
                          <button
                            onClick={() => setConfirming(false)}
                            className="text-gray-400 hover:underline"
                          >
                            Cancel
                          </button>
                        </span>
                      ) : (
                        <button
                          onClick={() => setConfirming(true)}
                          disabled={running}
                          className="flex items-center gap-1 text-sm text-gray-500 hover:text-[#4a7aff] disabled:opacity-60"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${running ? "animate-spin" : ""}`} />
                          Re-analyze
                        </button>
                      )}
                    </>
                  ) : (
                    !checking && (
                      <span className="inline-flex items-center gap-2">
                        {balance != null && (
                          <span className="text-xs text-gray-500">Balance: {balance} credits</span>
                        )}
                        <button
                          onClick={() => runMatch(false)}
                          disabled={running || !resumeId}
                          className="flex items-center gap-2 bg-gradient-to-r from-[#226bff] to-[#65adff] text-white px-4 py-1.5 rounded-lg text-sm disabled:opacity-60"
                        >
                          {running && (
                            <span className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent animate-spin" />
                          )}
                          {running ? "Checking…" : `Check my match · ${AI_ACTION_COSTS.match} credits`}
                        </button>
                      </span>
                    )
                  )}
                </div>
              )}

              <p className="text-xs text-gray-400">
                To improve your score, upload an updated resume and check it — each version keeps its
                own saved report so you can compare.
              </p>
            </div>
          </div>
          {running && (
            <p className="text-sm text-gray-500 animate-pulse mt-4">
              Reading the job posting… comparing your resume… (about 5–10 seconds)
            </p>
          )}
        </Card>

        {!match ? null : (
          <div className="mt-5 space-y-5">
            {/* Personalized improvement plan — the actionable, trackable centerpiece */}
            <Card>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-[#4a7aff]" />
                  <h2 className="text-sm font-semibold">Your improvement plan</h2>
                </div>
                {plan.length > 0 && (
                  <span className="text-xs text-gray-500">
                    {doneCount} of {plan.length} done
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 mb-4">
                Work top-down — high-priority steps move your match the most.
              </p>
              {plan.length > 0 ? (
                <>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-4">
                    <div
                      className="h-full bg-gradient-to-r from-[#226bff] to-[#65adff] transition-all"
                      style={{ width: `${(doneCount / plan.length) * 100}%` }}
                    />
                  </div>
                  <div className="space-y-2.5">
                    {plan.map((item) => (
                      <PlanItem
                        key={item.id}
                        item={item}
                        done={!!progress[item.id]}
                        onToggle={() => togglePlan(item.id)}
                      />
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-2 text-sm text-green-700">
                  <Check className="w-4 h-4" />
                  You're in great shape — no action items for this job.
                </div>
              )}
            </Card>

            {/* Factor breakdown with explanations */}
            <Card>
              <h2 className="text-sm font-semibold mb-4">Why this score</h2>
              <div className="grid sm:grid-cols-2 gap-x-8 gap-y-5">
                <FactorBar label="Required skills" value={match.breakdown.required} note={ex.required} />
                <FactorBar label="Nice-to-have skills" value={match.breakdown.nice} note={ex.nice} />
                <FactorBar
                  label="Experience fit"
                  value={match.breakdown.experience}
                  note={ex.experience}
                />
                <FactorBar
                  label="Role relevance"
                  value={match.breakdown.relevance}
                  note={ex.relevance}
                />
              </div>
            </Card>

            {/* Experience gap callout */}
            {match.experience_gap && (
              <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                <TrendingUp className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-amber-800">Experience gap</p>
                  <p className="text-sm text-amber-700 mt-0.5">{match.experience_gap}</p>
                </div>
              </div>
            )}

            {/* Skills assessment: matched / partial / missing — chips fill the row width */}
            <Card>
              <h2 className="text-sm font-semibold mb-4">Skills assessment</h2>
              <div className="space-y-5">
                <SkillGroup
                  title="Matched"
                  Icon={Check}
                  tone={{ head: "text-green-700", chip: "bg-green-50 text-green-700 border-green-100" }}
                  items={match.matched || []}
                  hint="Clearly shown in your resume"
                />
                <SkillGroup
                  title="Partial"
                  Icon={Minus}
                  tone={{ head: "text-amber-600", chip: "bg-amber-50 text-amber-700 border-amber-100" }}
                  items={match.partial || []}
                  hint="Touched on, but not demonstrated"
                />
                <SkillGroup
                  title="Missing"
                  Icon={HelpCircle}
                  tone={{ head: "text-red-500", chip: "bg-red-50 text-red-600 border-red-100" }}
                  items={match.missing || []}
                  hint="Not found in your resume"
                />
              </div>
            </Card>

            {/* Improve bullets */}
            <Card>
              <h2 className="text-sm font-semibold mb-3">Improve these bullet points</h2>
              {match.weak_bullets?.length > 0 ? (
                <div className="grid md:grid-cols-2 gap-3">
                  {match.weak_bullets.map((b, i) => (
                    <div key={i} className="border border-gray-100 rounded-lg p-3 bg-gray-50/60">
                      <p className="text-sm text-gray-400 line-through">{b.original}</p>
                      <p className="text-xs text-amber-600 mt-1">{b.issue}</p>
                      <div className="flex items-start justify-between gap-2 mt-2">
                        <p className="text-sm text-slate-700">{b.suggestion}</p>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(b.suggestion);
                            toast.success("Copied");
                          }}
                          className="text-gray-400 hover:text-[#4a7aff] shrink-0"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400">No weak bullet points found — nice work.</p>
              )}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default MatchReport;
