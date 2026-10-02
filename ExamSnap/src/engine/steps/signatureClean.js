// Signature / thumb / declaration cleanup (spec §4.2). Turns a phone photo of ink on paper
// into dark ink on a near-white background: grayscale → shadow flatten → adaptive threshold
// (Bradley, integral image, linear time) → soft edges → speck removal → auto-crop to the ink
// bounding box. Letterboxing to the spec aspect happens later in resizeToSpec(fit:"contain").
// Pure (canvas in → canvas out); runs in the worker.

import { getImageData, canvasFromImageData } from "../canvasEnv.js";
import { toLuma } from "../analyze/grayscale.js";
import { analyzeInk } from "../analyze/inkRatio.js";

// Per-document presets: thumb and declaration use a gentler threshold so ridge detail /
// text readability survive (P2-FR-24/25).
const PRESETS = {
  signature: { k: 0.12, speckScale: 0.004 },
  thumb: { k: 0.07, speckScale: 0.002 },
  declaration: { k: 0.05, speckScale: 0.0015 },
};

/** Summed-area table of a scalar field; index (x,y) over an (w+1)*(h+1) grid. */
export function integral(arr, w, h) {
  const I = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += arr[y * w + x];
      I[(y + 1) * (w + 1) + (x + 1)] = I[y * (w + 1) + (x + 1)] + row;
    }
  }
  return I;
}

/** Per-pixel mean over a (2r+1)² window, edge-clamped, via the summed-area table. */
export function boxMeanField(arr, w, h, r) {
  const I = integral(arr, w, h);
  const out = new Float64Array(w * h);
  const W = w + 1;
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r);
    const y1 = Math.min(h - 1, y + r);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r);
      const x1 = Math.min(w - 1, x + r);
      const sum =
        I[(y1 + 1) * W + (x1 + 1)] - I[y0 * W + (x1 + 1)] - I[(y1 + 1) * W + x0] + I[y0 * W + x0];
      const count = (y1 - y0 + 1) * (x1 - x0 + 1);
      out[y * w + x] = sum / count;
    }
  }
  return out;
}

// Grayscale ink mask (0 = ink … 255 = paper) with soft edges near the local threshold.
function buildMask(luma, w, h, { k, band }) {
  // Shadow flatten: divide luma by a large-radius background estimate (P2-FR-12).
  const bgR = Math.max(8, Math.round(Math.min(w, h) * 0.12));
  const bg = boxMeanField(luma, w, h, bgR);
  const flat = new Float64Array(w * h);
  for (let p = 0; p < flat.length; p++) {
    const ratio = bg[p] > 1 ? luma[p] / bg[p] : 1;
    flat[p] = Math.max(0, Math.min(255, ratio * 255));
  }

  // Bradley adaptive threshold: compare each pixel to the local mean * (1 - k) (P2-FR-13).
  const winR = Math.max(7, Math.round(Math.min(w, h) * 0.12));
  const localMean = boxMeanField(flat, w, h, winR);

  const mask = new Float64Array(w * h);
  for (let p = 0; p < mask.length; p++) {
    const thr = localMean[p] * (1 - k);
    const d = flat[p] - thr;
    if (d <= -band) mask[p] = 0; // ink
    else if (d >= band) mask[p] = 255; // paper
    else mask[p] = ((d + band) / (2 * band)) * 255; // soft ramp (P2-FR-14)
  }
  return mask;
}

// Drop ink blobs smaller than minArea (P2-FR-15), 4-connected flood fill over the binarised
// mask. Removed pixels become paper.
function removeSpecks(mask, w, h, minArea) {
  const inkCut = 128;
  const seen = new Uint8Array(w * h);
  const stack = [];
  for (let start = 0; start < mask.length; start++) {
    if (seen[start] || mask[start] > inkCut) continue;
    // BFS/DFS over this component.
    stack.length = 0;
    stack.push(start);
    seen[start] = 1;
    const comp = [start];
    while (stack.length) {
      const p = stack.pop();
      const x = p % w;
      const y = (p / w) | 0;
      const nb = [];
      if (x > 0) nb.push(p - 1);
      if (x < w - 1) nb.push(p + 1);
      if (y > 0) nb.push(p - w);
      if (y < h - 1) nb.push(p + w);
      for (const q of nb) {
        if (!seen[q] && mask[q] <= inkCut) {
          seen[q] = 1;
          stack.push(q);
          comp.push(q);
        }
      }
    }
    if (comp.length < minArea) for (const q of comp) mask[q] = 255;
  }
}

