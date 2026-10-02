import { useState } from "react";
import { Package, Download } from "lucide-react";
import { downloadBlob } from "../lib/download.js";
import { track, EVENTS } from "../lib/analytics.js";
import { useT } from "../i18n/index.jsx";

// Kit progress + "Download all" ZIP (spec §4.5). Shows how many of the exam's documents are
// ready, keeps individual downloads (P2-FR-53), and builds a STORE-mode ZIP on demand
// (fflate lazy-loaded inside engine/zip.js).
export default function KitBar({ exam, kit }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const total = (exam.processableDocuments || exam.documents).length;

  const downloadAll = async () => {
    setBusy(true);
    try {
      const { buildKitZip } = await import("../engine/zip.js");
      const blob = await buildKitZip(kit, exam.name);
      downloadBlob(blob, `${exam.slug.replace(/-photo-signature-size$/, "")}_kit.zip`);
      track(EVENTS.ZIP_DOWNLOAD, { exam: exam.slug, count: kit.length });
    } finally {
      setBusy(false);
    }
  };

  if (kit.length === 0) return null;

  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-semibold text-slate-700">
        {t("kit.ready", { n: kit.length, total })}
      </p>
      <ul className="mt-2 space-y-1 text-sm">
        {kit.map((item) => (
          <li key={item.docType} className="flex items-center justify-between">
            <span className="text-slate-600">{item.filename}</span>
            <button
              type="button"
              onClick={() => downloadBlob(item.blob, item.filename)}
              className="inline-flex items-center gap-1 text-blue-600 hover:underline"
            >
              <Download className="w-3.5 h-3.5" aria-hidden />
              {t("result.download")}
            </button>
          </li>
        ))}
      </ul>
      {kit.length > 1 && (
        <button
          type="button"
          disabled={busy}
          onClick={downloadAll}
          className="mt-3 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 font-medium text-white disabled:opacity-50"
        >
          <Package className="w-4 h-4" aria-hidden />
          {busy ? t("kit.zipping") : t("kit.downloadAll")}
        </button>
      )}
    </div>
  );
}
