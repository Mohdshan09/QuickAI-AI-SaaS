import { describe, it, expect } from "vitest";
import { normalizeExamName } from "./normalize.js";

describe("normalizeExamName", () => {
  it("resolves punctuation, hyphen, case and year variants to one form", () => {
    const want = "ssc cgl";
    expect(normalizeExamName("SSC CGL")).toBe(want);
    expect(normalizeExamName("ssc-cgl")).toBe(want);
    expect(normalizeExamName("SSC-CGL 2026")).toBe(want);
    expect(normalizeExamName("  SSC   CGL  ")).toBe(want);
  });

  it("drops generic words and year tokens", () => {
    expect(normalizeExamName("SSC CGL Recruitment 2026 Notification")).toBe("ssc cgl");
    expect(normalizeExamName("IBPS PO Exam 2025")).toBe("ibps po");
  });

  it("returns empty for blank / junk-only input", () => {
    expect(normalizeExamName("")).toBe("");
    expect(normalizeExamName("   ---  ")).toBe("");
    expect(normalizeExamName(null)).toBe("");
  });
});
