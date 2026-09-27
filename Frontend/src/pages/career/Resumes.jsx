import { useEffect, useRef, useState } from "react";
import { FileText, Trash2, Upload, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { useCareerApi } from "../../lib/careerApi";

const Resumes = () => {
  const api = useCareerApi();
  const [resumes, setResumes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const load = async () => {
    try {
      const data = await api.listResumes();
      if (data.success) setResumes(data.resumes);
    } catch (err) {
      toast.error(err.response?.data?.message || err.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append("resume", file);
    form.append("title", file.name.replace(/\.pdf$/i, ""));
    try {
      setUploading(true);
      const data = await api.uploadResume(form);
      if (data.success) {
        toast.success("Resume saved");
        load();
      } else {
        toast.error(data.message);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const remove = async (id) => {
    try {
      const data = await api.deleteResume(id);
      if (data.success) {
        setResumes((r) => r.filter((x) => x.id !== id));
      } else {
        toast.error(data.message);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.message);
    }
  };

  return (
    <div className="h-full overflow-y-scroll p-6 flex items-start flex-wrap gap-4 text-slate-700">
      {/* Left: upload */}
      <div className="w-full max-w-lg p-4 bg-white rounded-lg border border-gray-200">
        <div className="flex items-center gap-3">
          <FileText className="w-6 text-[#4a7aff]" />
          <h1 className="text-xl font-semibold">Your resumes</h1>
        </div>
        <p className="mt-4 text-sm text-gray-500">
          Upload once, then reuse for every job. We read the text and save it — the PDF isn't stored.
        </p>

        <label className="mt-5 flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-xl p-8 cursor-pointer hover:border-[#4a7aff] transition">
          {uploading ? (
            <Loader2 className="w-6 h-6 text-[#4a7aff] animate-spin" />
          ) : (
            <Upload className="w-6 h-6 text-[#4a7aff]" />
          )}
          <span className="text-sm text-gray-600 text-center">
            {uploading ? "Reading your resume…" : "Click to upload a PDF resume (max 5MB)"}
          </span>
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={onFile}
            disabled={uploading}
          />
        </label>
      </div>

      {/* Right: saved resumes */}
      <div className="w-full max-w-lg p-4 bg-white rounded-lg flex flex-col border border-gray-200 min-h-96">
        <div className="flex items-center gap-3">
          <FileText className="w-5 h-5 text-[#4a7aff]" />
          <h1 className="text-xl font-semibold">Saved resumes</h1>
        </div>

        {loading ? (
          <div className="flex-1 flex justify-center items-center">
            <span className="w-8 h-8 rounded-full border-3 border-[#4a7aff] border-t-transparent animate-spin" />
          </div>
        ) : resumes.length === 0 ? (
          <div className="flex-1 flex justify-center items-center">
            <div className="text-sm flex flex-col items-center gap-4 text-gray-400 text-center">
              <FileText className="w-9 h-9" />
              <p>No resumes yet. Upload your first one to get started.</p>
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {resumes.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between border border-gray-100 rounded-lg p-3 bg-gray-50/60"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-[#EEF4FF] flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4 text-[#4a7aff]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{r.title}</p>
                    <p className="text-xs text-gray-500">
                      Added {new Date(r.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => remove(r.id)}
                  className="text-gray-400 hover:text-red-500 transition shrink-0"
                  title="Delete resume"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Resumes;
