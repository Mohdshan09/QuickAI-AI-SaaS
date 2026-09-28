import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Check, X, Printer, RefreshCw, Sparkles, Lock, Wand2 } from "lucide-react";
import toast from "react-hot-toast";
import { useCareerApi } from "../../lib/careerApi";
import { Card } from "../../components/career/MatchVisuals";
import { wordDiff } from "../../lib/wordDiff";

const DiffText = ({ parts, kind }) => (
  <p className="text-sm leading-relaxed text-slate-700">
    {parts.map((p, i) =>
      p[kind] ? (
        <span
          key={i}
          className={
            kind === "added"
              ? "bg-green-100 text-green-800 rounded px-0.5"
              : "text-red-400 line-through"
          }
        >
          {p.text}
        </span>
      ) : (
        <span key={i}>{p.text}</span>
      )
    )}
  </p>
);

const ChangeCard = ({ label, original, tailored, reason, keptOriginal, accepted, onToggle }) => {
  const diff = useMemo(() => wordDiff(original, tailored), [original, tailored]);
  return (
    <div
      className={`border rounded-lg p-3 transition ${
        accepted ? "border-gray-200 bg-white" : "border-gray-100 bg-gray-50/60 opacity-70"
      }`}
    >
      {label && <p className="text-[11px] uppercase tracking-wide text-gray-400 mb-2">{label}</p>}
      <div className="grid md:grid-cols-2 gap-x-5 gap-y-2">
        <div>
          <p className="text-[11px] text-gray-400 mb-1">Original</p>
          <DiffText parts={diff.original} kind="removed" />
        </div>
        <div>
          <p className="text-[11px] text-gray-400 mb-1">Tailored</p>
          <DiffText parts={diff.tailored} kind="added" />
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 mt-2.5">
        <p className="text-xs text-gray-400 flex-1">
          {keptOriginal ? "Kept original (couldn't verify a number)." : reason}
        </p>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onToggle(true)}
            className={`flex items-center gap-1 text-xs px-2 py-1 rounded-md border ${
              accepted
                ? "bg-green-50 text-green-700 border-green-200"
                : "text-gray-500 border-gray-200 hover:bg-gray-50"
            }`}
          >
            <Check className="w-3.5 h-3.5" /> Accept
          </button>
          <button
            onClick={() => onToggle(false)}
            className={`flex items-center gap-1 text-xs px-2 py-1 rounded-md border ${
              !accepted
                ? "bg-red-50 text-red-600 border-red-200"
                : "text-gray-500 border-gray-200 hover:bg-gray-50"
            }`}
          >
            <X className="w-3.5 h-3.5" /> Reject
          </button>
        </div>
      </div>
    </div>
  );
};

