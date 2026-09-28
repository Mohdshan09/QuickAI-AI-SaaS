import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { useCareerApi } from "../../lib/careerApi";
import { applyTailored } from "../../lib/tailorApply";

// Phase 0 interim renderer: give the applied resume text real visual hierarchy
// (name, contact, section headings, bullets) from plain text, until the Phase 1
// structured renderer lands. Heuristic, but readable and metadata-free.
const HEADINGS = /^(summary|professional summary|objective|experience|work experience|employment|projects|education|skills|technical skills|certifications?|certificates?|achievements|publications|languages|interests)\b/i;
const isBullet = (l) => /^\s*([-•*·▪◦]|•)/.test(l);
const isHeading = (l) => {
  const t = l.trim();
  if (!t || t.length > 40) return false;
  if (HEADINGS.test(t)) return true;
  // ALL-CAPS short line (e.g. "WORK EXPERIENCE")
  return /^[A-Z0-9 &/,'()-]+$/.test(t) && /[A-Z]/.test(t) && t.split(" ").length <= 5;
};

const renderResume = (text) => {
  const lines = text.replace(/\r/g, "").split("\n");
  const out = [];
  let firstText = true;
  let bulletBuf = [];
  const flush = () => {
    if (bulletBuf.length) {
      out.push(
        <ul key={`ul-${out.length}`}>
          {bulletBuf.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>
      );
      bulletBuf = [];
    }
  };
  lines.forEach((raw, idx) => {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flush();
      return;
    }
    if (isBullet(line)) {
      bulletBuf.push(line.replace(/^\s*([-•*·▪◦]|•)\s?/, ""));
      return;
    }
    flush();
    if (firstText) {
      out.push(
        <h1 key={`n-${idx}`} className="name">
          {line.trim()}
        </h1>
      );
      firstText = false;
      // treat the immediately following non-heading line as contact
      const next = (lines[idx + 1] || "").trim();
      if (next && !isHeading(next) && /[@|·•]|\d/.test(next)) {
        out.push(
          <p key={`c-${idx}`} className="contact">
            {next}
          </p>
        );
        lines[idx + 1] = ""; // consume it
      }
      return;
    }
    if (isHeading(line)) {
      out.push(
        <h2 key={`h-${idx}`} className="sec">
          {line.trim()}
        </h2>
      );
      return;
    }
    out.push(
      <p key={`p-${idx}`} className="para">
        {line.trim()}
      </p>
    );
  });
  flush();
  return out;
};

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

  const body = useMemo(() => (state === "ready" ? renderResume(text) : null), [state, text]);

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
        html, body { margin: 0; padding: 0; background: #f3f4f6; }
        .sheet {
          max-width: 800px; margin: 24px auto; background: #fff; color: #1f2937;
          padding: 40px 48px; font-family: Georgia, "Times New Roman", serif; line-height: 1.4;
          box-shadow: 0 1px 8px rgba(0,0,0,.08);
        }
        .name { font-size: 24px; margin: 0 0 2px; letter-spacing: .01em; }
        .contact { color: #4b5563; font-size: 12.5px; margin: 0 0 16px; }
        .sec {
          font-size: 12.5px; letter-spacing: .1em; text-transform: uppercase; color: #111827;
          border-bottom: 1px solid #d1d5db; padding-bottom: 3px; margin: 20px 0 8px; font-weight: 700;
        }
        .para { font-size: 13.5px; margin: 3px 0; }
        ul { margin: 4px 0 8px; padding-left: 20px; }
        li { font-size: 13.5px; margin-bottom: 4px; }
        .toolbar { position: fixed; top: 12px; right: 12px; }
        .toolbar button { font-family: system-ui; font-size: 13px; padding: 8px 14px;
          border: 1px solid #d1d5db; border-radius: 8px; background: #fff; cursor: pointer; }
        /* Drop the browser's own date/URL/title header & footer by removing the page margin */
        @media print {
          html, body { background: #fff; }
          .toolbar { display: none; }
          .sheet { margin: 0; max-width: none; box-shadow: none; padding: 14mm 16mm; }
          @page { margin: 0; }
        }
      `}</style>

      <div className="toolbar">
        <button onClick={() => window.print()}>Print / Save as PDF</button>
      </div>

      <div className="sheet">{body}</div>
    </>
  );
};

export default PrintResume;
