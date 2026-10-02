// Ink coverage for signatures/thumb/declaration (P2-FR-6, P2-FR-22): fraction of pixels
// darker than a threshold, plus how white the paper is. Pure.

import { toLuma } from "./grayscale.js";

/**
 * @returns {{ inkRatio:number, paperBrightness:number }}
 *   inkRatio: share of dark (ink) pixels 0–1; paperBrightness: mean luma of the light
 *   (paper) pixels 0–255.
 */
export function analyzeInk(imageData, { inkCut = 128 } = {}) {
  const luma = toLuma(imageData);
  let ink = 0;
  let paperSum = 0;
  let paperN = 0;
  for (let p = 0; p < luma.length; p++) {
    if (luma[p] <= inkCut) ink++;
    else {
      paperSum += luma[p];
      paperN++;
    }
  }
  const n = luma.length || 1;
  return {
    inkRatio: ink / n,
    paperBrightness: paperN ? paperSum / paperN : 255,
  };
}

// Reasonable bounds for a usable signature scan; tune on the fixture set.
export const INK_MIN = 0.005; // essentially blank / far too faint
export const INK_MAX = 0.4; // smudged / way too heavy
