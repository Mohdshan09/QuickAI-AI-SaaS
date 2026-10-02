import { useT } from "../i18n/index.jsx";

// Name & date strip inputs (spec §4.4). Values stay on the device; changing them re-runs the
// engine so the strip updates live. Date defaults to today, editable (P2-FR-46).
export default function StripForm({ strip, value, onChange }) {
  const t = useT();
  const set = (patch) => onChange({ ...value, ...patch });
  const lines = strip.lines || ["name", "date"];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 mb-3">
      <h3 className="text-sm font-semibold text-slate-700">{t("strip.title")}</h3>
      {lines.includes("name") && (
        <label className="mt-2 block text-sm text-slate-600">
          {t("strip.name")}
          <input
            type="text"
            value={value.name}
            onChange={(e) => set({ name: e.target.value })}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
          />
        </label>
      )}
      {lines.includes("date") && (
        <label className="mt-2 block text-sm text-slate-600">
          {t("strip.date")}
          <input
            type="date"
            value={toInputDate(value.date)}
            onChange={(e) => set({ date: e.target.value ? new Date(e.target.value) : new Date() })}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
          />
        </label>
      )}
    </div>
  );
}

function toInputDate(d) {
  const date = d instanceof Date ? d : new Date();
  return date.toISOString().slice(0, 10);
}
