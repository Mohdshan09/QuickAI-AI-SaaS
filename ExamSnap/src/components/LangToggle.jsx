import { useLocale } from "../i18n/index.jsx";

// English / Hindi switch. Hindi strings land in Phase 2; the toggle is wired now so no
// code changes are needed then.
export default function LangToggle() {
  const { lang, setLang, t } = useLocale();
  return (
    <div className="inline-flex rounded-lg border border-slate-200 bg-white text-sm overflow-hidden">
      {["en", "hi"].map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => setLang(code)}
          aria-pressed={lang === code}
          className={`px-3 py-1 ${
            lang === code ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-50"
          }`}
        >
          {t(`lang.${code}`)}
        </button>
      ))}
    </div>
  );
}
