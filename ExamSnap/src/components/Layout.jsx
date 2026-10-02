import { useEffect, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, ShieldCheck, Flag } from "lucide-react";
import { useT } from "../i18n/index.jsx";
import LangToggle from "./LangToggle.jsx";
import OutcomePrompt from "./OutcomePrompt.jsx";
import RejectionForm from "./RejectionForm.jsx";
import { initQueueFlush } from "../lib/submissionQueue.js";
import { pingVisit } from "../lib/visit.js";

// App shell: branded header ("ExamSnap by Quick AI"), content outlet, privacy footer.
// On any non-home page the header shows a Back control so users are never stuck — handy
// since exam pages are often entered directly from search results.
export default function Layout() {
  const t = useT();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const isHome = pathname === "/";
  const [showReject, setShowReject] = useState(false);

  // Flush queued submissions + record one visit per session (best-effort, client only).
  useEffect(() => {
    initQueueFlush();
    pingVisit();
  }, []);

  // Prefer in-app history (preserves scroll/state); fall back to the exam list for visitors
  // who landed directly on an exam page from search (no in-app history to go back to).
  const goBack = () => {
    if (typeof window !== "undefined" && window.history.state && window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/");
    }
  };

  return (
    <div className="flex flex-col min-h-[100dvh]">
      <header className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            {!isHome && (
              <button
                type="button"
                onClick={goBack}
                aria-label={t("nav.back")}
                className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
              >
                <ArrowLeft className="w-4 h-4" aria-hidden />
                <span className="hidden sm:inline">{t("nav.back")}</span>
              </button>
            )}
            <Link to="/" className="flex items-baseline gap-1.5 min-w-0">
              <span className="text-lg font-bold text-blue-600">{t("brand")}</span>
              <span className="text-xs text-slate-400 truncate">{t("brandBy")}</span>
            </Link>
          </div>
          <LangToggle />
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-6xl px-4 sm:px-6 py-6">
        <Outlet />
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" aria-hidden />
            {t("privacy")}
          </span>
          <button
            type="button"
            onClick={() => setShowReject(true)}
            className="inline-flex items-center gap-1 text-slate-500 hover:text-blue-600 hover:underline"
          >
            <Flag className="w-3.5 h-3.5" aria-hidden />
            {t("footer.rejected")}
          </button>
          <Link to="/privacy" className="hover:text-blue-600 hover:underline">
            {t("footer.privacy")}
          </Link>
        </div>
      </footer>

      <OutcomePrompt />
      {showReject && <RejectionForm onClose={() => setShowReject(false)} />}
    </div>
  );
}
