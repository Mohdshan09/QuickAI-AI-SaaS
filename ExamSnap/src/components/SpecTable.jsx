import { AlertTriangle, ExternalLink, CalendarCheck } from "lucide-react";
import { useT } from "../i18n/index.jsx";

// Plain-language spec table for an exam (spec §FR-2/3): per-document dimensions, size range
// and background, plus the official source link + last-verified date. Shows a prominent
// warning when an exam's values are not yet verified against the official notification.
export default function SpecTable({ exam }) {
  const t = useT();

  const sizeText = (d) => {
    if (d.minKb > 0 && Number.isFinite(d.maxKb)) return `${d.minKb}–${d.maxKb} KB`;
    if (Number.isFinite(d.maxKb)) return `≤ ${d.maxKb} KB`;
    if (d.minKb > 0) return `≥ ${d.minKb} KB`;
    return "—";
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      {!exam.verified && (
        <p className="flex items-start gap-2 bg-amber-50 text-amber-800 text-sm px-4 py-2 border-b border-amber-200">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden />
          {t(exam.usesGenericDefaults ? "exam.genericWarning" : "exam.unverifiedWarning")}
        </p>
      )}

      <div className="px-4 pt-4">
        <h2 className="text-sm font-semibold text-slate-700">{t("exam.requiredDocs")}</h2>
      </div>

      <table className="w-full text-sm mt-2">
        <thead>
          <tr className="text-left text-slate-400">
            <th className="px-4 py-2 font-medium">Document</th>
            <th className="px-4 py-2 font-medium">Dimensions</th>
            <th className="px-4 py-2 font-medium">Size</th>
            <th className="px-4 py-2 font-medium">Background</th>
          </tr>
        </thead>
        <tbody>
          {exam.documents.map((d, i) => (
            <tr key={i} className="border-t border-slate-100">
              <td className="px-4 py-2 font-medium text-slate-800">{d.label}</td>
              <td className="px-4 py-2 text-slate-600">
                {d.width}×{d.height}px
              </td>
              <td className="px-4 py-2 text-slate-600">{sizeText(d)}</td>
              <td className="px-4 py-2 text-slate-600 capitalize">{d.background}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="px-4 py-3 border-t border-slate-100 text-xs text-slate-500 flex flex-wrap gap-x-4 gap-y-1">
        <span className="inline-flex items-center gap-1">
          {t("exam.officialSource")}:{" "}
          {exam.sourceUrl ? (
            <a
              href={exam.sourceUrl}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="inline-flex items-center gap-1 text-blue-600 hover:underline break-all"
            >
              {exam.sourceUrl}
              <ExternalLink className="w-3 h-3 shrink-0" aria-hidden />
            </a>
          ) : (
            "—"
          )}
        </span>
        <span className="inline-flex items-center gap-1">
          <CalendarCheck className="w-3.5 h-3.5 shrink-0" aria-hidden />
          {t("exam.lastVerified")}: {exam.lastVerified || t("exam.notVerified")}
        </span>
      </div>
    </div>
  );
}
