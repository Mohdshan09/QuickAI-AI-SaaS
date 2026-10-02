import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Info, ListChecks, Loader2, PartyPopper, Sparkles } from "lucide-react";
import Uploader from "./Uploader.jsx";
import Cropper from "./Cropper.jsx";
import ResultPanel from "./ResultPanel.jsx";
import CrossPromo from "./CrossPromo.jsx";
import SignaturePreview from "./SignaturePreview.jsx";
import StripForm from "./StripForm.jsx";
import KitBar from "./KitBar.jsx";
import QualityFeedback from "./QualityFeedback.jsx";
import { runPipeline } from "../lib/processClient.js";
import { downloadBlob, filenameFor } from "../lib/download.js";
import { loadKit, saveKit, clearKit } from "../lib/kitStore.js";
import { track, EVENTS } from "../lib/analytics.js";
import { useT } from "../i18n/index.jsx";
import { normalizeExamName } from "../lib/normalize.js";
import { specHash as computeSpecHash } from "../lib/specHash.js";
import { recordDownload } from "../lib/outcomeStore.js";
import { sendOrQueue } from "../lib/submissionQueue.js";
import { getAnonId } from "../lib/anonId.js";

const INK_TYPES = new Set(["signature", "thumb", "declaration"]);
const defaultOptions = () => ({
  cleanup: { strength: 0.5, ink: "original", thicken: false },
  background: false,
  strip: { name: "", date: new Date() },
});

