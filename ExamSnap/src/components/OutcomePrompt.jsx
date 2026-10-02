import { useEffect, useState } from "react";
import { useT } from "../i18n/index.jsx";
import { getDueRecord, markAnswered, bumpDismissal } from "../lib/outcomeStore.js";
import { sendOrQueue } from "../lib/submissionQueue.js";
import { getAnonId } from "../lib/anonId.js";
import RejectionForm from "./RejectionForm.jsx";

// Next-visit outcome prompt (spec §8.2). On load, if a download record is 1 hour–14 days old and
// unanswered, ask whether the portal accepted the files. "Yes" → accepted outcome; "No" → the
// rejection form; "Haven't uploaded yet" → ask again next visit (stops after two dismissals).
// Runs only in the browser (IndexedDB lookup is in an effect, so SSG renders nothing).
export default function OutcomePrompt() {
  const t = useT();
  const [record, setRecord] = useState(null);
  const [showReject, setShowReject] = useState(false);

  useEffect(() => {
    getDueRecord().then(setRecord).catch(() => {});
  }, []);

  if (!record) return null;

  const examName = record.examName || "your exam";

  const onYes = async () => {
    await sendOrQueue("outcomes", {
      examRef: record.examRef,
      examName: record.examName || null,
      specHash: record.specHash || null,
      result: "accepted",
      documentType: null,
      anonId: getAnonId(),
    });
    await markAnswered(record.examRef);
    setRecord(null);
  };

  const onLater = async () => {
    await bumpDismissal(record.examRef);
    setRecord(null);
  };

  const onRejectDone = async () => {
    await markAnswered(record.examRef);
    setShowReject(false);
    setRecord(null);
  };

  if (showReject) {
    const examLike = {
      id: record.examRef,
      name: record.examName,
      documents: (record.documentTypes || []).map((type) => ({ type })),
      sourceUrl: record.sourceUrl || "",
    };
    return <RejectionForm exam={examLike} specHash={record.specHash} onClose={onRejectDone} />;
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 p-3 sm:p-4">
      <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-4 shadow-lg">
        <p className="text-sm font-semibold text-slate-800">{t("outcome.title", { exam: examName })}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={onYes} className="rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white">
            {t("outcome.yes")}
          </button>
          <button type="button" onClick={() => setShowReject(true)} className="rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white">
            {t("outcome.no")}
          </button>
          <button type="button" onClick={onLater} className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600">
            {t("outcome.later")}
          </button>
        </div>
      </div>
    </div>
  );
}
