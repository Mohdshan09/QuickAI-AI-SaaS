// High-quality resize (quality strategy §4). Most "compression blur" is actually bad
// downscaling, so we use pica (Lanczos3) + a thresholded unsharp mask instead of canvas
// drawImage, and flatten onto a solid background (JPEG has no alpha). pica is lazy-imported
// so it stays out of the initial bundle. Async; falls back to drawImage if pica is
// unavailable. Everything stays lossless here — the single JPEG encode happens later.

import { createCanvas } from "./canvasEnv.js";

let _pica;
async function getPica() {
  if (_pica === undefined) {
    try {
      const mod = await import("pica");
      const Pica = mod.default || mod;
      // No nested web-workers: this already runs inside our processor worker.
      _pica = Pica({ features: ["js", "wasm"] });
    } catch {
      _pica = null; // fall back to drawImage
    }
  }
  return _pica;
}

// Per-document unsharp presets (gentler for ink to avoid halos; §4/§7).
export const SHARPEN = {
  photo: { unsharpAmount: 80, unsharpRadius: 0.6, unsharpThreshold: 2 },
  signature: { unsharpAmount: 40, unsharpRadius: 0.5, unsharpThreshold: 3 },
  declaration: { unsharpAmount: 50, unsharpRadius: 0.5, unsharpThreshold: 3 },
  thumb: { unsharpAmount: 20, unsharpRadius: 0.4, unsharpThreshold: 4 },
};

// Resize `source` into a dest canvas of exactly destW×destH using pica; drawImage fallback.
async function qualityResize(source, destW, destH, sharpen) {
  const dest = createCanvas(destW, destH);
  const pica = await getPica();
  if (pica) {
    try {
      await pica.resize(source, dest, { filter: "lanczos3", ...(sharpen || {}) });
      return dest;
    } catch {
      /* fall through to drawImage */
    }
  }
  const ctx = dest.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, source.width, source.height, 0, 0, destW, destH);
  return dest;
}

/**
 * @param {canvas} source cropped/processed canvas
 * @param {{ width, height, background?, fit?:"fill"|"contain", sharpen? }} spec
 *   fit "fill" = exact box (photos, already cropped to aspect); "contain" = letterbox,
 *   preserving aspect and padding with the background (signatures; never stretch).
 * @returns {Promise<canvas>} a canvas of exactly width × height
 */
export async function resizeToSpec(source, { width, height, background = "white", fit = "fill", sharpen }) {
  const fill = background === "any" ? "white" : background === "light" ? "#ffffff" : background || "white";

  if (fit === "contain") {
    const scale = Math.min(width / source.width, height / source.height);
    const dw = Math.max(1, Math.round(source.width * scale));
    const dh = Math.max(1, Math.round(source.height * scale));
    const inner = await qualityResize(source, dw, dh, sharpen);

    const out = createCanvas(width, height);
    const ctx = out.getContext("2d");
    ctx.fillStyle = fill;
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(inner, Math.round((width - dw) / 2), Math.round((height - dh) / 2));
    return out;
  }

  // fill: resize straight into the target box, on a solid backdrop (covers any edge AA).
  const resized = await qualityResize(source, width, height, sharpen);
  const out = createCanvas(width, height);
  const ctx = out.getContext("2d");
  ctx.fillStyle = fill;
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(resized, 0, 0);
  return out;
}

/** Proportionally smaller copy (used by compress.js dimension step-down). Async (pica). */
export async function scaleCanvas(source, factor) {
  const width = Math.max(1, Math.round(source.width * factor));
  const height = Math.max(1, Math.round(source.height * factor));
  return qualityResize(source, width, height);
}
