// Local parser for the custom-exam chatbot. Turns free text the student types into spec
// fields — no server, no AI call, everything stays on device. Handles English + Hindi
// ( Devanagari digits, "se"/"तक" range words). If a fragment can't be parsed the chat falls
// back to guided questions, so the parser only needs to cover common phrasings, not language.

// ०-९ → 0-9 so Hindi-keyboard numbers work everywhere.
function normalizeDigits(text) {
  return text.replace(/[०-९]/g, (d) => "०१२३४५६७८९".indexOf(d));
}

// "10-20", "10 to 20", "10 se 20", "10–20 kb", "20 से 50 केबी" → { minKb, maxKb }.
const RANGE_RE = /(\d{1,5})\s*(?:-|–|—|~|to|se|से)\s*(\d{1,5})/i;
// "up to 50", "max 50", "अधिकतम 50" → max only (keyword before the number).
const MAX_RE = /(?:up\s*to|max(?:imum)?|at most|अधिकतम|ज़्यादा से ज़्यादा)\D{0,6}(\d{1,5})/i;
// "50 tak", "50 केबी तक" → max only (Hindi particle after the number).
const TAK_RE = /(\d{1,5})\s*(?:kb|केबी)?\s*tak\b/i;
// A bare "20 kb" / "20 केबी" → treat as the max.
const BARE_KB_RE = /(\d{1,5})\s*(?:kb|kbps|केबी|के\.?बी\.?)/i;

/** Parse a KB range from free text. Returns { minKb, maxKb } or null. */
export function parseKbRange(text) {
  const s = normalizeDigits(String(text || ""));
  let match = s.match(RANGE_RE);
  if (match) {
    let minKb = Number(match[1]);
    let maxKb = Number(match[2]);
    if (minKb > maxKb) [minKb, maxKb] = [maxKb, minKb];
    return { minKb, maxKb };
  }
  match = s.match(MAX_RE) || s.match(TAK_RE) || s.match(BARE_KB_RE);
  if (match) return { minKb: 0, maxKb: Number(match[1]) };
  return null;
}

// "200x230", "200×230", "200 by 230", "200*230".
const PX_RE = /(\d{2,5})\s*(?:x|×|\*|by)\s*(\d{2,5})/i;

/** Parse an exact pixel size. Returns { width, height } or null. */
export function parsePixels(text) {
  const match = normalizeDigits(String(text || "")).match(PX_RE);
  return match ? { width: Number(match[1]), height: Number(match[2]) } : null;
}

const PHOTO_RE = /photo|photograph|image|picture|फोटो|फ़ोटो|तस्वीर|चित्र/i;
const SIGNATURE_RE = /signature|autograph|हस्ताक्षर|सिग्नेचर|साइन|दस्तखत/i;

/** Parse a document type keyword. Returns "photo" | "signature" | null. */
export function parseDocType(text) {
  const s = String(text || "");
  if (SIGNATURE_RE.test(s)) return "signature";
  if (PHOTO_RE.test(s)) return "photo";
  return null;
}

// Fragments stripped to isolate an exam name from a combined message like
// "IBPS PO clerk photo 10-20 kb 200x230".
const STRIP_RES = [RANGE_RE, PX_RE, MAX_RE, TAK_RE, BARE_KB_RE, PHOTO_RE, SIGNATURE_RE, /\s{2,}/g];
// Unit words left behind once the numbers are stripped ("10-20 kb" → "kb").
const UNIT_RE = /\b(?:kb|kbs|px|pixels?)\b|केबी|पिक्सेल/gi;

/**
 * Opportunistically parse everything out of one message: exam name + document type +
 * KB range + pixel size. Fields that aren't present are undefined.
 */
export function parseSpecText(text) {
  const s = String(text || "").trim();
  if (!s) return {};
  const out = {};
  const kb = parseKbRange(s);
  if (kb) out.minKb = kb.minKb;
  if (kb) out.maxKb = kb.maxKb;
  const px = parsePixels(s);
  if (px) Object.assign(out, px);
  const type = parseDocType(s);
  if (type) out.type = type;
  let name = normalizeDigits(s);
  for (const re of STRIP_RES) name = name.replace(re, " ");
  name = name.replace(UNIT_RE, " ").replace(/[,\-–—~]/g, " ").replace(/\s{2,}/g, " ").trim();
  if (name && name.length >= 2 && !/^\d+$/.test(name)) out.name = name;
  return out;
}

/** Sanity bounds for a custom KB cap (guards against mis-parsed absurd values). */
export function isPlausibleKb(maxKb, minKb = 0) {
  return Number.isFinite(maxKb) && maxKb > 0 && maxKb <= 10240 && minKb >= 0 && minKb < maxKb * 4;
}