const TailorResume = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const api = useCareerApi();

  const [job, setJob] = useState(null);
  const [resumes, setResumes] = useState([]);
  const [resumeId, setResumeId] = useState("");
  const [tailored, setTailored] = useState(null);
  const [accepted, setAccepted] = useState({});
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [running, setRunning] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [premiumBlocked, setPremiumBlocked] = useState(false);

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
        if (resumeData.success) {
          setResumes(resumeData.resumes);
          setResumeId(jobData.job.resume_id || resumeData.resumes[0]?.id || "");
        }
      } catch (err) {
        toast.error(err.response?.data?.message || err.message);
        navigate("/ai/jobs");
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!resumeId) {
      setTailored(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setChecking(true);
        const data = await api.getTailor(id, resumeId);
        if (cancelled) return;
        setTailored(data.tailored);
        setAccepted(data.tailored?.accepted || {});
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

  const runTailor = async (force = false) => {
    if (!resumeId) return;
    setConfirming(false);
    try {
      setRunning(true);
      const data = await api.runTailor(id, resumeId, force);
      if (data.success) {
        setTailored(data.tailored);
        setAccepted(data.tailored.accepted || {});
        toast.success("Resume tailored");
      } else {
        toast.error(data.message);
      }
    } catch (err) {
      if (err.response?.status === 403) setPremiumBlocked(true);
      toast.error(err.response?.data?.message || err.message);
    } finally {
      setRunning(false);
    }
  };

  const isAccepted = (key) => accepted[key] !== false;

  const toggle = async (key, value) => {
    if (isAccepted(key) === value) return;
    setAccepted((a) => ({ ...a, [key]: value }));
    try {
      const data = await api.setTailorAccept(id, resumeId, key, value);
      if (data.success) setAccepted(data.accepted);
    } catch (err) {
      setAccepted((a) => ({ ...a, [key]: !value }));
      toast.error(err.response?.data?.message || err.message);
    }
  };

  const buildText = () => {
    const lines = [];
    if (tailored.header) lines.push(tailored.header, "");
    const sum = isAccepted("summary") ? tailored.summary?.tailored : tailored.summary?.original;
    if (sum) lines.push("SUMMARY", sum, "");
    (tailored.sections || []).forEach((s, si) => {
      lines.push((s.heading || "").toUpperCase());
      (s.bullets || []).forEach((b, bi) => {
        const text = isAccepted(`${si}:${bi}`) ? b.tailored : b.original;
        if (text) lines.push(`• ${text}`);
      });
      lines.push("");
    });
    const skills = isAccepted("skills") ? tailored.skills?.tailored : tailored.skills?.original;
    if (skills?.length) lines.push("SKILLS", skills.join(", "));
    return lines.join("\n").trim();
  };

  const saveAndRecheck = async () => {
    try {
      setSaving(true);
      const title = `${job.role} — tailored`.slice(0, 120);
      const data = await api.createResumeFromText(title, buildText());
      if (data.success) {
        toast.success("Saved as a new resume");
        navigate(`/ai/jobs/${id}/match?resumeId=${data.resume.id}`);
      } else {
        toast.error(data.message);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.message);
    } finally {
      setSaving(false);
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

  const summaryChanged = tailored && tailored.summary?.tailored !== tailored.summary?.original;
  const skillsChanged =
    tailored &&
    JSON.stringify(tailored.skills?.tailored || []) !== JSON.stringify(tailored.skills?.original || []);

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
          <Wand2 className="w-5 h-5 text-[#4a7aff]" />
          <h1 className="text-xl font-semibold">Tailored resume</h1>
        </div>
        <p className="text-sm text-gray-500 mb-5">
          {job.role} · {job.company}
        </p>

        <Card>
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-slate-600 flex-1 min-w-[240px]">
              {tailored
                ? "Review each change below. Accepted changes go into your exported resume — nothing is invented from your resume."
                : checking
                ? "Loading saved version…"
                : "Rewrite this resume's wording to match the job — surfacing relevant experience you already have, inventing nothing."}
            </p>

            {resumes.length === 0 ? (
              <p className="text-sm text-gray-500">Upload a resume first.</p>
            ) : premiumBlocked ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5">
                <p className="text-sm text-amber-700 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5" /> Tailoring is a premium feature.{" "}
                  <a href="/#plans" className="font-medium text-[#4a7aff] hover:underline">
                    Upgrade
                  </a>
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
                {tailored ? (
                  confirming ? (
                    <span className="inline-flex items-center gap-2 text-xs">
                      <span className="text-gray-500">Regenerates and replaces this version.</span>
                      <button
                        onClick={() => runTailor(true)}
                        disabled={running}
                        className="font-medium text-[#4a7aff] hover:underline disabled:opacity-60"
                      >
                        Re-generate
                      </button>
                      <button onClick={() => setConfirming(false)} className="text-gray-400 hover:underline">
                        Cancel
                      </button>
                    </span>
                  ) : (
                    <button
                      onClick={() => setConfirming(true)}
                      disabled={running}
                      className="flex items-center gap-1 text-sm text-gray-500 hover:text-[#4a7aff] disabled:opacity-60"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${running ? "animate-spin" : ""}`} /> Re-generate
                    </button>
                  )
                ) : (
                  !checking && (
                    <button
                      onClick={() => runTailor(false)}
                      disabled={running || !resumeId}
                      className="flex items-center gap-2 bg-gradient-to-r from-[#226bff] to-[#65adff] text-white px-4 py-1.5 rounded-lg text-sm disabled:opacity-60"
                    >
                      {running && (
                        <span className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent animate-spin" />
                      )}
                      {running ? "Tailoring…" : "Tailor my resume for this job"}
                    </button>
                  )
                )}
              </div>
            )}
          </div>
          {running && (
            <p className="text-sm text-gray-500 animate-pulse mt-4">
              Rewriting your resume for this job… (about 5–15 seconds)
            </p>
          )}
        </Card>

        {tailored && (
          <>
            <div className="mt-5 space-y-5">
              {summaryChanged && (
                <Card>
                  <h2 className="text-sm font-semibold mb-3">Summary</h2>
                  <ChangeCard
                    original={tailored.summary.original}
                    tailored={tailored.summary.tailored}
                    reason="Rewritten to lead with what this job values."
                    keptOriginal={tailored.summary.kept_original}
                    accepted={isAccepted("summary")}
                    onToggle={(v) => toggle("summary", v)}
                  />
                </Card>
              )}

              {(tailored.sections || []).map((s, si) => {
                const changed = (s.bullets || []).filter((b) => b.tailored !== b.original);
                return (
                  <Card key={si}>
                    <h2 className="text-sm font-semibold mb-3">{s.heading}</h2>
                    {changed.length === 0 ? (
                      <ul className="list-disc pl-5 space-y-1 text-sm text-slate-600">
                        {(s.bullets || []).map((b, bi) => (
                          <li key={bi}>{b.original}</li>
                        ))}
                      </ul>
                    ) : (
                      <div className="space-y-3">
                        {(s.bullets || []).map((b, bi) =>
                          b.tailored === b.original ? (
                            <p key={bi} className="text-sm text-slate-600 pl-1">
                              • {b.original}
                            </p>
                          ) : (
                            <ChangeCard
                              key={bi}
                              original={b.original}
                              tailored={b.tailored}
                              reason={b.reason}
                              keptOriginal={b.kept_original}
                              accepted={isAccepted(`${si}:${bi}`)}
                              onToggle={(v) => toggle(`${si}:${bi}`, v)}
                            />
                          )
                        )}
                      </div>
                    )}
                  </Card>
                );
              })}

              {(tailored.skills?.tailored?.length > 0 || tailored.skills?.original?.length > 0) && (
                <Card>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-semibold">Skills</h2>
                    {skillsChanged && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => toggle("skills", true)}
                          className={`flex items-center gap-1 text-xs px-2 py-1 rounded-md border ${
                            isAccepted("skills")
                              ? "bg-green-50 text-green-700 border-green-200"
                              : "text-gray-500 border-gray-200"
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" /> Accept
                        </button>
                        <button
                          onClick={() => toggle("skills", false)}
                          className={`flex items-center gap-1 text-xs px-2 py-1 rounded-md border ${
                            !isAccepted("skills")
                              ? "bg-red-50 text-red-600 border-red-200"
                              : "text-gray-500 border-gray-200"
                          }`}
                        >
                          <X className="w-3.5 h-3.5" /> Reject
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(isAccepted("skills") ? tailored.skills.tailored : tailored.skills.original).map(
                      (sk) => (
                        <span
                          key={sk}
                          className="text-xs px-2.5 py-1 rounded-full bg-[#EEF4FF] text-[#4a7aff] border border-[#dbe6ff]"
                        >
                          {sk}
                        </span>
                      )
                    )}
                  </div>
                </Card>
              )}
            </div>

            <div className="flex flex-wrap gap-2 mt-6">
              <button
                onClick={() => window.open(`/ai/jobs/${id}/print?resumeId=${resumeId}`, "_blank")}
                className="flex items-center gap-2 bg-gradient-to-r from-[#226bff] to-[#65adff] text-white px-4 py-2 rounded-lg text-sm"
              >
                <Printer className="w-4 h-4" /> Export PDF
              </button>
              <button
                onClick={saveAndRecheck}
                disabled={saving}
                className="flex items-center gap-2 border border-gray-300 text-slate-700 px-4 py-2 rounded-lg text-sm hover:border-[#4a7aff] disabled:opacity-60"
              >
                <Sparkles className="w-4 h-4 text-[#4a7aff]" />
                {saving ? "Saving…" : "Save & re-check match"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default TailorResume;
