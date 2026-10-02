import { describe, it, expect } from "vitest";
import { validateSpecDocuments, validateNotificationUrl, cap } from "./validate.js";

describe("validateSpecDocuments", () => {
  it("accepts a valid KB-only document set", () => {
    expect(validateSpecDocuments([{ type: "photo", minKb: 20, maxKb: 50 }])).toBeNull();
  });

  it("accepts valid pixel dimensions", () => {
    expect(validateSpecDocuments([{ type: "signature", width: 300, height: 80, minKb: 10, maxKb: 20 }])).toBeNull();
  });

  it("rejects an empty set, out-of-range dims, out-of-range KB and min>max", () => {
    expect(validateSpecDocuments([])).toMatch(/required/);
    expect(validateSpecDocuments([{ type: "photo", width: 10 }])).toMatch(/width/);
    expect(validateSpecDocuments([{ type: "photo", width: 40000 }])).toMatch(/width/);
    expect(validateSpecDocuments([{ type: "photo", maxKb: 99999 }])).toMatch(/maxKb/);
    expect(validateSpecDocuments([{ type: "photo", minKb: 60, maxKb: 50 }])).toMatch(/greater/);
  });
});

describe("validateNotificationUrl", () => {
  it("allows empty/undefined and https urls", () => {
    expect(validateNotificationUrl(null)).toBeNull();
    expect(validateNotificationUrl("")).toBeNull();
    expect(validateNotificationUrl("https://ssc.gov.in/x.pdf")).toBeNull();
  });

  it("rejects non-https and over-long urls", () => {
    expect(validateNotificationUrl("http://ssc.gov.in")).toMatch(/https/);
    expect(validateNotificationUrl("https://x.com/" + "a".repeat(600))).toMatch(/too long/);
  });
});

describe("cap", () => {
  it("truncates to length and passes null through", () => {
    expect(cap("abcdef", 3)).toBe("abc");
    expect(cap(null, 3)).toBeNull();
  });
});
