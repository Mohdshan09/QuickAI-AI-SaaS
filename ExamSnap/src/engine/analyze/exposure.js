// Exposure check from the luma histogram (P2-FR-5): flags photos that are too dark or
// blown out. Pure.

import { toLuma } from "./grayscale.js";

/**
 * @returns {{ mean:number, darkFraction:number, brightFraction:number,
 *             tooDark:boolean, overexposed:boolean }}
 */
export function analyzeExposure(imageData, { darkCut = 40, brightCut = 250, maxDark = 0.5, maxBright = 0.25 } = {}) {
  const luma = toLuma(imageData);
  let sum = 0;
  let dark = 0;
  let bright = 0;
  for (let p = 0; p < luma.length; p++) {
    sum += luma[p];
    if (luma[p] <= darkCut) dark++;
    if (luma[p] >= brightCut) bright++;
  }
  const n = luma.length || 1;
  const darkFraction = dark / n;
  const brightFraction = bright / n;
  return {
    mean: sum / n,
    darkFraction,
    brightFraction,
    tooDark: darkFraction > maxDark,
    overexposed: brightFraction > maxBright,
  };
}
