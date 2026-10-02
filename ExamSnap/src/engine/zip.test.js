import { describe, it, expect } from "vitest";
import { buildChecklistText } from "./zip.js";

describe("buildChecklistText", () => {
  it("lists each file with dimensions and size", () => {
    const items = [
      { filename: "ssc-cgl_photo.jpg", meta: { width: 350, height: 450, sizeKb: 42.3 } },
      { filename: "ssc-cgl_signature.jpg", meta: { width: 350, height: 160, sizeKb: 15 } },
    ];
    const txt = buildChecklistText(items, "SSC CGL");
    expect(txt).toContain("ExamSnap kit: SSC CGL");
    expect(txt).toContain("ssc-cgl_photo.jpg — 350x450px, 42.3 KB");
    expect(txt).toContain("ssc-cgl_signature.jpg — 350x160px, 15 KB");
  });
});
