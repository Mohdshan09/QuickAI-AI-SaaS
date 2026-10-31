import { describe, expect, it } from "vitest";
import { buildPdfFromJpeg } from "./pdf.js";

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 5, 6, 0xff, 0xd9]);

describe("buildPdfFromJpeg", () => {
  const pdf = buildPdfFromJpeg(jpeg, 200, 230);
  const text = Buffer.from(pdf).toString("latin1");

  it("has a valid PDF structure", () => {
    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text.trimEnd().endsWith("%%EOF")).toBe(true);
    expect(text).toContain("trailer");
    expect(text).toContain("startxref");
  });

  it("declares the exact pixel size as the page MediaBox", () => {
    expect(text).toContain("/MediaBox [0 0 200 230]");
    expect(text).toContain("/Width 200");
    expect(text).toContain("/Height 230");
  });

  it("embeds the JPEG untouched with DCTDecode", () => {
    expect(text).toContain("/Filter /DCTDecode");
    expect(text).toContain(`/Length ${jpeg.length}`);
    const streamAt = text.indexOf("stream\n");
    const embedded = pdf.subarray(streamAt + 7, streamAt + 7 + jpeg.length);
    expect(Array.from(embedded)).toEqual(Array.from(jpeg));
  });

  it("writes xref offsets that point at each object", () => {
    const entries = [...text.matchAll(/(\d{10}) 00000 n /g)].map((m) => Number(m[1]));
    expect(entries).toHaveLength(5);
    for (const id of [1, 2, 3, 4, 5]) {
      const at = entries[id - 1];
      expect(at).toBeGreaterThan(0);
      expect(text.slice(at, at + `${id} 0 obj`.length)).toBe(`${id} 0 obj`);
    }
  });
});
