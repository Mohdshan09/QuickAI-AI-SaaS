// Minimal i18n: a locale context + `t(key, vars)` with {var} interpolation. Deliberately
// tiny (no i18n framework) to protect the bundle budget.
//
// The locale comes from the route (/hi/… renders Hindi, everything else English), never from
// storage — so the prerendered HTML, the canonical URL and the hreflang pair always describe
// the same language, and a shared link keeps the reader's language.

import { createContext, useCallback, useContext, useMemo } from "react";
import en from "./locale/en.json";
import hi from "./locale/hi.json";

const DICTS = { en, hi };
const LocaleContext = createContext({ lang: "en", t: (k) => k });

function interpolate(str, vars) {
  if (!vars) return str;
  return str.replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : `{${k}}`));
}

export function LocaleProvider({ lang = "en", children }) {
  const t = useCallback(
    (key, vars) => {
      const value = DICTS[lang]?.[key] ?? DICTS.en[key] ?? key;
      return interpolate(value, vars);
    },
    [lang],
  );
  const value = useMemo(() => ({ lang, t }), [lang, t]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  return useContext(LocaleContext);
}

export function useT() {
  return useContext(LocaleContext).t;
}

/** Prefix an app path with a locale: ("hi", "/custom") → "/hi/custom", ("en", "/") → "/". */
export function localePath(lang, path = "/") {
  const clean = path.startsWith("/") ? path : `/${path}`;
  if (lang !== "hi") return clean;
  return clean === "/" ? "/hi" : `/hi${clean}`;
}

/** Drop the Hindi prefix: "/hi/ssc" → "/ssc", "/hi" → "/", "/custom" → "/custom". */
export function stripLocale(path) {
  if (path === "/hi") return "/";
  return path.startsWith("/hi/") ? path.slice(3) : path;
}

/** Turn an app path into the active locale's URL (for links and redirects). */
export function useLocalePath() {
  const { lang } = useLocale();
  return useCallback((path) => localePath(lang, path), [lang]);
}
