import { describe, it, expect } from "vitest";
import { cmToPx, resolveDimensionPx, targetKbWindow, bytesToKb, kbToBytes } from "./units.js";

describe("units", () => {
  it("converts cm to px with px = round(cm/2.54*dpi)", () => {
    expect(cmToPx(2.54, 100)).toBe(100);
    expect(cmToPx(3.5, 200)).toBe(276); // round(3.5/2.54*200)
  });

  it("resolves px and cm+dpi dimension descriptors", () => {
    expect(resolveDimensionPx({ px: 350 })).toBe(350);
    expect(resolveDimensionPx(350)).toBe(350);
    expect(resolveDimensionPx({ cm: 3.5, dpi: 200 })).toBe(276);
    expect(resolveDimensionPx({ cm: 3.5 }, 200)).toBe(276); // dpi fallback
  });

  it("throws on a cm dimension with no dpi", () => {
    expect(() => resolveDimensionPx({ cm: 3.5 })).toThrow();
  });

  it("round-trips KB<->bytes at 1024", () => {
    expect(kbToBytes(1)).toBe(1024);
    expect(bytesToKb(2048)).toBe(2);
  });

  it("aims inside the KB range with a safety margin", () => {
    const w = targetKbWindow({ minKb: 20, maxKb: 50 }, 2);
    expect(w.targetMinKb).toBe(22);
    expect(w.targetMaxKb).toBe(48);
    expect(w.hardMinKb).toBe(20);
    expect(w.hardMaxKb).toBe(50);
  });

  it("does not invert a tight range with the margin", () => {
    const w = targetKbWindow({ minKb: 19, maxKb: 20 }, 2);
    expect(w.targetMinKb).toBeLessThanOrEqual(w.targetMaxKb);
  });
});
