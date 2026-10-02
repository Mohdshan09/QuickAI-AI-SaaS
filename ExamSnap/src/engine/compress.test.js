import { describe, it, expect } from "vitest";
import { searchQuality, compressToRange } from "./compress.js";

// A fake blob whose size is a deterministic function of quality, so the search logic can be
// tested without a real canvas. `bytesPerQuality` sets how steep the size curve is.
const fakeEncoder = (bytesPerQuality) => (_canvas, q) =>
  Promise.resolve({ size: Math.round(q * bytesPerQuality), type: "image/jpeg" });

describe("searchQuality", () => {
  it("finds the largest quality whose size is <= target", async () => {
    const encode = (q) => Promise.resolve({ size: Math.round(q * 100000) });
    const best = await searchQuality({ encode, targetMaxBytes: 40000 });
    expect(best).not.toBeNull();
    expect(best.result.size).toBeLessThanOrEqual(40000);
    // Should be close to the boundary (q ~ 0.4).
    expect(best.quality).toBeGreaterThan(0.35);
    expect(best.quality).toBeLessThanOrEqual(0.4);
  });

  it("returns null when even the lowest quality exceeds the target", async () => {
    const encode = (q) => Promise.resolve({ size: Math.round(q * 100000) });
    const best = await searchQuality({ encode, targetMaxBytes: 5000 }); // min q=0.1 -> 10000
    expect(best).toBeNull();
  });
});

describe("compressToRange", () => {
  it("lands inside the KB range for a normal image", async () => {
    const res = await compressToRange({}, {
      encode: fakeEncoder(102400), // q=1 -> 100 KB
      minKb: 20,
      maxKb: 50,
    });
    expect(res.withinHardRange).toBe(true);
    expect(res.sizeKb).toBeLessThanOrEqual(50);
    expect(res.sizeKb).toBeGreaterThanOrEqual(20);
  });

  it("pads up to the minimum when an image is below min even at top quality (§6.3)", async () => {
    // Encoder returns a real JPEG-header Blob so COM padding can apply.
    const jpegBlob = (size) => {
      const b = new Uint8Array(Math.max(4, size));
      b[0] = 0xff;
      b[1] = 0xd8; // SOI
      b[b.length - 2] = 0xff;
      b[b.length - 1] = 0xd9; // EOI
      return new Blob([b], { type: "image/jpeg" });
    };
    const res = await compressToRange({}, {
      encode: (_c, q) => Promise.resolve(jpegBlob(Math.round(q * 1024))), // ~1 KB, far below min
      minKb: 20,
      maxKb: 50,
    });
    expect(res.padded).toBe(true);
    expect(res.sizeKb).toBeGreaterThanOrEqual(20);
    expect(res.withinHardRange).toBe(true);
  });

  it("falls back at fixed dimensions when it cannot get under max", async () => {
    const res = await compressToRange({}, {
      encode: fakeEncoder(10 * 1024 * 1024), // always far above max
      minKb: 20,
      maxKb: 50,
      allowDimensionStepDown: false,
    });
    expect(res.withinHardRange).toBe(false);
    expect(res.note).toMatch(/fixed dimensions/i);
  });

  it("steps dimensions down when the spec allows a size range", async () => {
    // Size depends on canvas scale: start too big, shrink until it fits.
    const encode = (canvas, q) =>
      Promise.resolve({ size: Math.round(q * 200 * 1024 * (canvas.scale ?? 1)) });
    const scaleCanvas = (_canvas, scale) => ({ scale });
    const res = await compressToRange(
      { scale: 1 },
      { encode, scaleCanvas, minKb: 20, maxKb: 50, allowDimensionStepDown: true },
    );
    expect(res.scale).toBeLessThan(1);
    expect(res.sizeKb).toBeLessThanOrEqual(50);
  });
});