// Drives the per-document flow for one exam (spec §7 + Phase 2 §4.2–4.5). Phase 2 adds live
// re-processing when adjustments change, and a kit that collects each finished document for a
// ZIP download, persisted to IndexedDB so a mid-kit return resumes.
export default function ToolFlow({ exam, allowOverride = false, initialFile = null, submitUnlisted = null }) {
  const t = useT();
  const docs = exam.processableDocuments || exam.documents;
  const liveDocs = exam.liveDocuments || [];
  // An unlisted/custom exam the user named → we record demand + their entered spec on download.
  const unlistedName = submitUnlisted?.name?.trim() || "";
  const examRef = unlistedName ? normalizeExamName(unlistedName) : exam.id;
  const [docIndex, setDocIndex] = useState(0);
  const [step, setStep] = useState("upload"); // upload | crop | processing | result | done
  const [file, setFile] = useState(null);
  const [originalUrl, setOriginalUrl] = useState(null);
  const [result, setResult] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [error, setError] = useState("");
  const [options, setOptions] = useState(defaultOptions());
  const [lastCrop, setLastCrop] = useState(null);
  const [kit, setKit] = useState([]);

  const doc = docs[docIndex];
  const isInk = INK_TYPES.has(doc.type);
  const needsWhiteBg = doc.type === "photo" && (doc.background === "white" || doc.background === "light");
  const hasStrip = doc.type === "photo" && Boolean(doc.strip);

  // Resume a persisted kit; seed a Fix-it file from the checker.
  useEffect(() => {
    loadKit(exam.slug).then((saved) => saved.length && setKit(saved));
    if (initialFile) handleFile(initialFile);
  }, [exam.slug]);

  useEffect(() => () => previewUrl && URL.revokeObjectURL(previewUrl), [previewUrl]);
  useEffect(() => () => originalUrl && URL.revokeObjectURL(originalUrl), [originalUrl]);

  const reset = () => {
    setFile(null);
    setResult(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    if (originalUrl) URL.revokeObjectURL(originalUrl);
    setOriginalUrl(null);
    setOptions(defaultOptions());
    setLastCrop(null);
    setError("");
  };

  function handleFile(f) {
    setFile(f);
    setOriginalUrl(URL.createObjectURL(f));
    setError("");
    setStep("crop");
    track(EVENTS.UPLOAD_STARTED, { exam: exam.slug, doc: doc.type });
  }

  // Run the engine for the current doc with a crop + options; update result/preview.
  async function runWith(crop, opts) {
    setStep("processing");
    try {
      const res = await runPipeline({ file, docSpec: doc, ...crop, options: opts });
      setResult(res);
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(res.blob);
      });
      setStep("result");
      track(res.validation.pass ? EVENTS.VALIDATION_PASSED : EVENTS.VALIDATION_FAILED, {
        exam: exam.slug,
        doc: doc.type,
        failing: res.validation.checks.filter((c) => !c.ok).map((c) => c.rule),
      });
      return res;
    } catch (e) {
      setError(/heic/i.test(e?.message || "") ? t("error.heic") : t("error.generic"));
      setStep("upload");
      setFile(null);
      return null;
    }
  }

  const handleCrop = async ({ cropPixels, rotationDeg }) => {
    const crop = { cropPixels, rotationDeg };
    setLastCrop(crop);
    track(EVENTS.CROP_DONE, { exam: exam.slug, doc: doc.type });
    await runWith(crop, options);
  };

  // Re-run with changed adjustments (signature strength, background, strip text).
  const rerun = (patch, analytics) => {
    const next = { ...options, ...patch };
    setOptions(next);
    if (analytics) track(analytics.event, { exam: exam.slug, ...analytics.props });
    if (lastCrop) runWith(lastCrop, next);
  };

  const handleDownload = async () => {
    const item = { docType: doc.type, filename: filenameFor(exam.slug, doc.type), blob: result.blob, meta: result.meta };
    const nextKit = [...kit.filter((k) => k.docType !== item.docType), item];
    setKit(nextKit);
    saveKit(exam.slug, nextKit);
    downloadBlob(result.blob, item.filename);
    track(EVENTS.DOWNLOAD, { exam: exam.slug, doc: doc.type });

    // Record this download locally so the next-visit outcome prompt can ask about it (spec §8.2),
    // and gate outcome reporting to specs the user actually processed. Non-blocking, no image data.
    const specHashVal = computeSpecHash(exam.processableDocuments || exam.documents);
    recordDownload({
      examRef,
      examName: unlistedName || exam.name,
      specHash: specHashVal,
      documentTypes: nextKit.map((k) => k.docType),
      slug: exam.slug,
      sourceUrl: exam.sourceUrl || "",
    });

    if (docIndex + 1 < docs.length) {
      setDocIndex((i) => i + 1);
      reset();
      setStep("upload");
    } else {
      track(EVENTS.KIT_COMPLETED, { exam: exam.slug, count: nextKit.length });
      // Unlisted exam processed → record the demand and the user-entered spec (spec §FR-C9).
      if (unlistedName) {
        const documents = (exam.processableDocuments || exam.documents).map((d) => ({
          type: d.type,
          width: d.width ?? null,
          height: d.height ?? null,
          minKb: d.minKb ?? 0,
          maxKb: Number.isFinite(d.maxKb) ? d.maxKb : null,
        }));
        const anonId = getAnonId();
        sendOrQueue("exam-requests", { name: unlistedName, anonId });
        sendOrQueue("spec-submissions", {
          examName: unlistedName,
          documents,
          notificationUrl: submitUnlisted?.notificationUrl?.trim() || null,
          specHash: specHashVal,
          anonId,
        });
      }
      setStep("done");
    }
  };

  const finishKit = () => clearKit(exam.slug);

  // Jump directly to any document (e.g. do the signature before finishing the photo).
  const goToDoc = (i) => {
    if (i === docIndex && step !== "done") return;
    reset();
    setDocIndex(i);
    setStep("upload");
  };

  return (
    <div className="mt-5">
      {liveDocs.length > 0 && <LiveDocsNote docs={liveDocs} />}

      {/* Document progress — each chip is clickable so you can switch documents freely. */}
      <ol className="flex flex-wrap gap-2 mb-4">
        {docs.map((d, i) => {
          const done = kit.some((k) => k.docType === d.type);
          const current = i === docIndex && step !== "done";
          return (
            <li key={i}>
              <button
                type="button"
                onClick={() => goToDoc(i)}
                aria-current={current ? "step" : undefined}
                className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs transition hover:ring-2 hover:ring-blue-300 ${
                  done
                    ? "bg-green-100 text-green-700"
                    : current
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 text-slate-600"
                }`}
              >
                {done && <Check className="w-3 h-3" aria-hidden />}
                {d.label}
              </button>
            </li>
          );
        })}
      </ol>

      {doc?.contentRules?.length > 0 && (step === "upload" || step === "result") && (
        <ContentChecklist docLabel={doc.label} rules={doc.contentRules} />
      )}

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      {step === "upload" && <Uploader onFile={handleFile} docLabel={doc.label} />}

      {step === "crop" && file && (
        <Cropper
          file={file}
          aspect={doc.aspectRatioValue}
          isPhoto={doc.type === "photo"}
          onConfirm={handleCrop}
          onCancel={() => {
            reset();
            setStep("upload");
          }}
        />
      )}

      {step === "processing" && (
        <p className="flex items-center justify-center gap-2 py-10 text-center text-slate-500">
          <Loader2 className="w-5 h-5 animate-spin" aria-hidden />
          {t("upload.processing")}
        </p>
      )}

      {step === "result" && result && (
        <>
          {isInk && (
            <SignaturePreview
              cleanup={options.cleanup}
              originalUrl={originalUrl}
              processedUrl={previewUrl}
              faint={result.meta.faint}
              onChange={(cleanup) =>
                rerun(
                  { cleanup },
                  { event: EVENTS.SIGNATURE_CLEAN_USED, props: { strength: cleanup.strength, thicken: cleanup.thicken } },
                )
              }
            />
          )}

          {needsWhiteBg && (
            <BackgroundControl
              meta={result.meta.background}
              active={options.background === "brighten"}
              onBrighten={() =>
                rerun({ background: "brighten" }, { event: EVENTS.BACKGROUND_TIER_USED, props: { tier: 2 } })
              }
            />
          )}

          {hasStrip && (
            <StripForm
              strip={doc.strip}
              value={options.strip}
              onChange={(strip) => rerun({ strip }, { event: EVENTS.STRIP_USED, props: {} })}
            />
          )}

          <ResultPanel
            result={result}
            previewUrl={previewUrl}
            originalUrl={originalUrl}
            allowOverride={allowOverride}
            onDownload={handleDownload}
            onRedo={() => {
              reset();
              setStep("upload");
            }}
          />
        </>
      )}

      {step === "done" && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-5 text-center">
          <p className="flex items-center justify-center gap-2 text-lg font-semibold text-green-800">
            <PartyPopper className="w-5 h-5" aria-hidden />
            {t("result.done")}
          </p>
          <QualityFeedback examRef={examRef} documentTypes={kit.map((k) => k.docType)} />
          <Link
            to="/"
            onClick={finishKit}
            className="mt-3 inline-block rounded-xl bg-blue-600 px-5 py-2.5 font-medium text-white"
          >
            {t("result.anotherExam")}
          </Link>
          <CrossPromo />
        </div>
      )}

      {/* Kit: ready count, per-file + ZIP download (persists across the flow). */}
      {step !== "crop" && <KitBar exam={exam} kit={kit} />}
    </div>
  );
}

// Documents this exam captures live in the official portal — no upload here, shown for context.
function LiveDocsNote({ docs }) {
  const t = useT();
  return (
    <div className="mb-4 rounded-xl border border-sky-200 bg-sky-50 p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-sky-800">
        <Info className="w-4 h-4 shrink-0" aria-hidden />
        {t("live.title")}
      </p>
      <p className="mt-1 text-sm text-sky-700">
        {t("live.body", { docs: docs.map((d) => d.label.replace(/\s*\(captured live\)/i, "")).join(", ") })}
      </p>
    </div>
  );
}

// User-facing checklist of the official content rules for the current document (spec §content).
function ContentChecklist({ docLabel, rules }) {
  const t = useT();
  return (
    <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-slate-700">
        <ListChecks className="w-4 h-4 shrink-0 text-slate-500" aria-hidden />
        {t("rules.title", { doc: docLabel })}
      </p>
      <ul className="mt-2 space-y-1 text-sm text-slate-600">
        {rules.map((r, i) => (
          <li key={i} className="flex items-start gap-2">
            <Check className="w-3.5 h-3.5 mt-0.5 shrink-0 text-green-600" aria-hidden />
            {r}
          </li>
        ))}
      </ul>
    </div>
  );
}

// Tier 1/2 background control (no ML). Tier 3 is shown as "coming soon" (deferred).
function BackgroundControl({ meta, active, onBrighten }) {
  const t = useT();
  if (!meta) return null;
  if (meta.isWhite) {
    return <p className="mb-3 text-sm text-green-700">✓ {t("bg.alreadyWhite")}</p>;
  }
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 mb-3">
      <h3 className="text-sm font-semibold text-slate-700">{t("bg.title")}</h3>
      <p className="mt-1 text-xs text-slate-500">{t("bg.tip")}</p>
      {meta.leaked && <p className="mt-1 text-xs text-amber-700">{t("bg.leaked")}</p>}
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onBrighten}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white"
        >
          <Sparkles className="w-4 h-4" aria-hidden />
          {active ? t("bg.redo") : t("bg.make")}
        </button>
        <button
          type="button"
          disabled
          title={t("bg.soon")}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-400"
        >
          {t("bg.ml")} · {t("bg.soon")}
        </button>
      </div>
    </div>
  );
}
