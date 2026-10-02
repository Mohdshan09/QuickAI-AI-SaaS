import { describe, it, expect } from "vitest";
import { formatDate, applyCase, photoHeight } from "./strip.js";

describe("strip helpers", () => {
  it("formats a date per the token string", () => {
    const d = new Date(2026, 9, 2); // 2 Oct 2026 (month is 0-based)
    expect(formatDate(d, "DD-MM-YYYY")).toBe("02-10-2026");
    expect(formatDate(d, "YYYY/MM/DD")).toBe("2026/10/02");
  });

  it("applies case", () => {
    expect(applyCase("Ravi Kumar", "upper")).toBe("RAVI KUMAR");
    expect(applyCase("Ravi", "lower")).toBe("ravi");
    expect(applyCase("Ravi", "none")).toBe("Ravi");
  });

  it("reserves strip height from the total so output stays exact", () => {
    expect(photoHeight(450, 60)).toBe(390);
    expect(photoHeight(100, 200)).toBe(1); // never negative
  });
});
