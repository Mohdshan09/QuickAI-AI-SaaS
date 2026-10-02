// Checker mode (spec §4.1): validate an uploaded file against an exam doc spec WITHOUT
// processing it. Hard checks (format/width/height/size) reuse the Phase 1 validator verbatim
// so results match exactly (acceptance §7). Soft checks add non-blocking warnings.
// Format is detected from the real bytes, not the extension (P2-FR-1).

import { formatOfFile } from "./analyze/magicBytes.js";
import { loadImage } from "./loadImage.js";
import { validate } from "./validate.js";
import { createCanvas, getImageData } from "./canvasEnv.js";
import { isBlurry } from "./analyze/blur.js";
import { analyzeBackground } from "./analyze/background.js";
import { analyzeExposure } from "./analyze/exposure.js";
import { analyzeInk, INK_MIN, INK_MAX } from "./analyze/inkRatio.js";

const INK_TYPES = new Set(["signature", "thumb", "declaration"]);

// Draw the decoded bitmap into a small working canvas for pixel analysis (speed on mobile).
function analysisImageData(bitmap, maxEdge = 1000) {
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const c = createCanvas(w, h);
  c.getContext("2d").drawImage(bitmap, 0, 0, w, h);
  return getImageData(c);
}

/**
 * @param {File|Blob} file
 * @param {object} docSpec resolved spec (same shape the engine uses)
 * @returns {Promise<{ format, hard:{pass,checks}, soft:Array<{rule,level,message}> }>}
 */
export async function check(file, docSpec) {
  const format = await formatOfFile(file);
  const { bitmap } = await loadImage(file);

  // Hard checks — identical logic to the Phase 1 validator.
  const hard = validate(
    { sizeBytes: file.size, width: bitmap.width, height: bitmap.height, format },
    docSpec,
  );

  // Soft checks (warnings, never blocking).
  const soft = [];
  const px = analysisImageData(bitmap);
  bitmap.close?.();

  if (isBlurry(px)) {
    soft.push({ rule: "blur", level: "warn", message: "Image looks blurry — use a sharper photo." });
  }

  const exp = analyzeExposure(px);
  if (exp.tooDark) soft.push({ rule: "exposure", level: "warn", message: "Photo looks too dark." });
  if (exp.overexposed) soft.push({ rule: "exposure", level: "warn", message: "Photo looks overexposed." });

  if (docSpec.type === "photo" && (docSpec.background === "white" || docSpec.background === "light")) {
    const bg = analyzeBackground(px);
    if (!bg.isWhite) {
      soft.push({ rule: "background", level: "warn", message: "Background may not be white/plain enough." });
    }
  }

  if (INK_TYPES.has(docSpec.type)) {
    const { inkRatio, paperBrightness } = analyzeInk(px);
    if (inkRatio < INK_MIN) soft.push({ rule: "ink", level: "warn", message: "Signature looks very faint." });
    else if (inkRatio > INK_MAX) soft.push({ rule: "ink", level: "warn", message: "Signature looks too heavy/smudged." });
    if (paperBrightness < 200) soft.push({ rule: "paper", level: "warn", message: "Paper is not white — sign on plain white paper." });
  }

  return { format, hard, soft };
}
