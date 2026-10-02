// Tier 2 (spec §4.3): brighten a PLAIN background to white with no ML (P2-FR-27). Flood-fill
// from the image borders by colour similarity to find the background region, then push it to
// pure white with a soft edge. Leak detection (P2-FR-28): if the region grows too large or
// reaches the centre (the face area), discard and let the caller offer the deferred ML tier.
// Pure (canvas in → { canvas, leaked } out).

import { getImageData, canvasFromImageData } from "../../canvasEnv.js";

export function brightenBackground(canvas, { tolerance = 32, maxCoverage = 0.7 } = {}) {
  const img = getImageData(canvas);
  const { width: w, height: h, data } = img;
  const N = w * h;
  const inBg = new Uint8Array(N);
  const stack = [];

  const seed = (x, y) => {
    const p = y * w + x;
    if (!inBg[p]) {
      inBg[p] = 1;
      stack.push(p);
    }
  };
  // Seed every border pixel.
  for (let x = 0; x < w; x++) {
    seed(x, 0);
    seed(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    seed(0, y);
    seed(w - 1, y);
  }

  const tol2 = tolerance * tolerance;
  const close = (a, b) => {
    const dr = data[a] - data[b];
    const dg = data[a + 1] - data[b + 1];
    const db = data[a + 2] - data[b + 2];
    return dr * dr + dg * dg + db * db <= tol2 * 3;
  };

  let count = 0;
  while (stack.length) {
    const p = stack.pop();
    count++;
    const x = p % w;
    const y = (p / w) | 0;
    const pi = p * 4;
    const nb = [];
    if (x > 0) nb.push(p - 1);
    if (x < w - 1) nb.push(p + 1);
    if (y > 0) nb.push(p - w);
    if (y < h - 1) nb.push(p + w);
    for (const q of nb) {
      if (!inBg[q] && close(pi, q * 4)) {
        inBg[q] = 1;
        stack.push(q);
      }
    }
  }

  // Leak detection: too much of the image, or the fill reached the central face box.
  const coverage = count / N;
  const cx0 = Math.round(w * 0.3), cx1 = Math.round(w * 0.7);
  const cy0 = Math.round(h * 0.25), cy1 = Math.round(h * 0.75);
  let centreHits = 0;
  for (let y = cy0; y < cy1; y++) {
    for (let x = cx0; x < cx1; x++) if (inBg[y * w + x]) centreHits++;
  }
  const centreArea = (cx1 - cx0) * (cy1 - cy0) || 1;
  const leaked = coverage > maxCoverage || centreHits / centreArea > 0.15;
  if (leaked) return { canvas, leaked: true };

  // Push the background to white with a soft edge: distance-free 1px feather by blending
  // border-adjacent foreground pixels slightly.
  const out = new Uint8ClampedArray(data);
  for (let p = 0; p < N; p++) {
    if (inBg[p]) {
      const i = p * 4;
      out[i] = out[i + 1] = out[i + 2] = 255;
      out[i + 3] = 255;
    }
  }
  // Light feather: any foreground pixel touching the background softens toward white.
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      if (inBg[p]) continue;
      const edge =
        (x > 0 && inBg[p - 1]) ||
        (x < w - 1 && inBg[p + 1]) ||
        (y > 0 && inBg[p - w]) ||
        (y < h - 1 && inBg[p + w]);
      if (edge) {
        const i = p * 4;
        out[i] = (out[i] + 255) / 2;
        out[i + 1] = (out[i + 1] + 255) / 2;
        out[i + 2] = (out[i + 2] + 255) / 2;
      }
    }
  }

  const result = canvasFromImageData(
    typeof ImageData !== "undefined" ? new ImageData(out, w, h) : { data: out, width: w, height: h },
  );
  return { canvas: result, leaked: false, coverage };
}
