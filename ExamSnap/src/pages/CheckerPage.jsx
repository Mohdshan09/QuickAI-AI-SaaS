import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ClientOnly } from "vite-react-ssg";
import { CheckCircle2, XCircle, AlertTriangle, Wrench } from "lucide-react";
import { getExamBySlug, getListedExams } from "../specs/loadSpecs.js";
import SpecTable, { SpecWarning } from "../components/SpecTable.jsx";
import Uploader from "../components/Uploader.jsx";
import ClientToolFlow from "../components/ClientToolFlow.jsx";
import Seo from "../components/Seo.jsx";
import { siteUrl } from "../lib/site.js";
import { track, EVENTS } from "../lib/analytics.js";
import { useLocalePath, useT } from "../i18n/index.jsx";

// Checker mode (spec §4.1): upload an existing file and see pass/fail/warn against the exam
// spec, then "Fix it" into the normal pipeline. Prerendered per exam (P2-FR-9).
export default function CheckerPage() {
  const t = useT();
  const lp = useLocalePath();
  const { slug } = useParams();
  const exam = getExamBySlug(slug);

  if (!exam) {
    return (
      <div className="text-center py-16">
        <p className="text-slate-600">{t("home.noResults")}</p>
        <Link to={lp("/")} className="mt-4 inline-block text-blue-600 hover:underline">
          ← {t("brand")}
        </Link>
      </div>
    );
  }

  const title = t("seo.check.title", { name: exam.name });
  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "ExamSnap", item: siteUrl(lp("/")) },
      { "@type": "ListItem", position: 2, name: exam.name, item: siteUrl(lp(`/${exam.slug}`)) },
      {
        "@type": "ListItem",
        position: 3,
        name: t("checker.tab"),
        item: siteUrl(lp(`/check/${exam.slug}`)),
      },
    ],
  };

  return (
    <div>
      <Seo
        path={`/check/${exam.slug}`}
        title={title}
        description={t("seo.check.desc", { name: exam.name })}
        jsonLd={breadcrumb}
      />

      <nav className="text-sm text-slate-400 mb-3">
        <Link to={lp("/")} className="hover:underline">{t("brand")}</Link> /{" "}
        <Link to={lp(`/${exam.slug}`)} className="hover:underline">{exam.name}</Link> / {t("checker.tab")}
      </nav>
      <h1 className="text-2xl font-bold text-slate-900">{t("checker.title", { exam: exam.name })}</h1>

      {!exam.verified && (
        <SpecWarning className="mt-4 rounded-xl border border-amber-200 sm:hidden" />
      )}

      <div className="mt-5 grid gap-6 lg:grid-cols-5 items-start">
        <div className="order-2 min-w-0 lg:order-1 lg:col-span-2 lg:sticky lg:top-20">
          <SpecTable exam={exam} />
        </div>
        <div className="order-1 min-w-0 lg:order-2 lg:col-span-3">
          <ClientOnly>{() => <Checker exam={exam} />}</ClientOnly>
        </div>
      </div>
    </div>
  );
}

function Checker({ exam }) {
  const t = useT();
  const docs = exam.processableDocuments?.length ? exam.processableDocuments : exam.documents;
  const [docIndex, setDocIndex] = useState(0);
  const [file, setFile] = useState(null);
  const [report, setReport] = useState(null);
  const [busy, setBusy] = useState(false);
  const [fixing, setFixing] = useState(false);
  const doc = docs[docIndex];

  const selectDoc = (index) => {
    setDocIndex(index);
    setFile(null);
    setReport(null);
    setFixing(false);
  };

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
      {docs.length > 1 && (
        <fieldset className="mb-4">
          <legend className="mb-2 text-sm font-medium text-slate-700">{t("checker.chooseDoc")}</legend>
          <div className="flex flex-wrap gap-2">
            {docs.map((item, index) => (
              <button
                key={item.type}
                type="button"
                aria-pressed={docIndex === index}
                onClick={() => selectDoc(index)}
                className={`rounded-full px-3 py-1.5 text-sm ${docIndex === index ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </fieldset>
      )}
      <Uploader onFile={setFile} docLabel={t("checker.upload")} />
      {busy && <p className="mt-4 text-center text-slate-500">{t("upload.processing")}</p>}

      {report && !report.error && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">
            {t("checker.detectedFormat")}: <span className="font-medium text-slate-800">{report.format}</span>
          </p>
          <ul className="mt-3 space-y-1">
            {report.hard.checks.map((c) => (
              <li key={c.rule} className="flex items-start justify-between gap-3 text-sm">
                <span className="flex min-w-0 items-start gap-2">
                  {c.ok ? <CheckCircle2 className="mt-0.5 w-4 h-4 shrink-0 text-green-600" /> : <XCircle className="mt-0.5 w-4 h-4 shrink-0 text-red-600" />}
                  <span className={c.ok ? "text-slate-700" : "text-red-600"}>{c.label}</span>
                </span>
                <span className="shrink-0 text-right text-slate-500">{c.actual}{!c.ok && <span className="block text-xs text-slate-400">{t("checker.need", { expected: c.expected })}</span>}</span>
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
              {t("checker.fixThis", { doc: doc.label.toLowerCase() })}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Prerender a checker page per exam (parallel to the exam pages). `prefix` is "" or "/hi".
export function getStaticPaths(prefix = "") {
  return getListedExams().map((e) => `${prefix}/check/${e.slug}`);
}
