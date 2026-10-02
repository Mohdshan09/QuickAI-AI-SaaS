import { describe, it, expect } from "vitest";
import { specHash, canonicalSpec } from "./specHash.js";

describe("specHash", () => {
  const a = [
    { type: "photo", width: 200, height: 230, minKb: 20, maxKb: 50 },
    { type: "signature", width: 300, height: 80, minKb: 10, maxKb: 20 },
  ];

  it("is stable regardless of document order", () => {
    expect(specHash(a)).toBe(specHash([a[1], a[0]]));
  });

  it("differs when any dimension or size differs", () => {
    const b = [{ ...a[0], maxKb: 60 }, a[1]];
    expect(specHash(a)).not.toBe(specHash(b));
  });

  it("ignores live-capture documents", () => {
    const withLive = [...a, { type: "photoLive", isLive: true, width: 1, height: 1 }];
    expect(specHash(withLive)).toBe(specHash(a));
  });

  it("canonical form normalises infinite/absent max to null", () => {
    const [doc] = canonicalSpec([{ type: "signature", width: 300, height: 80, minKb: 10, maxKb: Infinity }]);
    expect(doc.maxKb).toBeNull();
  });
});
