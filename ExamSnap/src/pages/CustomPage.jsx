import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { buildCustomExam } from "../specs/loadSpecs.js";
import ClientToolFlow from "../components/ClientToolFlow.jsx";
import SpecChat from "../components/SpecChat.jsx";
import SpecTable from "../components/SpecTable.jsx";
import Seo from "../components/Seo.jsx";
import { siteUrl } from "../lib/site.js";
import { useLocalePath, useT } from "../i18n/index.jsx";
import { saveRecentExam } from "../lib/recentExams.js";

// Custom mode (spec §FR-4). A chatbot-style setup (SpecChat) replaces the old form: the student
// types or taps answers ("photo", "10–20 KB", "200x230") and a local parser assembles the spec —
// no server AI, nothing leaves the device. KB-first with a safe default pixel size; exact pixels
// stay optional (advanced). Validation still runs; download may be overridden with a warning.
export default function CustomPage() {
  const t = useT();
  const lp = useLocalePath();
  const location = useLocation();
  const restoredPreset = location.state?.preset || null;
  const [exam, setExam] = useState(() => (restoredPreset ? buildCustomExam(restoredPreset) : null));
  // Last completed chat values, so "change specs" reopens the chat pre-filled (like the old form).
  const [lastSpec, setLastSpec] = useState(null);
  const [chatMeta, setChatMeta] = useState({
    name: restoredPreset?.name || "",
    notificationUrl: restoredPreset?.notifUrl || "",
  });
  // The chat unmounts once the spec is built, so a sent "add this exam" request is confirmed here.
  const [requestedName, setRequestedName] = useState(null);

  const handleChatComplete = (values) => {
    setRequestedName(values.requested ? values.name?.trim() || null : null);
    const hasPx = Number(values.width) > 0 && Number(values.height) > 0;
    const v = {
      name: values.name?.trim() || undefined,
      type: values.type,
      minKb: Number(values.minKb) || 0,
      maxKb: Number(values.maxKb),
      ...(hasPx ? { width: Number(values.width), height: Number(values.height) } : {}),
    };
    setLastSpec(values);
    setChatMeta({ name: values.name?.trim() || "", notificationUrl: values.notifUrl?.trim() || "" });
    setExam(buildCustomExam(v));
    saveRecentExam({
      key: `custom:${v.name || "size"}:${v.type}:${v.width || 0}x${v.height || 0}:${v.minKb}-${v.maxKb}`,
      kind: "custom",
      name: v.name || "Custom size",
      preset: {
        name: values.name || "",
        type: v.type,
        minKb: String(v.minKb || ""),
        maxKb: String(v.maxKb || ""),
        width: String(values.width || ""),
        height: String(values.height || ""),
        notifUrl: values.notifUrl || "",
      },
    });
  };

  const submitUnlisted = chatMeta;

  return (
    <div>
      <Seo
        path="/custom"
        title={t("seo.custom.title")}
        description={t("seo.custom.desc")}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "ExamSnap", item: siteUrl(lp("/")) },
            { "@type": "ListItem", position: 2, name: t("home.custom"), item: siteUrl(lp("/custom")) },
          ],
        }}
      />

      <nav className="text-sm text-slate-400 mb-3">
        <Link to={lp("/")} className="hover:underline">
          {t("brand")}
        </Link>{" "}
        / {t("home.custom")}
      </nav>
      <h1 className="text-2xl font-bold text-slate-900">{t("home.custom")}</h1>
      <p className="mt-2 text-slate-600">{t("home.customDesc")}</p>

      {!exam ? (
        <SpecChat seed={lastSpec} onComplete={handleChatComplete} />
      ) : (
        <>
          {requestedName && (
            <p className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              {t("chat.requestQueued", { name: requestedName })}
            </p>
          )}
          <div className="mt-5 grid gap-6 lg:grid-cols-5 items-start">
            <div className="order-2 min-w-0 lg:order-1 lg:col-span-2 lg:sticky lg:top-20">
              <SpecTable exam={exam} />
              <button
                type="button"
                onClick={() => {
                  setExam(null);
                  setRequestedName(null);
                }}
                className="mt-4 text-sm text-slate-500 hover:underline"
              >
                {t("custom.changeSpecs")}
              </button>
            </div>
            <div className="order-1 min-w-0 lg:order-2 lg:col-span-3">
              <ClientToolFlow exam={exam} allowOverride submitUnlisted={submitUnlisted} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
