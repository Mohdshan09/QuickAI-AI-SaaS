import { useEffect, useState } from "react";
import { getJson, postJson } from "../lib/apiClient.js";
import { getAnonId } from "../lib/anonId.js";
import { useT } from "../i18n/index.jsx";

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
  const t = useT();
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
      .catch(() => !cancelled && setError(t("discuss.loadError")))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [examRef, t]);

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
      setError(t("discuss.postError"));
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
    const reason = window.prompt(t("discuss.reportPrompt"), "spam");
    if (!reason) return;
    try {
      const data = await postJson("comments", { action: "report", commentId: comment.id, reason: reason.trim().toLowerCase(), anonId: getAnonId() });
      setError(data.hidden ? t("discuss.reportThanksHidden") : t("discuss.reportThanks"));
    } catch { setError(t("discuss.reportError")); }
  };

  const roots = comments.filter((c) => c.parentId == null);
  const replies = (id) => comments.filter((c) => c.parentId === id);

  return (
    <section className="mt-10 border-t border-slate-200 pt-7" aria-labelledby="discussion-heading">
      <h2 id="discussion-heading" className="text-xl font-bold text-slate-900">{t("discuss.title", { exam: examName })}</h2>
      <p className="mt-1 text-sm text-slate-600">{t("discuss.lead")}</p>

      <form onSubmit={submit} className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
        {replyTo && (
          <p className="mb-3 text-sm text-slate-600">
            {t("discuss.replyingTo", { alias: replyTo.alias })}{" "}
            <button type="button" onClick={() => setReplyTo(null)} className="text-blue-600 hover:underline">{t("discuss.cancel")}</button>
          </p>
        )}

        {/* Alias row — shown only when no alias has been saved yet */}
        {savedAlias ? (
          <p className="mb-3 text-sm text-slate-600">
            {t("discuss.postingAs", { alias: savedAlias })}
            {" · "}
            <button type="button" onClick={handleChangeAlias} className="text-blue-600 hover:underline">{t("discuss.change")}</button>
          </p>
        ) : (
          <label className="block text-sm">
            <span className="mb-1 block text-slate-700">{t("discuss.alias")}</span>
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
          <span className="mb-1 block text-slate-700">{t("discuss.comment")}</span>
          <textarea
            required
            maxLength="1000"
            rows="3"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={t("discuss.commentPlaceholder")}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
          />
        </label>

        <p className="mt-2 text-xs text-slate-500">{t("discuss.noLinks")}</p>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

        <button
          disabled={sending}
          className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {sending ? t("discuss.posting") : replyTo ? t("discuss.postReply") : t("discuss.postComment")}
        </button>
      </form>

      {loading
        ? <p className="mt-5 text-sm text-slate-500">{t("discuss.loading")}</p>
        : (
          <div className="mt-5 space-y-4">
            {!roots.length && <p className="text-sm text-slate-500">{t("discuss.empty")}</p>}
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
  const t = useT();
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="font-medium text-slate-800">{comment.alias}</p>
      <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-700">{comment.body}</p>
      <div className="mt-2 flex gap-3">
        <button type="button" onClick={() => onReply(comment)} className="text-sm text-blue-600 hover:underline">{t("discuss.reply")}</button>
        <button type="button" onClick={() => onReport(comment)} className="text-sm text-slate-500 hover:text-red-700 hover:underline">{t("discuss.report")}</button>
      </div>
      {replies.length > 0 && (
        <div className="mt-3 space-y-3 border-l-2 border-blue-100 pl-4">
          {replies.map((reply) => <Comment key={reply.id} comment={reply} replies={[]} onReply={onReply} onReport={onReport} />)}
        </div>
      )}
    </article>
  );
}
