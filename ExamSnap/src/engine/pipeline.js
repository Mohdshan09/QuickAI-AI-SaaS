// Composable image pipeline (spec §3). An ordered list of skippable steps runs over a shared
// context; each step is guarded so it no-ops when it doesn't apply, which keeps every step
// independently testable and lets Phase 2 features (signature cleanup, background, strip) slot
// in without disturbing the Phase 1 stages. Framework-free: runs in the worker or main thread.
//
// Effective order (see the plan's "deviations" note):
//   load → crop → preprocess(type) → background(photo) → resize → strip(photo) → compress → validate

import { loadImage } from "./loadImage.js";
import { cropToCanvas } from "./crop.js";
import { resizeToSpec, scaleCanvas, SHARPEN } from "./resize.js";
import { compressToRange } from "./compress.js";
import { validate } from "./validate.js";
import { encodeJpeg } from "./canvasEnv.js";
import { cleanSignature } from "./steps/signatureClean.js";
import { checkBackground } from "./steps/background/check.js";
import { brightenBackground } from "./steps/background/brighten.js";
import { applyStrip, photoHeight } from "./steps/strip.js";

const INK_TYPES = new Set(["signature", "thumb", "declaration"]);

/**
 * @param {object} ctx { file, docSpec, cropPixels, rotationDeg, options }
 *   options: { cleanup?:{strength,ink,thicken}, background?:"brighten"|false, strip?:{name,date} }
 * @returns {Promise<{ blob, meta, validation }>}
 */
export async function run(ctx) {
  const { file, docSpec, cropPixels, rotationDeg = 0, options = {} } = ctx;
  const meta = {};

  // 1. load
  const { bitmap } = await loadImage(file);

  // 2. crop
  let canvas = cropToCanvas({ bitmap, cropPixels, rotationDeg });
  bitmap.close?.();

  // 3. preprocess(type) — ink documents get cleanup; photo is a no-op.
  const isInk = INK_TYPES.has(docSpec.type);
  if (isInk) {
    const res = cleanSignature(canvas, { type: docSpec.type, ...(options.cleanup || {}) });
    canvas = res.canvas;
    meta.inkRatio = res.inkRatio;
    meta.faint = res.faint;
  }

  // 4. background (photo only): always report Tier-1 for white/light specs; brighten on request.
  const needsWhite = docSpec.type === "photo" && (docSpec.background === "white" || docSpec.background === "light");
  if (needsWhite) {
    const bg = checkBackground(canvas);
    meta.background = { isWhite: bg.isWhite, brightness: Math.round(bg.brightness), tier: 1 };
    if (!bg.isWhite && options.background === "brighten") {
      const { canvas: brightened, leaked } = brightenBackground(canvas);
      if (!leaked) {
        canvas = brightened;
        meta.background.tier = 2;
      } else {
        meta.background.leaked = true; // caller may offer the deferred ML tier
      }
    }
  }

  // Never-upscale guard (quality strategy R4): we must still output the exact required size,
  // but flag when the source is smaller so the UI can warn instead of pretending it's sharp.
  const targetH = docSpec.type === "photo" && docSpec.strip ? photoHeight(docSpec.height, docSpec.strip.heightPx) : docSpec.height;
  if (canvas.width < docSpec.width || canvas.height < targetH) {
    meta.sourceSmallerThanTarget = true;
  }

  // 5. resize (+ 6. strip for photos that define one)
  const fit = isInk ? "contain" : "fill";
  const sharpen = SHARPEN[docSpec.type] || SHARPEN.photo;
  let sized;
  if (docSpec.type === "photo" && docSpec.strip) {
    const body = await resizeToSpec(canvas, { width: docSpec.width, height: targetH, background: docSpec.background, fit, sharpen });
    sized = applyStrip(body, {
      width: docSpec.width,
      height: docSpec.height,
      strip: docSpec.strip,
      name: options.strip?.name || "",
      date: options.strip?.date,
    });
    meta.stripApplied = true;
  } else {
    sized = await resizeToSpec(canvas, { width: docSpec.width, height: docSpec.height, background: docSpec.background, fit, sharpen });
  }

  // 7. compress
  const { blob, quality, sizeKb, note, withinHardRange, padded } = await compressToRange(sized, {
    encode: encodeJpeg,
    scaleCanvas,
    minKb: docSpec.minKb ?? 0,
    maxKb: docSpec.maxKb ?? Infinity,
    allowDimensionStepDown: Boolean(docSpec.allowDimensionStepDown),
  });

  Object.assign(meta, {
    sizeBytes: blob.size,
    width: sized.width,
    height: sized.height,
    format: "jpeg",
    quality,
    sizeKb,
    note,
    withinHardRange,
    padded: Boolean(padded),
  });

  // 8. validate
  const validation = validate(meta, docSpec);
  return { blob, meta, validation };
}
