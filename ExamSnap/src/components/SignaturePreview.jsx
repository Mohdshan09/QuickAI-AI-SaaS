import { useState } from "react";
import { useT } from "../i18n/index.jsx";

// Signature/thumb/declaration cleanup controls (spec §4.2): before/after toggle, strength
// slider, ink colour, thicken. Changes call onChange(cleanup) so ToolFlow re-runs the engine.
export default function SignaturePreview({ cleanup, originalUrl, processedUrl, faint, onChange }) {
  const t = useT();
  const [showBefore, setShowBefore] = useState(false);
  const set = (patch) => onChange({ ...cleanup, ...patch });

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 mb-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">{t("sig.title")}</h3>
        <button
          type="button"
          onClick={() => setShowBefore((v) => !v)}
          className="text-xs rounded-lg border border-slate-300 px-2 py-1 text-slate-600"
        >
          {showBefore ? t("sig.showAfter") : t("sig.showBefore")}
        </button>
      </div>

      <div className="mt-2 flex justify-center">
        <img
          src={showBefore ? originalUrl : processedUrl}
          alt={showBefore ? t("sig.before") : t("sig.after")}
          className="max-h-40 rounded border border-slate-200 bg-slate-50 object-contain"
        />
      </div>

      {faint && <p className="mt-2 text-xs text-amber-700">{t("sig.faint")}</p>}

      <label className="mt-3 block text-sm text-slate-600">
        {t("sig.strength")}
        <input
          type="range"
          min={0}
          max={1}
          step={0.1}
          value={cleanup.strength}
          onChange={(e) => set({ strength: Number(e.target.value) })}
          className="w-full"
        />
      </label>

      <div className="mt-2 flex flex-wrap items-center gap-4 text-sm">
        <span className="inline-flex items-center gap-2">
          {t("sig.ink")}:
          <label className="inline-flex items-center gap-1">
            <input type="radio" name="ink" checked={cleanup.ink === "original"} onChange={() => set({ ink: "original" })} />
            {t("sig.inkOriginal")}
          </label>
          <label className="inline-flex items-center gap-1">
            <input type="radio" name="ink" checked={cleanup.ink === "black"} onChange={() => set({ ink: "black" })} />
            {t("sig.inkBlack")}
          </label>
        </span>
        <label className="inline-flex items-center gap-1">
          <input type="checkbox" checked={cleanup.thicken} onChange={(e) => set({ thicken: e.target.checked })} />
          {t("sig.thicken")}
        </label>
      </div>
    </div>
  );
}
