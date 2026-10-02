import { describe, it, expect } from "vitest";
import { integral, boxMeanField, inkBBox } from "./signatureClean.js";

describe("integral image + box mean", () => {
  it("box mean of a constant field equals the constant", () => {
    const w = 8, h = 8;
    const arr = new Float64Array(w * h).fill(50);
    const mean = boxMeanField(arr, w, h, 2);
    for (const v of mean) expect(v).toBeCloseTo(50, 6);
  });

  it("summed-area table total matches the brute-force sum", () => {
    const w = 4, h = 3;
    const arr = Float64Array.from({ length: w * h }, (_, i) => i + 1);
    const I = integral(arr, w, h);
    const total = I[h * (w + 1) + w]; // bottom-right corner
    expect(total).toBe(arr.reduce((a, v) => a + v, 0));
  });
});

describe("inkBBox", () => {
  it("finds the bounding box of the dark region with padding", () => {
    const w = 10, h = 10;
    const mask = new Float64Array(w * h).fill(255); // all paper
    // Ink block at x 4..5, y 3..6.
    for (let y = 3; y <= 6; y++) for (let x = 4; x <= 5; x++) mask[y * w + x] = 0;
    const box = inkBBox(mask, w, h, 1);
    expect(box.x).toBe(3);
    expect(box.y).toBe(2);
    expect(box.w).toBe(4); // 4..5 + 1px pad each side
    expect(box.h).toBe(6); // 3..6 + 1px pad each side
  });

  it("keeps the whole image when no ink is present", () => {
    const box = inkBBox(new Float64Array(16).fill(255), 4, 4, 2);
    expect(box).toEqual({ x: 0, y: 0, w: 4, h: 4 });
  });
});
