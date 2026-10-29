import { Link, useLocation } from "react-router-dom";
import { localePath, stripLocale, useLocale } from "../i18n/index.jsx";

// English / Hindi switch. The language is part of the URL (/hi/…), so each option is a real
// link: crawlers can discover both versions, hreflang stays truthful, and a reload or a shared
// link keeps the reader in the language they chose.
export default function LangToggle() {
  const { lang, t } = useLocale();
  const { pathname } = useLocation();
  const basePath = stripLocale(pathname);

  return (
    <nav
      aria-label={t("lang.switch")}
      className="inline-flex shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white text-sm"
    >
      {["en", "hi"].map((code) => (
        <Link
          key={code}
          to={localePath(code, basePath)}
          aria-current={lang === code ? "page" : undefined}
          className={`px-3 py-1 ${
            lang === code ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-50"
          }`}
        >
          {t(`lang.${code}`)}
        </Link>
      ))}
    </nav>
  );
}
