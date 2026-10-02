import { describe, it, expect } from "vitest";
import { sniffFormat } from "./magicBytes.js";

const bytes = (...a) => new Uint8Array(a);
const withAscii = (offset, str, len = offset + str.length) => {
  const arr = new Uint8Array(len);
  for (let i = 0; i < str.length; i++) arr[offset + i] = str.charCodeAt(i);
  return arr;
};

describe("sniffFormat", () => {
  it("detects JPEG", () => {
    expect(sniffFormat(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("jpeg");
  });

  it("detects a PNG even when the extension lied (renamed .jpg)", () => {
    expect(sniffFormat(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe("png");
  });

  it("detects GIF, BMP", () => {
    expect(sniffFormat(bytes(0x47, 0x49, 0x46, 0x38, 0x39, 0x61))).toBe("gif");
    expect(sniffFormat(bytes(0x42, 0x4d, 0, 0))).toBe("bmp");
  });

  it("detects WebP (RIFF....WEBP)", () => {
    const b = new Uint8Array(12);
    "RIFF".split("").forEach((c, i) => (b[i] = c.charCodeAt(0)));
    "WEBP".split("").forEach((c, i) => (b[8 + i] = c.charCodeAt(0)));
    expect(sniffFormat(b)).toBe("webp");
  });

  it("detects HEIC via ftyp brand", () => {
    const b = withAscii(4, "ftyp", 12);
    "heic".split("").forEach((c, i) => (b[8 + i] = c.charCodeAt(0)));
    expect(sniffFormat(b)).toBe("heic");
  });

  it("returns unknown for junk", () => {
    expect(sniffFormat(bytes(1, 2, 3, 4))).toBe("unknown");
    expect(sniffFormat(bytes(1))).toBe("unknown");
  });
});
