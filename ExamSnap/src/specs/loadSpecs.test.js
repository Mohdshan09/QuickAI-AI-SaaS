import { describe, it, expect } from "vitest";
import { resolveDocument, buildCustomExam, getExams, getListedExams } from "./loadSpecs.js";

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

describe("resolveDocument — extended schema", () => {
  it("KB-only spec uses the labelled default target and is not dimension-specified", () => {
    const d = resolveDocument({
      type: "photo",
      submission: "both",
      width: "not-specified",
      height: "not-specified",
      defaultWidthPx: 200,
      defaultHeightPx: 230,
      sizeKb: { min: 20, max: 50 },
      background: "not-specified",
    });
    expect(d.width).toBe(200);
    expect(d.height).toBe(230);
    expect(d.dimensionSpecified).toBe(false);
    expect(d.background).toBe("not-specified");
    expect(d.submission).toBe("both");
  });

  it("a min-only dimension targets the minimum with an unbounded max", () => {
    const d = resolveDocument({ type: "signature", width: { minPx: 140 }, height: { minPx: 60 } });
    expect(d.width).toBe(140);
    expect(d.widthMin).toBe(140);
    expect(d.widthMax).toBe(Infinity);
    expect(d.dimensionSpecified).toBe(true);
  });

  it("a [min,max] range targets the lower bound and keeps the range", () => {
    const d = resolveDocument({ type: "photo", width: { minPx: 200, maxPx: 530 }, height: { minPx: 260, maxPx: 690 } });
    expect(d.width).toBe(200);
    expect(d.widthMax).toBe(530);
  });

  it("carries physical size (normalised to cm), minDpi, ink and content rules", () => {
    const d = resolveDocument({
      type: "signature",
      width: { minPx: 140 },
      height: { minPx: 60 },
      physicalSize: { w: 35, h: 20, unit: "mm" },
      minDpi: 100,
      ink: "Black ink",
      contentRules: ["Running handwriting"],
    });
    expect(d.physicalSize).toEqual({ w: 3.5, h: 2, unit: "mm" });
    expect(d.minDpi).toBe(100);
    expect(d.ink).toBe("Black ink");
    expect(d.contentRules).toEqual(["Running handwriting"]);
  });

  it("marks live-capture documents", () => {
    const d = resolveDocument({ type: "photo", submission: "live" });
    expect(d.isLive).toBe(true);
  });
});

describe("catalog", () => {
  it("only verified exams load, and RRB NTPC (listed:false) is hidden from the listing", () => {
    const all = getExams();
    const listed = getListedExams();
    expect(all.every((e) => e.verified)).toBe(true);
    expect(all.some((e) => e.id === "rrb-ntpc-cen-06-2025")).toBe(true);
    expect(listed.some((e) => e.id === "rrb-ntpc-cen-06-2025")).toBe(false);
    // 4 IBPS + SSC CHSL are listed.
    expect(listed).toHaveLength(5);
  });

  it("resolves IBPS documents from the shared spec group", () => {
    const ibps = getExams().find((e) => e.id === "ibps-po-mt-xvi");
    expect(ibps.group).toBe("ibps-2026");
    expect(ibps.documents.map((d) => d.type)).toEqual(["photo", "signature", "thumb", "declaration"]);
  });

  it("SSC CHSL is signature-only for processing (photo is live)", () => {
    const chsl = getExams().find((e) => e.id === "ssc-chsl-2026");
    expect(chsl.processableDocuments.map((d) => d.type)).toEqual(["signature"]);
    expect(chsl.liveDocuments.map((d) => d.type)).toEqual(["photo"]);
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
