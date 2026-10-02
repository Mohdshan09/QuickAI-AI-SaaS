// Minimal i18n: a locale context + `t(key, vars)` with {var} interpolation. Deliberately
// tiny (no i18n framework) to protect the bundle budget. English ships now; Hindi is a
// JSON drop-in (locale/hi.json) that falls back to English for any missing key.

import { createContext, useContext, useCallback, useState, useEffect } from "react";
import en from "./locale/en.json";
import hi from "./locale/hi.json";

const DICTS = { en, hi };
const STORAGE_KEY = "examsnap:lang";
const LocaleContext = createContext({ lang: "en", setLang: () => {}, t: (k) => k });

function interpolate(str, vars) {
  if (!vars) return str;
  return str.replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : `{${k}}`));
}

export function LocaleProvider({ children }) {
  const [lang, setLangState] = useState("en");

  // Restore a saved choice on the client (SSG renders English first).
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && DICTS[saved]) setLangState(saved);
    } catch {
      /* storage blocked — stay on default */
    }
  }, []);

  const setLang = useCallback((next) => {
    if (!DICTS[next]) return;
    setLangState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const t = useCallback(
    (key, vars) => {
      const value = DICTS[lang]?.[key] ?? DICTS.en[key] ?? key;
      return interpolate(value, vars);
    },
    [lang],
  );

  return <LocaleContext.Provider value={{ lang, setLang, t }}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  return useContext(LocaleContext);
}

export function useT() {
  return useContext(LocaleContext).t;
}
