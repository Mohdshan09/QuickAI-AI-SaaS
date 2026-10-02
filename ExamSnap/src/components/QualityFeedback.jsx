import { useState } from "react";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { useT } from "../i18n/index.jsx";
import { sendOrQueue } from "../lib/submissionQueue.js";
import { getAnonId } from "../lib/anonId.js";

// "Does this look right?" 👍 / 👎 at the end of a download (spec §8.1). 👎 reveals optional
// quick reasons. Posts one quality-feedback row per processed document type. Minimal and
// non-blocking — quality signal only, never image/personal data.
const REASON_KEYS = ["blurry", "dark", "crop", "bg", "other"];

export default function QualityFeedback({ examRef, documentTypes = [] }) {
  const t = useT();
  const [rating, setRating] = useState(0); // 0 = unanswered, 1 up, -1 down
  const [sent, setSent] = useState(false);

  const post = (value, reason) => {
    const docs = documentTypes.length ? documentTypes : ["photo"];
    for (const dt of docs) {
      sendOrQueue("quality-feedback", {
        examRef,
        documentType: dt,
        rating: value,
        reason: reason || null,
        anonId: getAnonId(),
      });
    }
  };

  const onUp = () => {
    setRating(1);
    post(1);
    setSent(true);
  };
  const onDown = () => {
    setRating(-1);
    post(-1);
  };
  const onReason = (reason) => {
    post(-1, reason); // record the reason alongside the thumbs-down
    setSent(true);
  };

  if (sent) return <p className="mt-4 text-sm text-slate-500">{t("quality.thanks")}</p>;

  return (
    <div className="mt-4 text-left">
      <p className="text-sm font-medium text-slate-700">{t("quality.title")}</p>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={onUp}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-sm hover:border-green-400"
        >
          <ThumbsUp className="w-4 h-4 text-green-600" aria-hidden /> {t("quality.yes")}
        </button>
        <button
          type="button"
          onClick={onDown}
          className={`inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm hover:border-red-400 ${
            rating === -1 ? "border-red-400 bg-red-50" : "border-slate-300"
          }`}
        >
          <ThumbsDown className="w-4 h-4 text-red-600" aria-hidden /> {t("quality.no")}
        </button>
      </div>

      {rating === -1 && (
        <div className="mt-3">
          <p className="text-xs text-slate-500">{t("quality.reasonTitle")}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {REASON_KEYS.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => onReason(k)}
                className="rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-600 hover:border-blue-400"
              >
                {t(`quality.reason.${k}`)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
