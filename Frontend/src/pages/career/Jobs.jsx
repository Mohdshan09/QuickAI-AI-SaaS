import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Briefcase, X, Sparkles } from "lucide-react";
import toast from "react-hot-toast";
import { useCareerApi, scoreColor } from "../../lib/careerApi";

const STATUS_STYLES = {
  saved: "bg-gray-100 text-gray-600",
  applied: "bg-blue-50 text-blue-600",
  interviewing: "bg-amber-50 text-amber-600",
  offer: "bg-green-50 text-green-700",
  rejected: "bg-red-50 text-red-500",
};
const STATUS_LABELS = {
  saved: "Saved",
  applied: "Applied",
  interviewing: "Interviewing",
  offer: "Offer",
  rejected: "Rejected",
};

const AddJobForm = ({ onClose, onCreated }) => {
  const api = useCareerApi();
  const [form, setForm] = useState({ company: "", role: "", url: "", description: "" });
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      const data = await api.createJob({
        company: form.company,
        role: form.role,
        url: form.url || undefined,
        description: form.description,
      });
      if (data.success) {
        toast.success("Job added");
        onCreated(data.job);
      } else {
        toast.error(data.message);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <form
        onSubmit={submit}
        className="bg-white rounded-lg border border-gray-200 p-4 w-full max-w-lg max-h-[90vh] overflow-y-auto text-slate-700"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Briefcase className="w-6 text-[#4a7aff]" />
            <h1 className="text-xl font-semibold">Add a job</h1>
          </div>
          <button type="button" onClick={onClose}>
            <X className="w-5 h-5 text-gray-400 hover:text-gray-700" />
          </button>
        </div>

        <div className="grid sm:grid-cols-2 gap-3 mt-6">
          <div>
            <p className="text-sm font-medium">Company</p>
            <input
              className="w-full p-2 px-3 mt-2 outline-none text-sm rounded-md border border-gray-300"
              placeholder="Acme Inc."
              value={form.company}
              onChange={set("company")}
              required
            />
          </div>
          <div>
            <p className="text-sm font-medium">Role / job title</p>
            <input
              className="w-full p-2 px-3 mt-2 outline-none text-sm rounded-md border border-gray-300"
              placeholder="Frontend Engineer"
              value={form.role}
              onChange={set("role")}
              required
            />
          </div>
        </div>

        <p className="mt-4 text-sm font-medium">Posting URL (optional)</p>
        <input
          className="w-full p-2 px-3 mt-2 outline-none text-sm rounded-md border border-gray-300"
          placeholder="https://…"
          value={form.url}
          onChange={set("url")}
        />

        <p className="mt-4 text-sm font-medium">Job description</p>
        <textarea
          className="w-full p-2 px-3 mt-2 outline-none text-sm rounded-md border border-gray-300 h-32 resize-none"
          placeholder="Paste the full job description here"
          value={form.description}
          onChange={set("description")}
          required
        />
        <p className="mt-1 text-xs text-gray-400">
          {form.description.length} characters (need at least 200)
        </p>

        <button
          disabled={saving}
          className="w-full flex justify-center items-center gap-2 bg-gradient-to-r from-[#226bff] to-[#65adff] text-white px-4 py-2 mt-5 text-sm rounded-lg cursor-pointer disabled:opacity-60"
        >
          {saving ? (
            <span className="w-4 h-4 my-0.5 rounded-full border-2 border-t-transparent animate-spin" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
          Add job
        </button>
      </form>
    </div>
  );
};

const Jobs = () => {
  const api = useCareerApi();
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [resumeCount, setResumeCount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  const load = async () => {
    try {
      const [jobsData, resumeData] = await Promise.all([api.listJobs(), api.listResumes()]);
      if (jobsData.success) setJobs(jobsData.jobs);
      if (resumeData.success) setResumeCount(resumeData.resumes.length);
    } catch (err) {
      toast.error(err.response?.data?.message || err.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <span className="w-10 h-10 rounded-full border-3 border-[#4a7aff] border-t-transparent animate-spin" />
      </div>
    );
  }

  // First-time users need a resume before jobs are useful
  if (resumeCount === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-700">
        <div className="w-14 h-14 rounded-2xl bg-[#EEF4FF] flex items-center justify-center mb-4">
          <Briefcase className="w-7 h-7 text-[#4a7aff]" />
        </div>
        <h1 className="text-xl font-semibold">Let's get you more interviews</h1>
        <p className="text-sm text-gray-500 mt-1 max-w-sm">
          Upload your resume first. Then add the jobs you're applying for and see how well you
          match each one.
        </p>
        <button
          onClick={() => navigate("/ai/resumes")}
          className="mt-5 flex items-center gap-2 bg-gradient-to-r from-[#226bff] to-[#65adff] text-white px-5 py-2 rounded-lg text-sm"
        >
          Upload your resume
        </button>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-scroll p-6 text-slate-700">
      <div className="flex items-center justify-between gap-3 max-w-5xl">
        <div className="flex items-center gap-3">
          <Sparkles className="w-6 text-[#4a7aff]" />
          <div>
            <h1 className="text-xl font-semibold">Jobs</h1>
            <p className="text-sm text-gray-500">Track applications and check your match for each.</p>
          </div>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-2 bg-gradient-to-r from-[#226bff] to-[#65adff] text-white px-4 py-2 rounded-lg text-sm shrink-0"
        >
          <Plus className="w-4 h-4" /> Add job
        </button>
      </div>

      {jobs.length === 0 ? (
        <div className="mt-6 max-w-5xl bg-white border border-gray-200 rounded-lg p-10 flex flex-col items-center text-center">
          <Briefcase className="w-8 h-8 text-gray-300" />
          <p className="text-sm text-gray-500 mt-3">
            No jobs yet. Add the first job you're applying for.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 max-w-5xl">
          {jobs.map((job) => {
            const c = scoreColor(job.latest_score);
            return (
              <div
                key={job.id}
                onClick={() => navigate(`/ai/jobs/${job.id}`)}
                className="bg-white border border-gray-200 rounded-lg p-4 cursor-pointer hover:border-[#4a7aff] hover:shadow-sm transition flex flex-col gap-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{job.role}</p>
                    <p className="text-sm text-gray-500 truncate">{job.company}</p>
                  </div>
                  <div className="relative w-12 h-12 shrink-0">
                    <svg className="w-12 h-12 -rotate-90" viewBox="0 0 48 48">
                      <circle cx="24" cy="24" r="20" fill="none" stroke="#F1F5F9" strokeWidth="5" />
                      {job.latest_score != null && (
                        <circle
                          cx="24"
                          cy="24"
                          r="20"
                          fill="none"
                          stroke={c.ring}
                          strokeWidth="5"
                          strokeLinecap="round"
                          strokeDasharray={2 * Math.PI * 20}
                          strokeDashoffset={2 * Math.PI * 20 * (1 - job.latest_score / 100)}
                        />
                      )}
                    </svg>
                    <span
                      className={`absolute inset-0 flex items-center justify-center text-xs font-semibold ${c.text}`}
                    >
                      {job.latest_score == null ? "—" : job.latest_score}
                    </span>
                  </div>
                </div>
                <span
                  className={`self-start text-xs px-2 py-0.5 rounded-full ${STATUS_STYLES[job.status]}`}
                >
                  {STATUS_LABELS[job.status]}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {adding && (
        <AddJobForm
          onClose={() => setAdding(false)}
          onCreated={(job) => {
            setAdding(false);
            navigate(`/ai/jobs/${job.id}`);
          }}
        />
      )}
    </div>
  );
};

export default Jobs;
