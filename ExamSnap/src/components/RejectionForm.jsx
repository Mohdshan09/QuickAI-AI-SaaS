import { useState } from "react";
import { X, ExternalLink } from "lucide-react";
import { useT } from "../i18n/index.jsx";
import { sendOrQueue } from "../lib/submissionQueue.js";
import { getAnonId } from "../lib/anonId.js";
import { normalizeExamName } from "../lib/normalize.js";

// Shared rejection reporter (spec §8.2 "No" + §8.3 always-available "File rejected?" link).
// Two modes: with an `exam` (prefills the reference + document list), or standalone from the
// footer (the user types the exam name). Posts an `outcomes` row with result "rejected". The
// portal error is free text, length-capped, with a note not to include personal details (§FR-F5).
// Never collects or sends any image or personal data.
const MAX_ERROR = 300;
const GENERIC_DOC_TYPES = ["photo", "signature", "thumb", "declaration"];

export default function RejectionForm({ exam = null, specHash = null, onClose }) {
  const t = useT();
  const [examName, setExamName] = useState(exam?.name || "");
  const docTypes = exam ? exam.documents.map((d) => d.type) : GENERIC_DOC_TYPES;
  const [docType, setDocType] = useState(docTypes[0] || "photo");
  const [portalError, setPortalError] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [done, setDone] = useState(false);

  const examRef = exam ? exam.id : normalizeExamName(examName);
  const canSubmit = Boolean(examRef);

  const submit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    await sendOrQueue("outcomes", {
      examRef,
      examName: exam?.name || examName || null,
      specHash: specHash || null,
      result: "rejected",
      documentType: docType,
      portalError: portalError.slice(0, MAX_ERROR) || null,
      anonId: getAnonId(),
      hp: honeypot,
    });
    setDone(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between">
          <h2 className="text-lg font-bold text-slate-900">{t("reject.title")}</h2>
          <button type="button" onClick={onClose} aria-label={t("reject.cancel")} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" aria-hidden />
          </button>
        </div>

        {done ? (
          <div className="mt-4">
            <p className="text-sm text-green-700">{t("reject.thanks")}</p>
            {exam?.sourceUrl && (
              <p className="mt-3 text-sm text-slate-600">
                {t("reject.checkNotif")}{" "}
                <a href={exam.sourceUrl} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-blue-600 hover:underline break-all">
                  {exam.sourceUrl}
                  <ExternalLink className="w-3 h-3 shrink-0" aria-hidden />
                </a>
              </p>
            )}
            <button type="button" onClick={onClose} className="mt-4 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white">
              {t("reject.cancel")}
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-4 space-y-3">
            {!exam && (
              <label className="block text-sm">
                <span className="mb-1 block text-slate-600">{t("custom.examName")}</span>
                <input
                  type="text"
                  value={examName}
                  onChange={(e) => setExamName(e.target.value)}
                  maxLength={120}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
                />
              </label>
            )}

            <label className="block text-sm">
              <span className="mb-1 block text-slate-600">{t("reject.which")}</span>
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-blue-500"
              >
                {docTypes.map((dt) => (
                  <option key={dt} value={dt}>{dt}</option>
                ))}
                <option value="other">{t("reject.docOther")}</option>
              </select>
            </label>

            <label className="block text-sm">
              <span className="mb-1 block text-slate-600">{t("reject.error")}</span>
              <textarea
                value={portalError}
                onChange={(e) => setPortalError(e.target.value.slice(0, MAX_ERROR))}
                rows={3}
                maxLength={MAX_ERROR}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
              />
              <span className="mt-1 block text-xs text-slate-400">{t("reject.errorHint")}</span>
            </label>

            {/* Honeypot: real users never see or fill this; filled submissions are dropped. */}
            <input
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
              className="hidden"
              aria-hidden="true"
            />

            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full rounded-xl bg-blue-600 px-4 py-2.5 font-medium text-white disabled:opacity-50"
            >
              {t("reject.submit")}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
