import { useState } from "react";
import { CheckCircle2, XCircle, Download, RotateCcw, AlertTriangle } from "lucide-react";
import { useT } from "../i18n/index.jsx";

// Validation checklist + download (spec §FR-16/17/18/20) with a quality-focused preview
// (quality strategy §10): 100%/200% zoom + before/after toggle, plus quality warnings.
// Download is enabled only when all checks pass; Custom mode may override.
export default function ResultPanel({ result, previewUrl, originalUrl, allowOverride, onDownload, onRedo }) {
  const t = useT();
  const { meta, validation } = result;
  const [zoom, setZoom] = useState(100);
  const [showBefore, setShowBefore] = useState(false);

  const handleDownload = () => {
    if (!validation.pass && allowOverride) {
      if (!window.confirm(t("result.overrideWarn"))) return;
    }
    onDownload();
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 sm:flex sm:gap-5">
      <div className="mb-4 sm:mb-0 sm:w-56 sm:shrink-0">
        {previewUrl && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 overflow-auto max-h-64">
            <img
              src={showBefore && originalUrl ? originalUrl : previewUrl}
              alt={showBefore ? "Original" : "Processed output preview"}
              style={{ width: zoom === 200 ? "200%" : "100%", maxWidth: "none" }}
              className="block"
            />
          </div>
        )}
        <div className="mt-2 flex items-center justify-center gap-2 text-xs">
          {originalUrl && (
            <button
              type="button"
              onClick={() => setShowBefore((v) => !v)}
              className="rounded border border-slate-300 px-2 py-1 text-slate-600"
            >
              {showBefore ? t("preview.after") : t("preview.before")}
            </button>
          )}
          <div className="inline-flex rounded border border-slate-300 overflow-hidden">
            {[100, 200].map((z) => (
              <button
                key={z}
                type="button"
                onClick={() => setZoom(z)}
                className={`px-2 py-1 ${zoom === z ? "bg-blue-600 text-white" : "text-slate-600"}`}
              >
                {z}%
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1">
      <h3 className="text-sm font-semibold text-slate-700">{t("result.title")}</h3>
      <ul className="mt-2 space-y-1">
        {validation.checks.map((c) => (
          <li key={c.rule} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">
              {c.ok ? (
                <CheckCircle2 className="w-4 h-4 text-green-600" aria-hidden />
              ) : (
                <XCircle className="w-4 h-4 text-red-600" aria-hidden />
              )}
              <span className={c.ok ? "text-slate-700" : "text-red-600"}>{c.label}</span>
            </span>
            <span className="text-slate-500">
              {c.actual}
              {!c.ok && <span className="text-slate-400"> (need {c.expected})</span>}
            </span>
          </li>
        ))}
      </ul>

      <p
        className={`mt-3 flex items-center gap-1.5 text-sm font-medium ${
          validation.pass ? "text-green-700" : "text-red-600"
        }`}
      >
        {validation.pass ? (
          <CheckCircle2 className="w-4 h-4" aria-hidden />
        ) : (
          <XCircle className="w-4 h-4" aria-hidden />
        )}
        {validation.pass ? t("result.pass") : t("result.fail")}
      </p>

      {meta.sourceSmallerThanTarget && (
        <p className="mt-1 flex items-start gap-1.5 text-xs text-amber-700">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden />
          {t("quality.tooSmall")}
        </p>
      )}
      {meta.padded && (
        <p className="mt-1 flex items-start gap-1.5 text-xs text-slate-500">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden />
          {t("quality.padded")}
        </p>
      )}
      {meta.note && (
        <p className="mt-1 flex items-start gap-1.5 text-xs text-amber-700">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden />
          {meta.note}
        </p>
      )}

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={onRedo}
          className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 font-medium text-slate-700"
        >
          <RotateCcw className="w-4 h-4" aria-hidden />
          {t("result.redo")}
        </button>
        <button
          type="button"
          disabled={!validation.pass && !allowOverride}
          onClick={handleDownload}
          className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 font-medium text-white disabled:opacity-50"
        >
          <Download className="w-4 h-4" aria-hidden />
          {t("result.download")}
        </button>
      </div>
      </div>
    </div>
  );
}
