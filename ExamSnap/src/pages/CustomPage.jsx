import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Head } from "vite-react-ssg";
import { buildCustomExam } from "../specs/loadSpecs.js";
import ClientToolFlow from "../components/ClientToolFlow.jsx";
import SpecTable from "../components/SpecTable.jsx";
import { useT } from "../i18n/index.jsx";
import { getJson } from "../lib/apiClient.js";
import { getAnonId } from "../lib/anonId.js";
import { sendOrQueue } from "../lib/submissionQueue.js";
import { saveRecentExam } from "../lib/recentExams.js";

// Custom mode (spec §FR-4). KB-first: most users only know the KB limit, so they pick a
// document type (which sets a safe default size) and enter the KB range. Exact pixels are
// optional (advanced) for exams that specify them. Validation still runs; download may be
// overridden with a warning (§FR-18).
export default function CustomPage() {
  const t = useT();
  const location = useLocation();
  const restoredPreset = location.state?.preset || null;
  const [form, setForm] = useState(restoredPreset || {
    name: "", type: "photo", minKb: "", maxKb: "", width: "", height: "", notifUrl: "",
  });
  const [showPx, setShowPx] = useState(false);
  const [exam, setExam] = useState(() => restoredPreset ? buildCustomExam(restoredPreset) : null);
  const [presets, setPresets] = useState([]);
  const [loadingPresets, setLoadingPresets] = useState(false);

  // Look up exact-name community presets after the student has stopped typing. The API never
  // returns identity or image data; it only returns previously submitted dimensions and KB caps.
  useEffect(() => {
    const name = form.name.trim();
    if (name.length < 3) {
      setPresets([]);
      return undefined;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoadingPresets(true);
      try {
        const data = await getJson(`spec-submissions?examName=${encodeURIComponent(name)}`);
        if (!cancelled) setPresets(Array.isArray(data.presets) ? data.presets : []);
      } catch {
        if (!cancelled) setPresets([]);
      } finally {
        if (!cancelled) setLoadingPresets(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [form.name]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  // Only the max KB is required; pixels are optional.
  const canSubmit = Number(form.maxKb) > 0;

  const submit = (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    const hasPx = Number(form.width) > 0 && Number(form.height) > 0;
    const values = {
      name: form.name.trim() || undefined,
      type: form.type,
      minKb: Number(form.minKb) || 0,
      maxKb: Number(form.maxKb),
      ...(hasPx ? { width: Number(form.width), height: Number(form.height) } : {}),
    };
    setExam(buildCustomExam(values));
    saveRecentExam({ key: `custom:${values.name || "size"}:${values.type}:${values.width || 0}x${values.height || 0}:${values.minKb}-${values.maxKb}`, kind: "custom", name: values.name || "Custom size", preset: { ...form } });

    // Save as soon as the student chooses the dimensions, rather than waiting for a download.
    // This is best-effort and offline-safe; anonymous submissions contain no image data.
    if (values.name) {
      sendOrQueue("spec-submissions", {
        examName: values.name,
        documents: [{
          type: values.type,
          width: hasPx ? Number(form.width) : null,
          height: hasPx ? Number(form.height) : null,
          minKb: values.minKb,
          maxKb: values.maxKb,
        }],
        notificationUrl: form.notifUrl.trim() || null,
        anonId: getAnonId(),
      });
    }
  };

  const usePreset = (preset) => {
    const doc = preset.documents?.find((item) => item.type === form.type) || preset.documents?.[0];
    if (!doc) return;
    setForm((current) => ({
      ...current,
      type: doc.type === "signature" ? "signature" : "photo",
      minKb: String(doc.minKb || ""),
      maxKb: String(doc.maxKb || ""),
      width: doc.width == null ? "" : String(doc.width),
      height: doc.height == null ? "" : String(doc.height),
    }));
    setShowPx(doc.width != null && doc.height != null);
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

          {form.name.trim().length >= 3 && (
            <div className="col-span-2 rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm">
              <p className="font-medium text-slate-800">Community-submitted sizes</p>
              <p className="mt-1 text-xs text-slate-600">
                {loadingPresets ? "Checking saved sizes…" : "Check these against the official notification before using them."}
              </p>
              {!loadingPresets && presets.map((preset, index) => {
                const doc = preset.documents?.find((item) => item.type === form.type) || preset.documents?.[0];
                if (!doc) return null;
                const dimensions = doc.width && doc.height ? `${doc.width} × ${doc.height}px` : "Pixels not specified";
                return (
                  <button
                    key={`${index}-${doc.type}-${doc.maxKb}`}
                    type="button"
                    onClick={() => usePreset(preset)}
                    className="mt-2 block w-full rounded-md border border-blue-200 bg-white px-3 py-2 text-left hover:border-blue-500"
                  >
                    Use {doc.type} — {dimensions}, {doc.minKb || 0}–{doc.maxKb || "?"} KB
                    {preset.uses > 1 ? ` · used by ${preset.uses} students` : ""}
                  </button>
                );
              })}
              {!loadingPresets && presets.some((preset) => preset.sourceUrl) && (
                <p className="mt-2 text-xs text-slate-600">Every shared preset includes a contributor-provided official notification link. Confirm it before using a size.</p>
              )}
              {!loadingPresets && presets.length === 0 && (
                <p className="mt-2 text-xs text-slate-500">No saved sizes for this exam yet. Yours will help the next student.</p>
              )}
            </div>
          )}

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
              required={Boolean(form.name.trim())}
              placeholder="https://…"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
            />
            <span className="mt-1 block text-xs text-slate-400">{form.name.trim() ? "Required to share a community preset. Use the official notification link." : t("custom.notifHint")}</span>
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
