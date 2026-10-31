import { describe, it, expect } from "vitest";
import { parseKbRange, parsePixels, parseDocType, parseSpecText, isPlausibleKb } from "./specChatParse.js";

describe("parseKbRange", () => {
  it("parses hyphen and dash ranges", () => {
    expect(parseKbRange("10-20")).toEqual({ minKb: 10, maxKb: 20 });
    expect(parseKbRange("10–20 kb")).toEqual({ minKb: 10, maxKb: 20 });
  });
  it("parses word ranges (en + hi)", () => {
    expect(parseKbRange("10 to 20")).toEqual({ minKb: 10, maxKb: 20 });
    expect(parseKbRange("20 se 50")).toEqual({ minKb: 20, maxKb: 50 });
  });
  it("parses max-only phrasings", () => {
    expect(parseKbRange("up to 50")).toEqual({ minKb: 0, maxKb: 50 });
    expect(parseKbRange("50 tak")).toEqual({ minKb: 0, maxKb: 50 });
    expect(parseKbRange("max 100")).toEqual({ minKb: 0, maxKb: 100 });
  });
  it("parses a bare KB value as the max", () => {
    expect(parseKbRange("20kb")).toEqual({ minKb: 0, maxKb: 20 });
    expect(parseKbRange("20 केबी")).toEqual({ minKb: 0, maxKb: 20 });
  });
  it("normalizes Devanagari digits and swaps reversed ranges", () => {
    expect(parseKbRange("२०-५०")).toEqual({ minKb: 20, maxKb: 50 });
    expect(parseKbRange("50-20")).toEqual({ minKb: 20, maxKb: 50 });
  });
  it("returns null when nothing parses", () => {
    expect(parseKbRange("hello")).toBeNull();
    expect(parseKbRange("")).toBeNull();
  });
  it("does not mistake a pixel size for a KB range", () => {
    // "200x230" has no range separator; a pixel pair must not become KB.
    expect(parseKbRange("200x230")).toBeNull();
  });
});

describe("parsePixels", () => {
  it("parses common separators", () => {
    expect(parsePixels("200x230")).toEqual({ width: 200, height: 230 });
    expect(parsePixels("200×230")).toEqual({ width: 200, height: 230 });
    expect(parsePixels("300 by 100")).toEqual({ width: 300, height: 100 });
    expect(parsePixels("200*230 px")).toEqual({ width: 200, height: 230 });
  });
  it("returns null for non-pixel text", () => {
    expect(parsePixels("10-20 kb")).toBeNull();
  });
});

describe("parseDocType", () => {
  it("detects photo and signature keywords", () => {
    expect(parseDocType("photo")).toBe("photo");
    expect(parseDocType("मेरी फोटो")).toBe("photo");
    expect(parseDocType("signature")).toBe("signature");
    expect(parseDocType("हस्ताक्षर बनाना है")).toBe("signature");
  });
  it("returns null otherwise", () => {
    expect(parseDocType("clerk exam")).toBeNull();
  });
});

describe("parseSpecText", () => {
  it("parses a full combined message", () => {
    expect(parseSpecText("IBPS PO clerk photo 10-20 kb 200x230")).toEqual({
      name: "IBPS PO clerk",
      type: "photo",
      minKb: 10,
      maxKb: 20,
      width: 200,
      height: 230,
    });
  });
  it("parses Hindi phrasing", () => {
    const out = parseSpecText("SSC GD हस्ताक्षर 10 से 20 केबी");
    expect(out.type).toBe("signature");
    expect(out.minKb).toBe(10);
    expect(out.maxKb).toBe(20);
    expect(out.name).toContain("SSC GD");
  });
  it("keeps a plain exam name", () => {
    expect(parseSpecText("State PSC Clerk 2026")).toEqual({ name: "State PSC Clerk 2026" });
  });
  it("returns {} for empty input", () => {
    expect(parseSpecText("")).toEqual({});
  });
});

describe("isPlausibleKb", () => {
  it("accepts realistic exam caps and rejects absurd ones", () => {
    expect(isPlausibleKb(20, 10)).toBe(true);
    expect(isPlausibleKb(50, 0)).toBe(true);
    expect(isPlausibleKb(0, 0)).toBe(false);
    expect(isPlausibleKb(999999, 0)).toBe(false);
  });
});
