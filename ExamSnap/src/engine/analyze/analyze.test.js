import { describe, it, expect } from "vitest";
import { laplacianVariance } from "./blur.js";
import { analyzeBackground } from "./background.js";
import { analyzeExposure } from "./exposure.js";
import { analyzeInk } from "./inkRatio.js";

// Build an ImageData-like object from a per-pixel RGB function.
function makeImage(w, h, fn) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b] = fn(x, y);
      const i = (y * w + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  }
  return { data, width: w, height: h };
}

const solid = (w, h, v) => makeImage(w, h, () => [v, v, v]);

describe("blur", () => {
  it("flat image has ~zero Laplacian variance; a checkerboard has high", () => {
    expect(laplacianVariance(solid(20, 20, 128))).toBeLessThan(1);
    const checker = makeImage(20, 20, (x, y) => {
      const v = (x + y) % 2 ? 255 : 0;
      return [v, v, v];
    });
    expect(laplacianVariance(checker)).toBeGreaterThan(100);
  });
});

describe("background", () => {
  it("white border passes; dark border fails", () => {
    expect(analyzeBackground(solid(40, 40, 250)).isWhite).toBe(true);
    expect(analyzeBackground(solid(40, 40, 100)).isWhite).toBe(false);
  });
});

describe("exposure", () => {
  it("flags too-dark and overexposed", () => {
    expect(analyzeExposure(solid(20, 20, 10)).tooDark).toBe(true);
    expect(analyzeExposure(solid(20, 20, 255)).overexposed).toBe(true);
    expect(analyzeExposure(solid(20, 20, 128)).tooDark).toBe(false);
  });
});

describe("inkRatio", () => {
  it("measures the dark fraction and paper brightness", () => {
    // Left half black (ink), right half white (paper).
    const img = makeImage(10, 10, (x) => (x < 5 ? [0, 0, 0] : [255, 255, 255]));
    const { inkRatio, paperBrightness } = analyzeInk(img);
    expect(inkRatio).toBeCloseTo(0.5, 1);
    expect(paperBrightness).toBeGreaterThan(250);
  });
});
