import { describe, expect, it } from "vitest";
import { filenameFor } from "./download.js";

describe("filenameFor", () => {
  it("appends the download date as dd-mm-yy", () => {
    // 30 October 2026
    const date = new Date(2026, 9, 30, 15, 4, 2);
    expect(filenameFor("ssc-chsl", "photo", "jpg", date)).toBe("ssc-chsl_photo_30-10-26.jpg");
  });

  it("zero-pads single-digit days and months", () => {
    const date = new Date(2026, 0, 5);
    expect(filenameFor("ibps-po", "signature", "pdf", date)).toBe("ibps-po_signature_05-01-26.pdf");
  });

  it("strips the SEO slug suffix and sanitises the exam name", () => {
    const date = new Date(2026, 9, 30);
    expect(filenameFor("ssc-chsl-photo-signature-size", "photo", "jpg", date)).toBe("ssc-chsl_photo_30-10-26.jpg");
    expect(filenameFor("IBPS RRB XV Officer", "kit", "zip", date)).toBe("ibps-rrb-xv-officer_kit_30-10-26.zip");
  });

  it("defaults sensibly for unknown inputs", () => {
    const date = new Date(2026, 9, 30);
    expect(filenameFor("", "", "jpg", date)).toBe("exam_file_30-10-26.jpg");
  });
});
