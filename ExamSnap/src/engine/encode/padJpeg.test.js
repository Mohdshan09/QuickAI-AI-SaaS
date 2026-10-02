import { describe, it, expect } from "vitest";
import { padJpegBytes } from "./padJpeg.js";

// Minimal fake JPEG: SOI + a scan + EOI. padJpeg must keep these bytes intact.
function fakeJpeg(scanLen = 20) {
  const scan = new Uint8Array(scanLen).map((_, i) => (i * 7 + 3) & 0xff);
  const bytes = new Uint8Array(2 + scanLen + 2);
  bytes[0] = 0xff;
  bytes[1] = 0xd8; // SOI
  bytes.set(scan, 2);
  bytes[2 + scanLen] = 0xff;
  bytes[3 + scanLen] = 0xd9; // EOI
  return { bytes, scan };
}

describe("padJpegBytes", () => {
  it("returns the original when already large enough / not a JPEG", () => {
    const { bytes } = fakeJpeg();
    expect(padJpegBytes(bytes, bytes.length)).toBe(bytes);
    const notJpeg = new Uint8Array([1, 2, 3, 4]);
    expect(padJpegBytes(notJpeg, 999)).toBe(notJpeg);
  });

  it("pads up to at least the target and stays a valid JPEG", () => {
    const { bytes } = fakeJpeg();
    const target = bytes.length + 500;
    const out = padJpegBytes(bytes, target);
    expect(out.length).toBeGreaterThanOrEqual(target);
    expect(out[0]).toBe(0xff);
    expect(out[1]).toBe(0xd8); // still SOI first
  });

  it("inserts a well-formed COM segment with a correct length field", () => {
    const { bytes } = fakeJpeg();
    const out = padJpegBytes(bytes, bytes.length + 100);
    // Right after SOI we expect FF FE <len>.
    expect(out[2]).toBe(0xff);
    expect(out[3]).toBe(0xfe);
    const segLen = (out[4] << 8) | out[5];
    // length field counts itself (2) + payload; segment total = segLen + 2 (marker)
    const payload = segLen - 2;
    expect(payload).toBeGreaterThan(0);
  });

  it("leaves the original scan + EOI bytes unchanged (decodes identically)", () => {
    const { bytes, scan } = fakeJpeg(30);
    const out = padJpegBytes(bytes, bytes.length + 1000);
    // The original stream after SOI reappears at the very end, intact.
    const tail = out.subarray(out.length - (scan.length + 2));
    expect(Array.from(tail.subarray(0, scan.length))).toEqual(Array.from(scan));
    expect(tail[tail.length - 2]).toBe(0xff);
    expect(tail[tail.length - 1]).toBe(0xd9); // EOI
  });

  it("uses multiple COM segments for pads larger than one segment", () => {
    const { bytes } = fakeJpeg();
    const out = padJpegBytes(bytes, bytes.length + 150000); // > 65533 → needs ≥3 segments
    let count = 0;
    for (let i = 2; i < out.length - 1; i++) {
      if (out[i] === 0xff && out[i + 1] === 0xfe) count++;
    }
    expect(count).toBeGreaterThanOrEqual(3);
  });
});
