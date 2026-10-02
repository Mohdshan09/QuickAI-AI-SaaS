import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Head, ClientOnly } from "vite-react-ssg";
import { CheckCircle2, XCircle, AlertTriangle, Wrench } from "lucide-react";
import { getExamBySlug, getListedExams } from "../specs/loadSpecs.js";
import SpecTable from "../components/SpecTable.jsx";
import Uploader from "../components/Uploader.jsx";
import ClientToolFlow from "../components/ClientToolFlow.jsx";
import { track, EVENTS } from "../lib/analytics.js";
import { useT } from "../i18n/index.jsx";

// Checker mode (spec §4.1): upload an existing file and see pass/fail/warn against the exam
// spec, then "Fix it" into the normal pipeline. Prerendered per exam (P2-FR-9).
export default function CheckerPage() {
  const t = useT();
  const { slug } = useParams();
  const exam = getExamBySlug(slug);

  if (!exam) {
    return (
      <div className="text-center py-16">
        <p className="text-slate-600">{t("home.noResults")}</p>
        <Link to="/" className="mt-4 inline-block text-blue-600 hover:underline">
          ← {t("brand")}
        </Link>
      </div>
    );
  }

  const doc = exam.documents[0];
  const title = `Check your ${exam.name} photo & signature — ExamSnap`;

  return (
    <div>
      <Head>
        <title>{title}</title>
        <meta
          name="description"
          content={`Upload your ${exam.name} photo or signature and instantly see whether it meets the required format, size and dimensions — free and private.`}
        />
        <link rel="canonical" href={`https://quickai.com/examsnap/check/${exam.slug}`} />
      </Head>

      <nav className="text-sm text-slate-400 mb-3">
        <Link to="/" className="hover:underline">{t("brand")}</Link> /{" "}
        <Link to={`/${exam.slug}`} className="hover:underline">{exam.name}</Link> / {t("checker.tab")}
      </nav>
      <h1 className="text-2xl font-bold text-slate-900">{t("checker.title", { exam: exam.name })}</h1>

      <div className="mt-5 grid gap-6 lg:grid-cols-5 items-start">
        <div className="lg:col-span-2 lg:sticky lg:top-20">
          <SpecTable exam={exam} />
        </div>
        <div className="lg:col-span-3">
          <ClientOnly>{() => <Checker exam={exam} doc={doc} />}</ClientOnly>
        </div>
      </div>
    </div>
  );
}

function Checker({ exam, doc }) {
  const t = useT();
  const [file, setFile] = useState(null);
  const [report, setReport] = useState(null);
  const [busy, setBusy] = useState(false);
  const [fixing, setFixing] = useState(false);

  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    setBusy(true);
    import("../engine/checker.js")
      .then(({ check }) => check(file, doc))
      .then((r) => {
        if (cancelled) return;
        setReport(r);
        track(EVENTS.CHECKER_RESULT, {
          exam: exam.slug,
          failing: r.hard.checks.filter((c) => !c.ok).map((c) => c.rule),
        });
      })
      .catch(() => !cancelled && setReport({ error: true }))
      .finally(() => !cancelled && setBusy(false));
    return () => {
      cancelled = true;
    };
  }, [file, doc, exam.slug]);

  if (fixing) return <ClientToolFlow exam={exam} initialFile={file} />;

  return (
    <div>
      <Uploader onFile={setFile} docLabel={t("checker.upload")} />
      {busy && <p className="mt-4 text-center text-slate-500">{t("upload.processing")}</p>}

      {report && !report.error && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">
            {t("checker.detectedFormat")}: <span className="font-medium text-slate-800">{report.format}</span>
          </p>
          <ul className="mt-3 space-y-1">
            {report.hard.checks.map((c) => (
              <li key={c.rule} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  {c.ok ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <XCircle className="w-4 h-4 text-red-600" />}
                  <span className={c.ok ? "text-slate-700" : "text-red-600"}>{c.label}</span>
                </span>
                <span className="text-slate-500">{c.actual}{!c.ok && <span className="text-slate-400"> (need {c.expected})</span>}</span>
              </li>
            ))}
            {report.soft.map((w, i) => (
              <li key={`w${i}`} className="flex items-center gap-2 text-sm text-amber-700">
                <AlertTriangle className="w-4 h-4" /> {w.message}
              </li>
            ))}
          </ul>

          <p className={`mt-3 text-sm font-medium ${report.hard.pass ? "text-green-700" : "text-red-600"}`}>
            {report.hard.pass ? t("checker.pass") : t("checker.fail")}
          </p>

          {!report.hard.pass && (
            <button
              type="button"
              onClick={() => setFixing(true)}
              className="mt-3 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 font-medium text-white"
            >
              <Wrench className="w-4 h-4" aria-hidden />
              {t("checker.fixIt")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Prerender a checker page per exam (parallel to the exam pages).
export function getStaticPaths() {
  return getListedExams().map((e) => `/check/${e.slug}`);
}