/** 1px dilation of ink (P2-FR-21) for thin strokes that would vanish when downscaled. */
function dilateInk(mask, w, h) {
  const out = Float64Array.from(mask);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      if (mask[p] >= 128) {
        // paper — darken if any 4-neighbour is ink
        const neighbourInk =
          (x > 0 && mask[p - 1] < 128) ||
          (x < w - 1 && mask[p + 1] < 128) ||
          (y > 0 && mask[p - w] < 128) ||
          (y < h - 1 && mask[p + w] < 128);
        if (neighbourInk) out[p] = 0;
      }
    }
  }
  return out;
}

export function inkBBox(mask, w, h, pad) {
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (mask[y * w + x] < 200) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return { x: 0, y: 0, w, h }; // nothing found — keep all
  return {
    x: Math.max(0, minX - pad),
    y: Math.max(0, minY - pad),
    w: Math.min(w, maxX + pad) - Math.max(0, minX - pad) + 1,
    h: Math.min(h, maxY + pad) - Math.max(0, minY - pad) + 1,
  };
}

/**
 * @param {canvas} source cropped signature region
 * @param {{ type?, strength?, ink?, thicken? }} opts
 *   strength 0–1 → threshold aggressiveness; ink "original"|"black"; thicken bool.
 * @returns {{ canvas, inkRatio:number, faint:boolean }}
 */
export function cleanSignature(source, opts = {}) {
  const { type = "signature", strength = 0.5, ink = "original", thicken = false } = opts;
  const preset = PRESETS[type] || PRESETS.signature;
  const img = getImageData(source);
  const { width: w, height: h } = img;
  const luma = toLuma(img);

  // strength shifts k: higher strength keeps more faint ink (larger k).
  const kFor = (mult = 1) => preset.k * (0.5 + strength) * mult;
  const band = 10;

  let mask = buildMask(luma, w, h, { k: kFor(), band });
  let ratio = fractionInk(mask);

  // Faint-ink guard (P2-FR-22): nearly nothing detected → re-run once, more aggressive.
  let faint = false;
  if (ratio < 0.004) {
    faint = true;
    mask = buildMask(luma, w, h, { k: kFor(2.2), band });
    ratio = fractionInk(mask);
  }

  removeSpecks(mask, w, h, Math.max(3, Math.round((Math.min(w, h) * preset.speckScale) ** 2)));
  if (thicken) mask = dilateInk(mask, w, h);

  const pad = Math.max(2, Math.round(Math.min(w, h) * 0.04));
  const bbox = inkBBox(mask, w, h, pad);

  // Composite the cropped region onto white using the mask as ink coverage.
  const outData = new Uint8ClampedArray(bbox.w * bbox.h * 4);
  for (let y = 0; y < bbox.h; y++) {
    for (let x = 0; x < bbox.w; x++) {
      const sp = (bbox.y + y) * w + (bbox.x + x);
      const dp = (y * bbox.w + x) * 4;
      const inkness = (255 - mask[sp]) / 255; // 0 paper … 1 ink
      let r, g, b;
      if (ink === "black") {
        const v = mask[sp];
        r = g = b = v;
      } else {
        // keep original ink colour, fade to white on the paper side
        const si = sp * 4;
        r = img.data[si] * inkness + 255 * (1 - inkness);
        g = img.data[si + 1] * inkness + 255 * (1 - inkness);
        b = img.data[si + 2] * inkness + 255 * (1 - inkness);
      }
      outData[dp] = r;
      outData[dp + 1] = g;
      outData[dp + 2] = b;
      outData[dp + 3] = 255;
    }
  }
  const resultCanvas = canvasFromImageData(
    typeof ImageData !== "undefined"
      ? new ImageData(outData, bbox.w, bbox.h)
      : { data: outData, width: bbox.w, height: bbox.h },
  );

  // Report ink ratio of the final crop for the UI / analytics.
  const finalRatio = analyzeInk(getImageData(resultCanvas)).inkRatio;
  return { canvas: resultCanvas, inkRatio: finalRatio, faint };
}

function fractionInk(mask) {
  let ink = 0;
  for (let p = 0; p < mask.length; p++) if (mask[p] < 128) ink++;
  return ink / mask.length;
}
