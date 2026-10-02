// Tier 1 (spec §4.3): reuse analyze/background to decide whether the photo's background is
// already white/light enough. If it passes, the pipeline skips all background processing
// (P2-FR-26). Pure wrapper over a canvas.

import { getImageData } from "../../canvasEnv.js";
import { analyzeBackground } from "../../analyze/background.js";

export function checkBackground(canvas, opts) {
  return analyzeBackground(getImageData(canvas), opts); // { brightness, uniformity, isWhite }
}
