// JPEG compression to a target KB range (spec §FR-14). The quality search is a pure
// function that only needs an `encode(quality) -> {size}` callback, so it can be unit-tested
// in node with a synthetic size model — no real canvas required. `compressToRange` wires the
// real canvas encoder (and optional dimension step-down) on top of it.

import { bytesToKb, targetKbWindow } from "./units.js";
import { padJpegBlob } from "./encode/padJpeg.js";

// Full-budget search (quality strategy R6): spend the whole KB budget on quality. The floor
// is 0.30 — below that JPEG looks bad and we'd rather warn/pad than ship mush.
const DEFAULT_MIN_QUALITY = 0.3;
const DEFAULT_MAX_QUALITY = 1.0;
const DEFAULT_ITERATIONS = 8;

/**
 * Find the highest JPEG quality whose encoded size is ≤ `targetMaxBytes`.
 * JPEG size is monotonic in quality, so a binary search over [minQuality, maxQuality]
 * converges on the largest file that still fits.
 *
 * @param {(q:number)=>Promise<{size:number}>} encode
 * @returns {Promise<{result, quality}|null>} best fitting encode, or null if even the
 *          lowest quality exceeds the target.
 */
export async function searchQuality({
  encode,
  targetMaxBytes,
  minQuality = DEFAULT_MIN_QUALITY,
  maxQuality = DEFAULT_MAX_QUALITY,
  iterations = DEFAULT_ITERATIONS,
}) {
  let lo = minQuality;
  let hi = maxQuality;
  let best = null;

  // Fast reject: if the lowest quality already exceeds the target, no quality fits.
  const low = await encode(minQuality);
  if (low.size > targetMaxBytes) return null;
  best = { result: low, quality: minQuality };

  for (let i = 0; i < iterations; i++) {
    const mid = (lo + hi) / 2;
    const enc = await encode(mid);
    if (enc.size <= targetMaxBytes) {
      best = { result: enc, quality: mid }; // fits — reach for higher quality/size
      lo = mid;
    } else {
      hi = mid; // too big — back off
    }
  }
  return best;
}

/**
 * Compress a canvas to a JPEG within [minKb, maxKb].
 *
 * @param {object} opts
 * @param {(canvas, quality:number)=>Promise<Blob>} opts.encode  canvas → JPEG blob
 * @param {(canvas, scale:number)=>Promise<any>}   [opts.scaleCanvas] produce a smaller
 *        canvas; only used when `allowDimensionStepDown` is true (spec allows a size range).
 * @param {number} opts.minKb
 * @param {number} opts.maxKb
 * @param {boolean} [opts.allowDimensionStepDown=false]
 * @param {number} [opts.marginKb=2]
 * @returns {Promise<{blob, quality, sizeKb, note, withinHardRange}>}
 */
export async function compressToRange(canvas, opts) {
  const {
    encode,
    scaleCanvas,
    minKb = 0,
    maxKb = Infinity,
    allowDimensionStepDown = false,
    marginKb = 1,
    minQuality = DEFAULT_MIN_QUALITY,
    maxQuality = DEFAULT_MAX_QUALITY,
    iterations = DEFAULT_ITERATIONS,
  } = opts;

  const { targetMinKb, targetMaxKb, hardMinKb, hardMaxKb } = targetKbWindow(
    { minKb, maxKb },
    marginKb,
  );
  const targetMaxBytes = Number.isFinite(targetMaxKb) ? targetMaxKb * 1024 : Infinity;
  const hardMaxBytes = Number.isFinite(hardMaxKb) ? hardMaxKb * 1024 : Infinity;

  let workingCanvas = canvas;
  let scale = 1;
  const MAX_STEPS = 6; // down to ~35% of original before giving up

  for (let step = 0; step < MAX_STEPS; step++) {
    const encodeAt = (q) => encode(workingCanvas, q).then((blob) => ({ size: blob.size, blob }));
    const best = await searchQuality({
      encode: encodeAt,
      targetMaxBytes,
      minQuality,
      maxQuality,
      iterations,
    });

    if (best) {
      let { result, quality } = best;
      let sizeKb = bytesToKb(result.blob.size);

      // Below the min target but fits under max: try to grow by pushing quality to 1.0.
      if (sizeKb < targetMinKb && hardMinKb > 0) {
        const full = await encode(workingCanvas, 1.0);
        if (full.size <= hardMaxBytes) {
          result = { blob: full };
          quality = 1.0;
          sizeKb = bytesToKb(full.size);
        }
      }

      // Below the hard minimum even at q=1.0 → pad with JPEG COM segments (spec §6.3). This
      // adds bytes without changing a pixel, so the file reaches min_kb and still decodes
      // identically. Aim a touch above min for portals that count KB differently.
      let note = "";
      let padded = false;
      if (sizeKb < hardMinKb && hardMinKb > 0) {
        const targetBytes = Math.ceil((hardMinKb + 1) * 1024);
        result = { blob: await padJpegBlob(result.blob, targetBytes) };
        sizeKb = bytesToKb(result.blob.size);
        padded = true;
      }

      const withinHardRange = sizeKb >= hardMinKb && result.blob.size <= hardMaxBytes;
      return { blob: result.blob, quality, sizeKb, note, withinHardRange, padded, scale };
    }

    // Even the lowest quality exceeds max. Step dimensions down if the spec allows it.
    if (!allowDimensionStepDown || !scaleCanvas) {
      // Fixed dimensions: last resort is the smallest-quality encode (may exceed max).
      const floor = await encode(workingCanvas, minQuality);
      const sizeKb = bytesToKb(floor.size);
      return {
        blob: floor,
        quality: minQuality,
        sizeKb,
        note:
          "Could not reach the maximum size at the required fixed dimensions. Try a simpler/less detailed image.",
        withinHardRange: floor.size <= hardMaxBytes,
        scale,
      };
    }
    scale *= 0.85;
    workingCanvas = await scaleCanvas(canvas, scale);
  }

  // Exhausted dimension steps.
  const floor = await encode(workingCanvas, minQuality);
  return {
    blob: floor,
    quality: minQuality,
    sizeKb: bytesToKb(floor.size),
    note: "Could not fit the size range after reducing dimensions. Try a different image.",
    withinHardRange: false,
    scale,
  };
}
