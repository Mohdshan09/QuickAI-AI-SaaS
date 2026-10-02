import { describe, it, expect } from "vitest";
import { resolveDocument, buildCustomExam } from "./loadSpecs.js";

describe("resolveDocument", () => {
  it("resolves px and cm+dpi dimensions and the aspect ratio", () => {
    const d = resolveDocument({
      type: "photo",
      label: "Photograph",
      format: "JPEG",
      width: { cm: 3.5, dpi: 200 },
      height: { px: 450 },
      sizeKb: { min: 20, max: 50 },
      aspectRatio: "350:450",
      background: "white",
    });
    expect(d.width).toBe(276); // round(3.5/2.54*200)
    expect(d.height).toBe(450);
    expect(d.minKb).toBe(20);
    expect(d.maxKb).toBe(50);
    expect(d.format).toBe("jpeg");
    expect(d.aspectRatioValue).toBeCloseTo(350 / 450, 5);
    expect(d.allowDimensionStepDown).toBe(false);
  });

  it("defaults missing size to an unbounded range", () => {
    const d = resolveDocument({ type: "signature", width: { px: 140 }, height: { px: 60 } });
    expect(d.minKb).toBe(0);
    expect(d.maxKb).toBe(Infinity);
    expect(d.label).toBe("Signature");
  });

  it("labels thumb/declaration types (Phase 2)", () => {
    expect(resolveDocument({ type: "thumb", width: { px: 1 }, height: { px: 1 } }).label).toBe(
      "Left thumb impression",
    );
    expect(resolveDocument({ type: "declaration", width: { px: 1 }, height: { px: 1 } }).label).toBe(
      "Handwritten declaration",
    );
  });

  it("resolves a name/date strip with defaults (Phase 2)", () => {
    const d = resolveDocument({
      type: "photo",
      width: { px: 200 },
      height: { px: 300 },
      strip: { heightPx: 40 },
    });
    expect(d.strip).toEqual({ heightPx: 40, lines: ["name", "date"], dateFormat: "DD-MM-YYYY", case: "none" });
    // No strip → undefined.
    expect(resolveDocument({ type: "photo", width: { px: 1 }, height: { px: 1 } }).strip).toBeUndefined();
  });
});

describe("buildCustomExam", () => {
  it("builds a one-document resolved exam from user input", () => {
    const exam = buildCustomExam({ width: 200, height: 230, minKb: 20, maxKb: 50 });
    expect(exam.id).toBe("custom");
    expect(exam.verified).toBe(false);
    expect(exam.documents).toHaveLength(1);
    const d = exam.documents[0];
    expect(d.width).toBe(200);
    expect(d.height).toBe(230);
    expect(d.maxKb).toBe(50);
    expect(d.aspectRatioValue).toBeCloseTo(200 / 230, 5);
  });
});
