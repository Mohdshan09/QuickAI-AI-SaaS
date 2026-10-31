import { useEffect, useRef, useState } from "react";
import { SendHorizonal, Sparkles } from "lucide-react";
import { useT } from "../i18n/index.jsx";
import { parseKbRange, parsePixels, parseDocType, parseSpecText, isPlausibleKb } from "../lib/specChatParse.js";
import { getJson } from "../lib/apiClient.js";
import { sendOrQueue } from "../lib/submissionQueue.js";
import { getAnonId } from "../lib/anonId.js";
import { specHash } from "../lib/specHash.js";

// Chat-style setup for a custom exam size (replaces the old form). A guided conversation with
// quick-reply chips, plus a local parser (specChatParse.js) that reads free text — including
// Hindi phrasing — so a student can type "SSC GD signature 10-20 kb" in one message. Everything
// is client-side: no AI call, nothing leaves the device.
//
// onComplete receives: { name, type, minKb, maxKb, width?, height?, notifUrl } — the same values
// the old form produced.

const TYPE_KEYS = { photo: "custom.typePhoto", signature: "custom.typeSignature" };

// Typed equivalents of the "Skip" chip, in both languages. The lookahead keeps Latin words
// whole, so "no" skips but "notification link …" does not.
const SKIP_RE = /^(?:(?:skip|pass|none|no|n\/a|na)(?![a-z])|नहीं|छोड़)/i;

const EMPTY_DRAFT = { name: "", type: null, minKb: null, maxKb: null, width: null, height: null, notifUrl: "" };

/** Turn a previous chat answer set (or a restored recent-exam preset) into a fresh draft. */
function normalizeSeed(seed) {
  if (!seed) return { ...EMPTY_DRAFT };
  const num = (v) => (Number(v) > 0 ? Number(v) : null);
  return {
    ...EMPTY_DRAFT,
    name: seed.name || "",
    type: seed.type || null,
    minKb: num(seed.minKb),
    maxKb: num(seed.maxKb),
    width: num(seed.width),
    height: num(seed.height),
    notifUrl: seed.notifUrl || "",
    pxSkipped: seed.pxSkipped || (num(seed.width) != null),
    notifSkipped: seed.notifSkipped || Boolean(seed.notifUrl),
  };
}

