import { useState } from "react";
import { Head } from "vite-react-ssg";
import { API_BASE } from "../lib/apiClient.js";

// The key is held only in React state, never localStorage. It protects the moderation API.
export default function ModerationPage() {
  const [key, setKey] = useState("");
  const [comments, setComments] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const request = (path, options = {}) => fetch(API_BASE + path, { ...options, headers: { "x-moderation-key": key, ...(options.headers || {}) } });
  const load = async () => {
    setLoading(true); setError("");
    try {
      const response = await request("comment-moderation");
      if (!response.ok) throw new Error();
      setComments((await response.json()).comments || []);
    } catch { setError("Could not load reports. Check the moderation key and Vercel configuration."); }
    finally { setLoading(false); }
  };
  const update = async (commentId, action) => {
    const response = await request("comment-moderation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ commentId, action }) });
    if (!response.ok) return setError("Could not update the comment.");
    setComments((items) => items.map((item) => item.id === commentId ? { ...item, status: action === "hide" ? "hidden" : "published" } : item));
  };
  return <div className="mx-auto max-w-3xl"><Head><title>Comment moderation — ExamSnap</title><meta name="robots" content="noindex, nofollow" /></Head><h1 className="text-2xl font-bold text-slate-900">Comment moderation</h1><p className="mt-1 text-sm text-slate-600">Review reported discussion comments. Your key is not saved in this browser.</p><div className="mt-5 flex gap-2"><input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="Moderation key" className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2" /><button onClick={load} disabled={!key || loading} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{loading ? "Loading…" : "Load reports"}</button></div>{error && <p className="mt-3 text-sm text-red-600">{error}</p>}<div className="mt-6 space-y-3">{comments.map((comment) => <article key={comment.id} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium text-slate-800">{comment.alias} <span className="text-sm font-normal text-slate-500">in {comment.exam_ref}</span></p><span className="rounded-full bg-amber-100 px-2 py-1 text-xs text-amber-800">{comment.reports} report{comment.reports === 1 ? "" : "s"}</span></div><p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{comment.body}</p><button onClick={() => update(comment.id, comment.status === "hidden" ? "restore" : "hide")} className="mt-3 text-sm font-medium text-blue-700 underline">{comment.status === "hidden" ? "Restore comment" : "Hide comment"}</button></article>)}</div></div>;
}
