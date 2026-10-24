import { useEffect, useState } from "react";
import { getJson, postJson } from "../lib/apiClient.js";
import { getAnonId } from "../lib/anonId.js";

const ALIAS_KEY = "examsnap:alias";
const EMPTY_BODY = "";

function getSavedAlias() {
  try { return localStorage.getItem(ALIAS_KEY) || ""; } catch { return ""; }
}
function saveAlias(alias) {
  try { localStorage.setItem(ALIAS_KEY, alias); } catch { /* storage blocked */ }
}
function clearAlias() {
  try { localStorage.removeItem(ALIAS_KEY); } catch { /* storage blocked */ }
}

/** Public, alias-only conversation scoped to the current exam. */
export default function ExamDiscussion({ examRef, examName }) {
  const [comments, setComments] = useState([]);
  // savedAlias: the alias persisted in localStorage ("" means not yet chosen)
  const [savedAlias, setSavedAlias] = useState(() => getSavedAlias());
  const [aliasInput, setAliasInput] = useState(() => getSavedAlias());
  const [body, setBody] = useState(EMPTY_BODY);
  const [replyTo, setReplyTo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getJson(`comments?examRef=${encodeURIComponent(examRef)}`)
      .then((data) => !cancelled && setComments(Array.isArray(data.comments) ? data.comments : []))
      .catch(() => !cancelled && setError("Could not load the discussion."))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [examRef]);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setSending(true);
    // Use savedAlias if set, otherwise use what was just typed
    const alias = savedAlias || aliasInput.trim();
    try {
      const data = await postJson("comments", { examRef, alias, body, parentId: replyTo?.id ?? null, anonId: getAnonId() });
      if (data.comment) setComments((items) => [...items, data.comment]);
      // Persist the alias so they never have to type it again
      saveAlias(alias);
      setSavedAlias(alias);
      setAliasInput(alias);
      setBody(EMPTY_BODY);
      setReplyTo(null);
    } catch {
      setError("Your comment could not be posted. Do not include links, emails, or phone numbers.");
    } finally {
      setSending(false);
    }
  };

  const handleChangeAlias = () => {
    clearAlias();
    setSavedAlias("");
    setAliasInput("");
  };

  const report = async (comment) => {
    const reason = window.prompt("Why are you reporting this? Enter: spam, harmful, misleading, or other.", "spam");
    if (!reason) return;
    try {
      const data = await postJson("comments", { action: "report", commentId: comment.id, reason: reason.trim().toLowerCase(), anonId: getAnonId() });
      setError(data.hidden ? "Thanks. This comment has been hidden for review." : "Thanks. Your report has been sent for review.");
    } catch { setError("Could not send the report. Please choose spam, harmful, misleading, or other."); }
  };

  const roots = comments.filter((c) => c.parentId == null);
  const replies = (id) => comments.filter((c) => c.parentId === id);

  return (
    <section className="mt-10 border-t border-slate-200 pt-7" aria-labelledby="discussion-heading">
      <h2 id="discussion-heading" className="text-xl font-bold text-slate-900">Discuss {examName}</h2>
      <p className="mt-1 text-sm text-slate-600">Share application tips or ask a question using an alias. Keep personal contact details private.</p>

      <form onSubmit={submit} className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
        {replyTo && (
          <p className="mb-3 text-sm text-slate-600">
            Replying to {replyTo.alias}.{" "}
            <button type="button" onClick={() => setReplyTo(null)} className="text-blue-600 hover:underline">Cancel</button>
          </p>
        )}

        {/* Alias row — shown only when no alias has been saved yet */}
        {savedAlias ? (
          <p className="mb-3 text-sm text-slate-600">
            Posting as <span className="font-medium text-slate-800">{savedAlias}</span>
            {" · "}
            <button type="button" onClick={handleChangeAlias} className="text-blue-600 hover:underline">change</button>
          </p>
        ) : (
          <label className="block text-sm">
            <span className="mb-1 block text-slate-700">Your alias</span>
            <input
              required
              maxLength="32"
              value={aliasInput}
              onChange={(e) => setAliasInput(e.target.value)}
              placeholder="@yourname"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
            />
          </label>
        )}

        <label className="mt-3 block text-sm">
          <span className="mb-1 block text-slate-700">Comment</span>
          <textarea
            required
            maxLength="1000"
            rows="3"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Ask about the application or share a helpful tip…"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
          />
        </label>

        <p className="mt-2 text-xs text-slate-500">Links, email addresses, and phone numbers are not allowed.</p>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

        <button
          disabled={sending}
          className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {sending ? "Posting…" : replyTo ? "Post reply" : "Post comment"}
        </button>
      </form>

      {loading
        ? <p className="mt-5 text-sm text-slate-500">Loading discussion…</p>
        : (
          <div className="mt-5 space-y-4">
            {!roots.length && <p className="text-sm text-slate-500">No comments yet. Start the discussion.</p>}
            {roots.map((comment) => (
              <Comment key={comment.id} comment={comment} replies={replies(comment.id)} onReply={setReplyTo} onReport={report} />
            ))}
          </div>
        )
      }
    </section>
  );
}

function Comment({ comment, replies, onReply, onReport }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="font-medium text-slate-800">{comment.alias}</p>
      <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{comment.body}</p>
      <div className="mt-2 flex gap-3">
        <button type="button" onClick={() => onReply(comment)} className="text-sm text-blue-600 hover:underline">Reply</button>
        <button type="button" onClick={() => onReport(comment)} className="text-sm text-slate-500 hover:text-red-700 hover:underline">Report comment</button>
      </div>
      {replies.length > 0 && (
        <div className="mt-3 space-y-3 border-l-2 border-blue-100 pl-4">
          {replies.map((reply) => <Comment key={reply.id} comment={reply} replies={[]} onReply={onReply} onReport={onReport} />)}
        </div>
      )}
    </article>
  );
}