export default function SpecChat({ seed = null, onComplete }) {
  const t = useT();
  // The two opening bubbles are deterministic, so they render (and prerender) instead of
  // appearing from an effect — a crawler sees a real conversation, not an empty box.
  const [history, setHistory] = useState(() => {
    const opening = [{ who: "bot", text: t("chat.greeting") }];
    if (!seed?.name) opening.push({ who: "bot", text: t("chat.askName") });
    return opening;
  }); // { who: "bot" | "user", text }
  const [chips, setChips] = useState([]); // { label, run }
  const [step, setStep] = useState("name");
  const [input, setInput] = useState("");
  const draft = useRef(normalizeSeed(seed));
  const scrollRef = useRef(null);
  // Guards so re-render/focus changes can't re-fire the community-preset lookup.
  const presetsAskedFor = useRef("");
  const presetsOffered = useRef("");

  const say = (who, text) => setHistory((h) => [...h, { who, text }]);

  const userSay = (text) => say("user", text);

  // Asks the first unanswered question, or shows the confirm summary when nothing is missing.
  const askNext = (d) => {
    setChips([]);
    if (!d.type) {
      setStep("type");
      say("bot", t("chat.askType"));
      setChips([
        { label: t("custom.typePhoto"), run: () => answerType("photo") },
        { label: t("custom.typeSignature"), run: () => answerType("signature") },
      ]);
      return;
    }
    if (!d.maxKb) {
      setStep("kb");
      say("bot", t("chat.askKb"));
      return;
    }
    if (d.width == null && !d.pxSkipped) {
      setStep("px");
      say("bot", t("chat.askPx"));
      setChips([{ label: t("chat.skip"), run: () => answerPx(null) }]);
      return;
    }
    if (d.name && !d.notifUrl && !d.notifSkipped) {
      setStep("notif");
      say("bot", t("chat.askNotif"));
      setChips([{ label: t("chat.skip"), run: () => answerNotif(null) }]);
      maybeOfferPresets(d);
      return;
    }
    confirmSpec(d);
  };

  const confirmSpec = (d) => {
    setStep("confirm");
    const typeLabel = t(TYPE_KEYS[d.type]).toLowerCase();
    const kbLine = d.minKb > 0 ? t("chat.summaryKb", { min: d.minKb, max: d.maxKb }) : t("chat.summaryKbMaxOnly", { max: d.maxKb });
    const pxLine =
      d.width != null ? t("chat.summaryPx", { w: d.width, h: d.height }) : t("chat.summaryPxDefault", { type: typeLabel });
    say("bot", `${t("chat.summaryTitle")}\n${typeLabel} · ${kbLine} · ${pxLine}`);
    say("bot", t("chat.confirm"));
    setChips([
      { label: `✓ ${t("chat.start")}`, run: () => beginFinish(d) },
      { label: t("chat.edit"), run: editSpec },
    ]);
  };

  // A named exam can be sent to the admin review queue ("request to save"); anonymous custom
  // sizes have nothing to verify, so they go straight to the tool.
  const beginFinish = (d) => {
    userSay(t("chat.start"));
    if (!d.name) {
      onComplete(d);
      return;
    }
    setStep("request");
    setChips([]);
    say("bot", t("chat.askRequest", { name: d.name }));
    if (!d.notifUrl) say("bot", t("chat.requestHint"));
    setChips([
      { label: t("chat.requestYes"), run: () => sendRequestAndFinish(d) },
      { label: t("chat.requestNo"), run: () => { userSay(t("chat.requestNo")); onComplete(d); } },
    ]);
  };

  const sendRequestAndFinish = (d) => {
    const documents = [{
      type: d.type,
      width: d.width ?? null,
      height: d.height ?? null,
      minKb: d.minKb || 0,
      maxKb: d.maxKb,
    }];
    const anonId = getAnonId();
    userSay(t("chat.requestYes"));
    // Best-effort + offline-safe (queued in IndexedDB if the network is down). No image data.
    sendOrQueue("exam-requests", { name: d.name, anonId });
    sendOrQueue("spec-submissions", {
      examName: d.name,
      documents,
      notificationUrl: d.notifUrl || null,
      specHash: specHash(documents),
      anonId,
    });
    say("bot", t("chat.requestSent"));
    // CustomPage swaps the chat for the tool, so the confirmation also needs to survive there.
    onComplete({ ...d, requested: true });
  };

  const editSpec = () => {
    const d = draft.current;
    userSay(t("chat.edit"));
    askNext({ ...d, pxSkipped: false, notifSkipped: d.name ? false : d.notifSkipped });
  };

  const answerType = (type) => {
    draft.current.type = type;
    userSay(t(TYPE_KEYS[type]));
    askNext(draft.current);
  };

  const answerPx = (px) => {
    const d = draft.current;
    if (px) {
      d.width = px.width;
      d.height = px.height;
    } else {
      d.pxSkipped = true;
      userSay(t("chat.skip"));
    }
    askNext(d);
  };

  const answerNotif = (url) => {
    const d = draft.current;
    if (url) d.notifUrl = url;
    else {
      d.notifSkipped = true;
      userSay(t("chat.skip"));
    }
    askNext(d);
  };

  // Community presets: only asked once per exam name, only when the name came from the user.
  const maybeOfferPresets = (d) => {
    const name = d.name?.trim();
    if (!name || presetsAskedFor.current === name || presetsOffered.current === name) return;
    presetsAskedFor.current = name;
    getJson(`spec-submissions?examName=${encodeURIComponent(name)}`)
      .then((data) => {
        const presets = Array.isArray(data.presets) ? data.presets : [];
        const preset = presets.find((p) => p.documents?.length);
        const first = preset?.documents?.[0];
        if (!first) return;
        presetsOffered.current = name;
        const dims = first.width && first.height ? `${first.width} × ${first.height}px` : t("chat.pixelsNotSpecified");
        const used = preset.uses > 1 ? ` · ${t("custom.usedBy", { n: preset.uses })}` : "";
        say("bot", t("chat.communityFound", { name }));
        setChips([
          {
            label: t("chat.usePreset", {
              type: t(TYPE_KEYS[first.type === "signature" ? "signature" : "photo"]),
              dims,
              min: first.minKb || 0,
              max: first.maxKb || "?",
              used,
            }),
            run: () => {
              const dd = draft.current;
              dd.type = first.type === "signature" ? "signature" : "photo";
              dd.minKb = first.minKb || 0;
              dd.maxKb = first.maxKb || dd.maxKb;
              if (first.width && first.height) {
                dd.width = first.width;
                dd.height = first.height;
              }
              userSay(t("chat.usePreset", {
                type: t(TYPE_KEYS[dd.type]),
                dims,
                min: dd.minKb,
                max: dd.maxKb || "?",
                used,
              }));
              askNext(dd);
            },
          },
        ]);
      })
      .catch(() => {});
  };

  const handleName = (raw) => {
    const d = draft.current;
    const text = raw.trim();
    if (!text || SKIP_RE.test(text)) {
      userSay(text || t("chat.skip"));
      d.name = "";
      askNext(d);
      return;
    }
    userSay(text);
    const parsed = parseSpecText(text);
    // A message that is only spec fields ("photo 10-20 kb") answers later questions instead of
    // naming the exam; anything with words left over after stripping numbers is the exam name.
    if (parsed.name) {
      d.name = parsed.name;
      say("bot", t("chat.nameAck", { name: d.name }));
    }
    if (parsed.type) d.type = parsed.type;
    if (parsed.maxKb && isPlausibleKb(parsed.maxKb, parsed.minKb)) {
      d.minKb = parsed.minKb;
      d.maxKb = parsed.maxKb;
    }
    if (parsed.width) {
      d.width = parsed.width;
      d.height = parsed.height;
    }
    askNext(d);
  };

  const handleText = (raw) => {
    const text = raw.trim();
    if (!text) return;
    const d = draft.current;
    switch (step) {
      case "name":
        handleName(text);
        return;
      case "type": {
        const type = parseDocType(text);
        if (type) {
          userSay(text);
          d.type = type;
          askNext(d);
        } else {
          userSay(text);
          say("bot", t("chat.askType"));
        }
        return;
      }
      case "kb": {
        // A KB answer may smuggle in other fields ("photo 10-20"); scoop those up too.
        const extra = parseSpecText(text);
        const kb = parseKbRange(text) || (extra.maxKb ? { minKb: extra.minKb, maxKb: extra.maxKb } : null);
        if (kb && isPlausibleKb(kb.maxKb, kb.minKb)) {
          userSay(text);
          d.minKb = kb.minKb;
          d.maxKb = kb.maxKb;
          if (!d.type && extra.type) d.type = extra.type;
          if (d.width == null && extra.width) {
            d.width = extra.width;
            d.height = extra.height;
          }
          askNext(d);
        } else {
          userSay(text);
          say("bot", t("chat.parseFailKb"));
        }
        return;
      }
      case "px": {
        if (SKIP_RE.test(text)) {
          answerPx(null);
          return;
        }
        const px = parsePixels(text);
        if (px) {
          userSay(text);
          answerPx(px);
        } else {
          userSay(text);
          say("bot", t("chat.parseFailPx"));
          setChips([{ label: t("chat.skip"), run: () => answerPx(null) }]);
        }
        return;
      }
      case "notif": {
        if (SKIP_RE.test(text)) {
          answerNotif(null);
          return;
        }
        const url = text;
        if (/^\S+\.\S{2,}/.test(url)) {
          userSay(url);
          answerNotif(url);
        } else {
          userSay(text);
          say("bot", t("chat.parseFailNotif"));
          setChips([{ label: t("chat.skip"), run: () => answerNotif(null) }]);
        }
        return;
      }
      default:
        return;
    }
  };

  // A seeded chat (edit / restored preset) still needs its first question; the opening bubbles
  // are already in the initial state. StrictMode fires effects twice, hence the guard.
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (draft.current.name) askNext(draft.current);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [history, chips]);

  const send = (e) => {
    e.preventDefault();
    const text = input;
    setInput("");
    handleText(text);
  };

  return (
    <div className="mt-5 max-w-md rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
      <div ref={scrollRef} className="max-h-[55vh] min-h-[220px] space-y-2 overflow-y-auto pr-1">
        {history.map((m, i) => (
          <p
            key={i}
            className={
              m.who === "bot"
                ? "mr-8 w-fit max-w-full whitespace-pre-line rounded-2xl rounded-bl-sm border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
                : "ml-auto w-fit max-w-full whitespace-pre-line rounded-2xl rounded-br-sm bg-blue-600 px-3 py-2 text-sm text-white"
            }
          >
            {m.text}
          </p>
        ))}
      </div>

      {chips.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {chips.map((chip, i) => (
            <button
              key={`${i}-${chip.label}`}
              type="button"
              onClick={chip.run}
              className="rounded-full border border-blue-300 bg-white px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-50"
            >
              {chip.label}
            </button>
          ))}
        </div>
      )}

      {step !== "confirm" && step !== "request" && (
        <form onSubmit={send} className="mt-3 flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t("chat.inputPlaceholder")}
            aria-label={t("chat.inputPlaceholder")}
            className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500"
          />
          <button
            type="submit"
            aria-label={t("chat.send")}
            className="shrink-0 rounded-xl bg-blue-600 p-2.5 text-white hover:bg-blue-700"
          >
            <SendHorizonal className="w-4 h-4" aria-hidden />
          </button>
        </form>
      )}

      <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-400">
        <Sparkles className="w-3 h-3" aria-hidden />
        {t("privacy")}
      </p>
    </div>
  );
}
