// Name & date strip (spec §4.4). The photo is resized to (W, H − stripHeight) upstream;
// this step composes it onto the final W×H canvas with a white strip carrying black,
// auto-sized sans-serif text. Output dimensions stay exactly as the spec requires (P2-FR-44).
// Name/date are passed in and never leave the device (P2-FR-48). Pure (canvas → canvas).

import { createCanvas } from "../canvasEnv.js";

const MONTHS = ["", "01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];

/** Format a Date per a simple token string (DD, MM, YYYY). Pure, node-testable. */
export function formatDate(date, fmt = "DD-MM-YYYY") {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = MONTHS[date.getMonth() + 1];
  const yyyy = String(date.getFullYear());
  return fmt.replace("YYYY", yyyy).replace("DD", dd).replace("MM", mm);
}

export function applyCase(text, mode) {
  if (mode === "upper") return text.toUpperCase();
  if (mode === "lower") return text.toLowerCase();
  return text;
}

/** Photo area height when a strip of heightPx is reserved inside total height H. */
export function photoHeight(totalHeight, stripHeightPx) {
  return Math.max(1, totalHeight - stripHeightPx);
}

// Build the text lines for the strip from spec.lines + provided values.
function stripLines(strip, { name = "", date }, fontCase) {
  const d = date instanceof Date ? date : new Date();
  return (strip.lines || ["name", "date"])
    .map((key) => {
      if (key === "name") return applyCase(name, fontCase);
      if (key === "date") return applyCase(formatDate(d, strip.dateFormat), fontCase);
      return "";
    })
    .filter(Boolean);
}

// Fit text to width: shrink the font to a floor, then wrap a too-long single line to 2 lines.
function layoutLine(ctx, text, maxWidth, maxFont) {
  let font = maxFont;
  const minFont = Math.max(8, Math.round(maxFont * 0.55));
  const widthAt = (f) => {
    ctx.font = `600 ${f}px sans-serif`;
    return ctx.measureText(text).width;
  };
  while (font > minFont && widthAt(font) > maxWidth) font--;
  if (widthAt(font) <= maxWidth) return { font, rows: [text] };

  // Still too wide at the floor → wrap into two balanced rows on a space.
  const words = text.split(" ");
  if (words.length < 2) return { font, rows: [text] }; // can't wrap
  let best = { diff: Infinity, rows: [text] };
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(" ");
    const b = words.slice(i).join(" ");
    const diff = Math.abs(a.length - b.length);
    if (diff < best.diff) best = { diff, rows: [a, b] };
  }
  return { font, rows: best.rows };
}

/**
 * @param {canvas} photoCanvas sized (width, height − strip.heightPx)
 * @param {{ width, height, strip:{heightPx,lines,dateFormat,case}, name, date }} opts
 * @returns {canvas} final width × height canvas with the strip composed
 */
export function applyStrip(photoCanvas, { width, height, strip, name, date }) {
  const out = createCanvas(width, height);
  const ctx = out.getContext("2d");

  // Photo on top.
  ctx.drawImage(photoCanvas, 0, 0, photoCanvas.width, photoCanvas.height, 0, 0, width, height - strip.heightPx);

  // White strip.
  const stripTop = height - strip.heightPx;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, stripTop, width, strip.heightPx);

  ctx.fillStyle = "#000000";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const lines = stripLines(strip, { name, date }, strip.case);
  // Reserve vertical space per logical line; a wrapped name counts as its rows.
  const pad = Math.round(strip.heightPx * 0.12);
  const avail = strip.heightPx - pad * 2;
  const maxFont = Math.min(Math.round(strip.heightPx * 0.42), Math.round(avail / lines.length));

  const laidOut = lines.map((t) => layoutLine(ctx, t, width * 0.92, maxFont));
  const totalRows = laidOut.reduce((n, l) => n + l.rows.length, 0);
  const rowH = avail / totalRows;

  let row = 0;
  for (const line of laidOut) {
    ctx.font = `600 ${line.font}px sans-serif`;
    for (const text of line.rows) {
      const y = stripTop + pad + rowH * (row + 0.5);
      ctx.fillText(text, width / 2, y);
      row++;
    }
  }
  return out;
}
