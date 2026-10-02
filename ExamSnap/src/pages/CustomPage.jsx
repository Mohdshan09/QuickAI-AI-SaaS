import { useState } from "react";
import { Link } from "react-router-dom";
import { Head } from "vite-react-ssg";
import { buildCustomExam } from "../specs/loadSpecs.js";
import ClientToolFlow from "../components/ClientToolFlow.jsx";
import SpecTable from "../components/SpecTable.jsx";
import { useT } from "../i18n/index.jsx";

// Custom mode (spec §FR-4): the user enters width, height and the KB range for an unlisted
// exam. Validation still runs, but download may be overridden with a warning (§FR-18).
export default function CustomPage() {
  const t = useT();
  const [form, setForm] = useState({ width: "", height: "", minKb: "", maxKb: "" });
  const [exam, setExam] = useState(null);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const canSubmit = Number(form.width) > 0 && Number(form.height) > 0 && Number(form.maxKb) > 0;

  const submit = (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setExam(
      buildCustomExam({
        width: Number(form.width),
        height: Number(form.height),
        minKb: Number(form.minKb) || 0,
        maxKb: Number(form.maxKb),
      }),
    );
  };

  return (
    <div>
      <Head>
        <title>Custom photo & signature size — ExamSnap by Quick AI</title>
        <meta
          name="description"
          content="Enter any width, height and KB range to resize and compress a photo or signature to exact specs, free and on your device."
        />
      </Head>

      <nav className="text-sm text-slate-400 mb-3">
        <Link to="/" className="hover:underline">
          {t("brand")}
        </Link>{" "}
        / {t("home.custom")}
      </nav>
      <h1 className="text-2xl font-bold text-slate-900">{t("home.custom")}</h1>
      <p className="mt-2 text-slate-600">{t("home.customDesc")}</p>

      {!exam ? (
        <form onSubmit={submit} className="mt-5 grid grid-cols-2 gap-3 max-w-md">
          <Field label={t("custom.width")} value={form.width} onChange={set("width")} />
          <Field label={t("custom.height")} value={form.height} onChange={set("height")} />
          <Field label={t("custom.minKb")} value={form.minKb} onChange={set("minKb")} />
          <Field label={t("custom.maxKb")} value={form.maxKb} onChange={set("maxKb")} />
          <button
            type="submit"
            disabled={!canSubmit}
            className="col-span-2 rounded-xl bg-blue-600 px-4 py-3 font-medium text-white disabled:opacity-50"
          >
            {t("custom.go")}
          </button>
        </form>
      ) : (
        <div className="mt-5 grid gap-6 lg:grid-cols-5 items-start">
          <div className="lg:col-span-2 lg:sticky lg:top-20">
            <SpecTable exam={exam} />
            <button
              type="button"
              onClick={() => setExam(null)}
              className="mt-4 text-sm text-slate-500 hover:underline"
            >
              ← Change specs
            </button>
          </div>
          <div className="lg:col-span-3">
            <ClientToolFlow exam={exam} allowOverride />
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange }) {
  return (
    <label className="text-sm">
      <span className="block text-slate-600 mb-1">{label}</span>
      <input
        type="number"
        inputMode="numeric"
        min="1"
        value={value}
        onChange={onChange}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
      />
    </label>
  );
}
