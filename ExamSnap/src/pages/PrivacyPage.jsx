import { Link } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import Seo from "../components/Seo.jsx";
import { useLocalePath, useT } from "../i18n/index.jsx";

// Privacy page (spec §10). ExamSnap sends a little NON-image data off-device (exam names,
// spec numbers, outcomes, an anonymous ID) to improve the catalog. Images and personal data
// still never leave the device. This page states exactly what is and isn't stored.
export default function PrivacyPage() {
  const t = useT();
  const lp = useLocalePath();
  return (
    <div className="max-w-prose">
      <Seo
        path="/privacy"
        title={t("seo.privacy.title")}
        description={t("seo.privacy.desc")}
      />

      <nav className="text-sm text-slate-400 mb-3">
        <Link to={lp("/")} className="hover:underline">{t("brand")}</Link> / {t("footer.privacy")}
      </nav>

      <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
        <ShieldCheck className="w-6 h-6 text-blue-600" aria-hidden />
        {t("privacyPage.h1")}
      </h1>

      <p className="mt-4 text-slate-700">
        {t("privacyPage.intro1")} <strong>{t("privacyPage.introStrong")}</strong>
        {t("privacyPage.intro2")}
      </p>

      <h2 className="mt-6 text-lg font-semibold text-slate-800">{t("privacyPage.storeTitle")}</h2>
      <p className="mt-2 text-slate-600">{t("privacyPage.storeIntro")}</p>
      <ul className="mt-2 list-disc pl-5 text-slate-600 space-y-1">
        <li>{t("privacyPage.store1")}</li>
        <li>{t("privacyPage.store2")}</li>
        <li>{t("privacyPage.store3")}</li>
        <li>{t("privacyPage.store4")}</li>
        <li>{t("privacyPage.store5")}</li>
      </ul>

      <h2 className="mt-6 text-lg font-semibold text-slate-800">{t("privacyPage.neverTitle")}</h2>
      <ul className="mt-2 list-disc pl-5 text-slate-600 space-y-1">
        <li>{t("privacyPage.never1")}</li>
        <li>{t("privacyPage.never2")}</li>
        <li>{t("privacyPage.never3")}</li>
      </ul>

      <h2 className="mt-6 text-lg font-semibold text-slate-800">{t("privacyPage.anonTitle")}</h2>
      <p className="mt-2 text-slate-600">{t("privacyPage.anonBody")}</p>

      <p className="mt-6 text-sm text-slate-400">{t("privacyPage.footnote")}</p>
    </div>
  );
}
