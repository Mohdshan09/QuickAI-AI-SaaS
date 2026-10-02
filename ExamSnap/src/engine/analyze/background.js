// Background whiteness/uniformity from the border pixels (P2-FR-4). Used both by the
// checker (soft warning) and by 2c Tier 1 (skip processing if already white). Pure.

/**
 * Sample a frame of pixels `band` deep around the image edge and measure how white and how
 * uniform they are.
 * @returns {{ brightness:number, uniformity:number, isWhite:boolean }}
 *   brightness 0–255 (mean border luma); uniformity 0–1 (1 = perfectly flat border).
 */
export function analyzeBackground({ data, width, height }, { band, whiteMin = 235, flatMin = 0.85 } = {}) {
  const depth = band ?? Math.max(2, Math.round(Math.min(width, height) * 0.06));
  const lumas = [];
  const isBorder = (x, y) => x < depth || y < depth || x >= width - depth || y >= height - depth;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!isBorder(x, y)) continue;
      const i = (y * width + x) * 4;
      lumas.push(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    }
  }

  const n = lumas.length || 1;
  const mean = lumas.reduce((a, v) => a + v, 0) / n;
  const variance = lumas.reduce((a, v) => a + (v - mean) * (v - mean), 0) / n;
  const std = Math.sqrt(variance);
  // Map std-dev (0 = flat) to a 0–1 uniformity score; 48 luma spread → 0.
  const uniformity = Math.max(0, 1 - std / 48);

  return {
    brightness: mean,
    uniformity,
    isWhite: mean >= whiteMin && uniformity >= flatMin,
  };
}
