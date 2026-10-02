// Blur detection via the variance of the Laplacian (P2-FR-3): a sharp image has strong
// high-frequency edges (high variance); a blurry one is smooth (low variance). Pure.

import { toLuma } from "./grayscale.js";

/** @returns {number} variance of the Laplacian; higher = sharper. */
export function laplacianVariance(imageData) {
  const { width, height } = imageData;
  if (width < 3 || height < 3) return 0;
  const luma = toLuma(imageData);
  const at = (x, y) => luma[y * width + x];

  let sum = 0;
  let sumSq = 0;
  let n = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      // 4-neighbour Laplacian kernel.
      const lap = at(x - 1, y) + at(x + 1, y) + at(x, y - 1) + at(x, y + 1) - 4 * at(x, y);
      sum += lap;
      sumSq += lap * lap;
      n++;
    }
  }
  const mean = sum / n;
  return sumSq / n - mean * mean;
}

// Below this, a photo reads as soft/blurry. Empirical; tune against the fixture set.
export const BLUR_THRESHOLD = 60;

export function isBlurry(imageData, threshold = BLUR_THRESHOLD) {
  return laplacianVariance(imageData) < threshold;
}
