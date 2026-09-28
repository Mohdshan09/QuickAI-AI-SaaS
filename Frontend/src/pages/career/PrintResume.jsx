import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { useCareerApi } from "../../lib/careerApi";
import { applyTailored } from "../../lib/tailorApply";

// The tailored resume for printing: the user's FULL original resume text with
// their accepted edits applied. We render it verbatim (preserving every section)
// and open the print dialog so they can "Save as PDF" — no PDF library needed.
const PrintResume = () => {
  const { id } = useParams();
  const [params] = useSearchParams();
  const resumeId = params.get("resumeId");
  const api = useCareerApi();
  const { isLoaded, isSignedIn } = useAuth();

  const [text, setText] = useState("");
  const [state, setState] = useState("loading"); // loading | ready | empty | error | signedout

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      setState("signedout");
      return;
    }
    (async () => {
      try {
        const data = await api.getTailor(id, resumeId);
        const t = data.tailored;
        if (data.success && t && (t.resumeText || Array.isArray(t.changes))) {
          setText(applyTailored(t, t.accepted || {}));
          setState("ready");
        } else {
          setState("empty");
        }
      } catch {
        setState("error");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, resumeId, isLoaded, isSignedIn]);

  useEffect(() => {
    if (state === "ready") {
      const t = setTimeout(() => window.print(), 400);
      return () => clearTimeout(t);
    }
  }, [state]);

  const msg = (m) => <div style={{ padding: 40, fontFamily: "system-ui" }}>{m}</div>;
  if (state === "loading" || !isLoaded) return msg("Preparing your resume…");
  if (state === "signedout") return msg("Please sign in, then reopen this page.");
  if (state === "error") return msg("Couldn't load this resume. Close this tab and try Export again.");
  if (state !== "ready")
    return msg("No tailored resume found for this resume. Go back and tailor it first.");

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; }
        .sheet { max-width: 800px; margin: 0 auto; padding: 48px 56px; color: #1f2937;
          font-family: Georgia, "Times New Roman", serif; }
        .sheet pre { white-space: pre-wrap; word-wrap: break-word; font-family: inherit;
          font-size: 13.5px; line-height: 1.5; margin: 0; }
        .toolbar { position: fixed; top: 12px; right: 12px; }
        .toolbar button { font-family: system-ui; font-size: 13px; padding: 8px 14px;
          border: 1px solid #d1d5db; border-radius: 8px; background: #fff; cursor: pointer; }
        @media print { .toolbar { display: none; } .sheet { padding: 0; } @page { margin: 18mm; } }
      `}</style>
      <div className="toolbar">
        <button onClick={() => window.print()}>Print / Save as PDF</button>
      </div>
      <div className="sheet">
        <pre>{text}</pre>
      </div>
    </>
  );
};

export default PrintResume;
