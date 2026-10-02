import { useState } from "react";
import { Link } from "react-router-dom";
import { Head } from "vite-react-ssg";
import { buildCustomExam } from "../specs/loadSpecs.js";
import ClientToolFlow from "../components/ClientToolFlow.jsx";
import SpecTable from "../components/SpecTable.jsx";
import { useT } from "../i18n/index.jsx";

// Custom mode (spec §FR-4). KB-first: most users only know the KB limit, so they pick a
// document type (which sets a safe default size) and enter the KB range. Exact pixels are
// optional (advanced) for exams that specify them. Validation still runs; download may be
// overridden with a warning (§FR-18).
export default function CustomPage() {
  const t = useT();
  const [form, setForm] = useState({
    name: "", type: "photo", minKb: "", maxKb: "", width: "", height: "", notifUrl: "",
  });
  const [showPx, setShowPx] = useState(false);
  const [exam, setExam] = useState(null);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  // Only the max KB is required; pixels are optional.
  const canSubmit = Number(form.maxKb) > 0;

  const submit = (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    const hasPx = Number(form.width) > 0 && Number(form.height) > 0;
    setExam(
      buildCustomExam({
        name: form.name.trim() || undefined,
        type: form.type,
        minKb: Number(form.minKb) || 0,
        maxKb: Number(form.maxKb),
        ...(hasPx ? { width: Number(form.width), height: Number(form.height) } : {}),
      }),
    );
  };

  const submitUnlisted = { name: form.name.trim(), notificationUrl: form.notifUrl.trim() };

  return (
    <div>
      <Head>
        <title>Custom photo & signature size — ExamSnap by Quick AI</title>
        <meta
          name="description"
          content="Just enter your exam's KB size and we'll resize and compress your photo or signature to fit — free, on your device. Pixel size optional."
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
          <label className="col-span-2 text-sm">
            <span className="block text-slate-600 mb-1">{t("custom.examName")}</span>
            <input
              type="text"
              value={form.name}
              onChange={set("name")}
              maxLength={120}
              placeholder="e.g. State PSC Clerk"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
            />
            <span className="mt-1 block text-xs text-slate-400">{t("custom.examNameHint")}</span>
          </label>

          <fieldset className="col-span-2">
            <legend className="text-sm text-slate-600 mb-1">{t("custom.type")}</legend>
            <div className="inline-flex rounded-lg border border-slate-300 overflow-hidden">
              {["photo", "signature"].map((ty) => (
                <button
                  key={ty}
                  type="button"
                  aria-pressed={form.type === ty}
                  onClick={() => setForm((f) => ({ ...f, type: ty }))}
                  className={`px-4 py-2 text-sm ${
                    form.type === ty ? "bg-blue-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {t(ty === "photo" ? "custom.typePhoto" : "custom.typeSignature")}
                </button>
              ))}
            </div>
          </fieldset>

          <Field label={t("custom.minKb")} value={form.minKb} onChange={set("minKb")} />
          <Field label={t("custom.maxKb")} value={form.maxKb} onChange={set("maxKb")} />

          {/* Pixels are optional — only exams that state an exact pixel size need them. */}
          <div className="col-span-2">
            <button
              type="button"
              onClick={() => setShowPx((v) => !v)}
              className="text-sm text-blue-600 hover:underline"
            >
              {showPx ? "− " : "+ "}{t("custom.pxToggle")}
            </button>
            {showPx && (
              <div className="mt-2 grid grid-cols-2 gap-3">
                <Field label={t("custom.width")} value={form.width} onChange={set("width")} />
                <Field label={t("custom.height")} value={form.height} onChange={set("height")} />
                <span className="col-span-2 text-xs text-slate-400">{t("custom.pxHint")}</span>
              </div>
            )}
          </div>

          <label className="col-span-2 text-sm">
            <span className="block text-slate-600 mb-1">{t("custom.notifUrl")}</span>
            <input
              type="url"
              inputMode="url"
              value={form.notifUrl}
              onChange={set("notifUrl")}
              maxLength={500}
              placeholder="https://…"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
            />
            <span className="mt-1 block text-xs text-slate-400">{t("custom.notifHint")}</span>
          </label>

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
            <ClientToolFlow exam={exam} allowOverride submitUnlisted={submitUnlisted} />
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
