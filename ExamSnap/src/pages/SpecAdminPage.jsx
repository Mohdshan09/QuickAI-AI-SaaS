import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Head } from "vite-react-ssg";
import { AlertTriangle, ClipboardCopy, FileDiff, SearchCheck, ThumbsDown, UserPlus } from "lucide-react";
import { API_BASE } from "../lib/apiClient.js";
import { getExams } from "../specs/loadSpecs.js";
import {
  FAILING_MIN_REJECTIONS,
  FAILING_RATE,
  assessSpecHealth,
  buildSubmissionDraft,
  diffDocuments,
  submissionEvidence,
} from "../lib/specReview.js";

// Owner-only spec review queue. Everything the app already records (portal outcomes, community
// specs, requested exams, thumbs-down) lands here as a decision, and the loop ends with a human
// editing src/specs/exams/*.json — a Vercel function cannot write into the repo. The key lives
// only in React state (never localStorage), exactly like the moderation page. noindex.
const fmtDate = (value) =>
  value ? new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—";
const pct = (value) => `${Math.round((value || 0) * 100)}%`;
const kbText = (min, max) => `${min ?? 0}–${max ?? "∞"} KB`;
const dimsText = (width, height) => (width != null && height != null ? `${width}×${height} px` : "not specified");

export default function SpecAdminPage() {
  const [key, setKey] = useState("");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const exams = useMemo(() => getExams(), []);
  const review = useMemo(() => (data ? assessSpecHealth(data, exams) : null), [data, exams]);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(API_BASE + "spec-health", { headers: { "x-moderation-key": key } });
      if (response.status === 401) {
        setError("That key was rejected. It must match MODERATION_KEY in Vercel.");
        return;
      }
      if (!response.ok) throw new Error();
      setData(await response.json());
    } catch {
      setError("Could not load the spec queue. Check the Vercel configuration and that the database is reachable.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <Head>
        <title>Spec review — ExamSnap</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <nav className="mb-3 text-sm text-slate-400">
        <Link to="/" className="hover:underline">ExamSnap</Link> / Spec review
      </nav>
      <h1 className="text-2xl font-bold text-slate-900">Spec review queue</h1>
      <p className="mt-1 text-sm text-slate-600">
        Portal rejections, community specs, requested exams and thumbs-down — turned into edits for{" "}
        <code className="rounded bg-slate-100 px-1 text-xs">src/specs/exams/</code>.
      </p>

      <form
        onSubmit={(event) => { event.preventDefault(); if (key) load(); }}
        className="mt-5 flex flex-wrap gap-2"
      >
        <input
          type="password"
          value={key}
          onChange={(event) => setKey(event.target.value)}
          placeholder="Moderation key"
          autoComplete="off"
          className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2"
        />
        <button
          type="submit"
          disabled={!key || loading}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading ? "Loading…" : data ? "Refresh" : "Load queue"}
        </button>
      </form>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {!review && !error && <HowItWorks />}

      {review && (
        <>
          <p className="mt-3 text-xs text-slate-400">
            Signals from the last {data.windowDays || 90} days · {review.totals.rejected} rejection
            {review.totals.rejected === 1 ? "" : "s"} · generated {fmtDate(data.generatedAt)}
          </p>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Tile icon={AlertTriangle} label="Failing specs" value={review.totals.failing} accent="text-red-600" />
            <Tile icon={FileDiff} label="New spec data" value={review.totals.updates} accent="text-blue-600" />
            <Tile icon={UserPlus} label="Requested exams" value={review.totals.demand} accent="text-amber-600" />
            <Tile icon={ThumbsDown} label="Thumbs down" value={review.totals.down} accent="text-slate-700" />
          </div>

          {review.totals.failing + review.totals.updates + review.totals.demand + review.totals.down === 0 && (
            <p className="mt-6 rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
              Nothing to review yet. Signals show up here once visitors report a portal result, submit
              a spec for an unlisted exam, request an exam, or rate a download.
            </p>
          )}

          <Section
            id="failing"
            icon={AlertTriangle}
            title="Specs portals are rejecting"
            hint={`At least ${FAILING_MIN_REJECTIONS} rejections and a ${pct(FAILING_RATE)}+ rejection rate in the window.`}
            count={review.failing.length}
            empty="No shipped spec is failing right now."
          >
            {review.failing.map((row) => (
              <article key={row.normalized} className="rounded-xl border border-red-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link to={`/${row.exam.slug}`} className="font-medium text-slate-900 hover:underline">
                      {row.exam.name}
                    </Link>
                    <p className="mt-0.5 text-xs text-slate-400">Last signal {fmtDate(row.lastAt)}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-red-50 px-2 py-1 text-xs font-medium text-red-700">
                    {row.rejected} of {row.total} rejected · {pct(row.rejectionRate)}
                  </span>
                </div>

                {row.hashMismatch && (
                  <p className="mt-2 text-xs text-amber-700">
                    Rejections span more than one spec version — the shipped values changed mid-window.
                  </p>
                )}

                {row.errors.length > 0 ? (
                  <ul className="mt-2 space-y-1 text-sm text-slate-700">
                    {row.errors.map((entry) => (
                      <li key={entry.message} className="break-words">
                        <span className="mr-1 text-xs tabular-nums text-slate-400">{entry.count}×</span>
                        {entry.message}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-xs text-slate-400">
                    No portal message was given — open the official notification and compare the values.
                  </p>
                )}

                <p className="mt-2 text-xs text-slate-400">
                  Live hash <code className="text-slate-500">{row.currentHash}</code>
                </p>
              </article>
            ))}
          </Section>

          <Section
            id="updates"
            icon={FileDiff}
            title="Community specs that disagree with the live values"
            hint="Someone submitted different numbers for a shipped exam. Verify against the notification before changing the file."
            count={review.updates.length}
            empty="Every submitted spec matches the shipped one."
          >
            {review.updates.map((row) => {
              const docs = diffDocuments(row.exam, row.submission.documents);
              const evidence = submissionEvidence(row.exam, row.submission);
              const file = `src/specs/exams/${row.exam.id}.json`;
              return (
                <article key={row.normalized} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link to={`/${row.exam.slug}`} className="font-medium text-slate-900 hover:underline">
                        {row.exam.name}
                      </Link>
                      <p className="mt-0.5 text-xs text-slate-400">
                        {row.submission.count} of {row.totalSubmissions} submissions · last {fmtDate(row.submission.lastAt)}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">
                      {row.submission.specHash} vs {row.currentHash}
                    </span>
                  </div>

                  <div className="mt-3 space-y-2">
                    {docs.map((doc) => (
                      <div key={doc.type} className="rounded-lg border border-slate-100 bg-slate-50 p-2 text-xs">
                        <p className="font-medium capitalize text-slate-700">{doc.type}</p>
                        <div className="mt-1 grid grid-cols-[4.75rem_minmax(0,1fr)] gap-x-2 gap-y-1">
                          <span className="text-slate-400">Live</span>
                          <span className="text-slate-600">
                            {doc.current ? `${dimsText(doc.current.width, doc.current.height)} · ${kbText(doc.current.minKb, doc.current.maxKb)}` : "not in the shipped spec"}
                          </span>
                          <span className="text-slate-400">Submitted</span>
                          <span className="font-medium text-blue-700">
                            {dimsText(doc.submitted.width, doc.submitted.height)} · {kbText(doc.submitted.minKb, doc.submitted.maxKb)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {row.submission.notificationUrl?.startsWith("https://") ? (
                      <a
                        href={row.submission.notificationUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Open the submitted source
                      </a>
                    ) : (
                      <span className="text-xs text-amber-700">No source URL was supplied — find the notification yourself.</span>
                    )}
                    <span className="text-xs text-slate-400">Edit {file}</span>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <CopyButton text={evidence} label="Copy evidence" />
                    <JsonPreview summary="Preview documents snippet" json={buildSubmissionDraft({ exam: row.exam, submission: row.submission })?.json} />
                  </div>
                </article>
              );
            })}
          </Section>

          <Section
            id="demand"
            icon={UserPlus}
            title="Requested exams that are not in the catalogue"
            hint="Aliases first: a short request like “PO” usually belongs to an exam we already ship."
            count={review.demand.length}
            empty="No unmatched exam requests."
          >
            {review.demand.map((row) => {
              const draft = row.submission
                ? buildSubmissionDraft({ submission: row.submission, name: row.name, normalized: row.normalized })
                : null;
              return (
                <article key={row.normalized} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900">{row.name}</p>
                      <p className="mt-0.5 text-xs text-slate-400">
                        {row.requests > 0 && `${row.requests} request${row.requests === 1 ? "" : "s"} · `}
                        {row.lastAt ? `last ${fmtDate(row.lastAt)}` : "no date recorded"}
                      </p>
                    </div>
                    {row.submission && (
                      <span className="shrink-0 rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700">
                        spec submitted
                      </span>
                    )}
                  </div>

                  {row.samples.length > 1 && (
                    <p className="mt-1 text-xs text-slate-400">Also asked as: {row.samples.slice(1).join(", ")}</p>
                  )}

                  {row.aliases.length > 0 && (
                    <p className="mt-2 break-words text-xs text-amber-700">
                      Looks like an alias of{" "}
                      {row.aliases.map((exam, index) => (
                        <span key={exam.id}>
                          {index > 0 && ", "}
                          <Link to={`/${exam.slug}`} className="font-medium hover:underline">{exam.name}</Link>
                        </span>
                      ))}{" "}
                      — check before adding a new file.
                    </p>
                  )}

                  {draft ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <CopyButton text={draft.json} label="Copy new exam JSON" />
                      <JsonPreview summary={`Preview ${draft.file}`} json={draft.json} />
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-slate-500">
                      No spec submitted yet. Search the official notification for the photo/signature rules,
                      then add {`src/specs/exams/${row.normalized.replace(/ /g, "-")}.json`} starting with{" "}
                      <code className="text-slate-600">verified: false</code> and flip it once confirmed.
                    </p>
                  )}
                </article>
              );
            })}
          </Section>

          <Section
            id="feedback"
            icon={ThumbsDown}
            title="Thumbs-down at download"
            hint="A weak signal on its own — pair it with the rejection table above."
            count={review.feedback.length}
            empty="No quality feedback yet."
          >
            {review.feedback.map((row) => (
              <article key={row.examRef} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    {row.exam ? (
                      <Link to={`/${row.exam.slug}`} className="font-medium text-slate-900 hover:underline">
                        {row.exam.name}
                      </Link>
                    ) : (
                      <p className="font-medium text-slate-900">{row.examRef}</p>
                    )}
                    <p className="mt-0.5 text-xs text-slate-400">Last {fmtDate(row.lastAt)}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                    {row.down} down · {row.up} up
                  </span>
                </div>
                {row.reasons.length > 0 && (
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {row.reasons.map((reason) => (
                      <li key={reason.reason} className="rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-700">
                        {reason.reason} · {reason.count}
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            ))}
          </Section>
        </>
      )}
    </div>
  );
}

function HowItWorks() {
  return (
    <div className="mt-5 rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        <SearchCheck className="h-4 w-4 text-blue-600" aria-hidden />
        How the loop works
      </h2>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-600">
        <li>Enter the key and load the queue.</li>
        <li>For a failing spec, open the official notification and compare the values it lists.</li>
        <li>Edit <code className="rounded bg-slate-100 px-1 text-xs">src/specs/exams/&lt;id&gt;.json</code>, then set <code className="rounded bg-slate-100 px-1 text-xs">lastVerified</code>.</li>
        <li>For a new exam, paste the draft, check it against the notification, then set <code className="rounded bg-slate-100 px-1 text-xs">verified: true</code> — unverified files never ship.</li>
        <li>Commit and deploy — new outcomes clear the row as they arrive.</li>
      </ol>
      <p className="mt-2 text-xs text-slate-400">
        Nothing is written from here: the API only reads aggregates, and the browser never stores the key.
      </p>
    </div>
  );
}

function Section({ id, icon: Icon, title, hint, count, empty, children }) {
  return (
    <section id={id} className="mt-8">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs tabular-nums text-slate-600">{count}</span>
      </div>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
      {count === 0 ? (
        <p className="mt-3 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">{empty}</p>
      ) : (
        <div className="mt-3 space-y-3">{children}</div>
      )}
    </section>
  );
}

function Tile({ icon: Icon, label, value, accent }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 text-center">
      <p className="flex items-center justify-center gap-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">
        <Icon className="h-3.5 w-3.5" aria-hidden />
        {label}
      </p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${accent}`}>{value}</p>
    </div>
  );
}

function CopyButton({ text, label = "Copy" }) {
  const [state, setState] = useState("idle");
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      setState("failed");
    }
    setTimeout(() => setState("idle"), 2000);
  };
  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
    >
      <ClipboardCopy className="h-3.5 w-3.5" aria-hidden />
      {state === "copied" ? "Copied" : state === "failed" ? "Copy failed — use the preview" : label}
    </button>
  );
}

function JsonPreview({ summary, json }) {
  if (!json) return null;
  return (
    <details className="w-full">
      <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-700">{summary}</summary>
      <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-slate-900 p-3 text-[11px] leading-relaxed text-slate-100">
        {json}
      </pre>
    </details>
  );
}
