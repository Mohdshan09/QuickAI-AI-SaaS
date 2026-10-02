import { describe, it, expect } from "vitest";
import { setJpegDpiBytes } from "./jfifDpi.js";

// Minimal JPEG: SOI + JFIF APP0 (units=0, density 1x1) + EOI.
const withApp0 = () =>
  new Uint8Array([
    0xff, 0xd8,
    0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01,
    0x00, // units = 0
    0x00, 0x01, 0x00, 0x01, // Xd=1, Yd=1
    0x00, 0x00,
    0xff, 0xd9,
  ]);

function readApp0(bytes) {
  // Assumes APP0 is the first segment after SOI.
  return {
    isApp0: bytes[2] === 0xff && bytes[3] === 0xe0,
    units: bytes[13],
    xDensity: (bytes[14] << 8) | bytes[15],
    yDensity: (bytes[16] << 8) | bytes[17],
  };
}

describe("setJpegDpiBytes", () => {
  it("patches the density of an existing JFIF APP0 without changing length", () => {
    const input = withApp0();
    const out = setJpegDpiBytes(input, 100);
    expect(out.length).toBe(input.length);
    const app0 = readApp0(out);
    expect(app0.units).toBe(1);
    expect(app0.xDensity).toBe(100);
    expect(app0.yDensity).toBe(100);
  });

  it("inserts a JFIF APP0 when none is present", () => {
    const input = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]); // SOI + EOI only
    const out = setJpegDpiBytes(input, 300);
    expect(out.length).toBeGreaterThan(input.length);
    const app0 = readApp0(out);
    expect(app0.isApp0).toBe(true);
    expect(app0.units).toBe(1);
    expect(app0.xDensity).toBe(300);
  });

  it("leaves non-JPEG bytes and non-positive dpi untouched", () => {
    const notJpeg = new Uint8Array([0x01, 0x02, 0x03]);
    expect(setJpegDpiBytes(notJpeg, 100)).toBe(notJpeg);
    const jpeg = withApp0();
    expect(setJpegDpiBytes(jpeg, 0)).toBe(jpeg);
  });
});
