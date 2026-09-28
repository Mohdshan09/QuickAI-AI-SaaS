import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { useCareerApi } from "../../lib/careerApi";

// Clean, single-column resume built from the accepted tailored content.
// Opened in its own tab (outside the app Layout) and triggers the browser's
// print dialog so the user can "Save as PDF" — no PDF library needed.
const PrintResume = () => {
  const { id } = useParams();
  const [params] = useSearchParams();
  const resumeId = params.get("resumeId");
  const api = useCareerApi();
  const { isLoaded, isSignedIn } = useAuth();

  const [tailored, setTailored] = useState(null);
  const [state, setState] = useState("loading"); // loading | ready | empty | error | signedout

  useEffect(() => {
    // This page opens in a fresh tab, so wait for Clerk to finish loading —
    // otherwise getToken() is null and the request comes back unauthenticated.
    if (!isLoaded) return;
    if (!isSignedIn) {
      setState("signedout");
      return;
    }
    (async () => {
      try {
        const data = await api.getTailor(id, resumeId);
        if (data.success && data.tailored) {
          setTailored(data.tailored);
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

  // Once content is on screen, open the print dialog.
  useEffect(() => {
    if (state === "ready") {
      const t = setTimeout(() => window.print(), 400);
      return () => clearTimeout(t);
    }
  }, [state]);

  if (state === "loading" || !isLoaded)
    return <div style={{ padding: 40, fontFamily: "system-ui" }}>Preparing your resume…</div>;
  if (state === "signedout")
    return (
      <div style={{ padding: 40, fontFamily: "system-ui" }}>
        Please sign in, then reopen this page.
      </div>
    );
  if (state === "error")
    return (
      <div style={{ padding: 40, fontFamily: "system-ui" }}>
        Couldn't load this resume. Please close this tab and try Export again.
      </div>
    );
  if (state !== "ready")
    return (
      <div style={{ padding: 40, fontFamily: "system-ui" }}>
        No tailored resume found for this resume. Go back and tailor it first.
      </div>
    );

  const accepted = tailored.accepted || {};
  const ok = (key) => accepted[key] !== false;
  const summary = ok("summary") ? tailored.summary?.tailored : tailored.summary?.original;
  const skills = ok("skills") ? tailored.skills?.tailored : tailored.skills?.original;

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; }
        .sheet { max-width: 760px; margin: 0 auto; padding: 48px 56px; color: #1f2937;
          font-family: Georgia, "Times New Roman", serif; line-height: 1.4; }
        .sheet h1 { font-size: 24px; margin: 0 0 4px; }
        .contact { color: #4b5563; font-size: 13px; white-space: pre-wrap; margin-bottom: 20px; }
        .sec { font-size: 13px; letter-spacing: .08em; text-transform: uppercase;
          border-bottom: 1px solid #d1d5db; padding-bottom: 3px; margin: 22px 0 10px; color: #111827; }
        .heading { font-weight: 700; font-size: 15px; margin: 12px 0 4px; }
        ul { margin: 0; padding-left: 20px; }
        li { font-size: 14px; margin-bottom: 4px; }
        p.summary { font-size: 14px; margin: 0; }
        .skills { font-size: 14px; }
        .toolbar { position: fixed; top: 12px; right: 12px; }
        .toolbar button { font-family: system-ui; font-size: 13px; padding: 8px 14px;
          border: 1px solid #d1d5db; border-radius: 8px; background: #fff; cursor: pointer; }
        @media print { .toolbar { display: none; } .sheet { padding: 0; } @page { margin: 18mm; } }
      `}</style>

      <div className="toolbar">
        <button onClick={() => window.print()}>Print / Save as PDF</button>
      </div>

      <div className="sheet">
        {tailored.header && (
          <div className="contact">{tailored.header}</div>
        )}

        {summary && (
          <>
            <div className="sec">Summary</div>
            <p className="summary">{summary}</p>
          </>
        )}

        {(tailored.sections || []).map((s, si) => {
          const bullets = (s.bullets || [])
            .map((b, bi) => (ok(`${si}:${bi}`) ? b.tailored : b.original))
            .filter(Boolean);
          if (bullets.length === 0) return null;
          return (
            <div key={si}>
              <div className="heading">{s.heading}</div>
              <ul>
                {bullets.map((t, bi) => (
                  <li key={bi}>{t}</li>
                ))}
              </ul>
            </div>
          );
        })}

        {skills?.length > 0 && (
          <>
            <div className="sec">Skills</div>
            <div className="skills">{skills.join(" · ")}</div>
          </>
        )}
      </div>
    </>
  );
};

export default PrintResume;
