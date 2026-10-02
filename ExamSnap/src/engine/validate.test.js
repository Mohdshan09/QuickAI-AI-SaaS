import { describe, it, expect } from "vitest";
import { validate } from "./validate.js";

const spec = { format: "jpeg", width: 350, height: 450, minKb: 20, maxKb: 50 };
const KB = 1024;

describe("validate", () => {
  it("passes when every rule matches", () => {
    const r = validate(
      { sizeBytes: 40 * KB, width: 350, height: 450, format: "jpeg" },
      spec,
    );
    expect(r.pass).toBe(true);
    expect(r.checks).toHaveLength(4);
  });

  it("fails on wrong width", () => {
    const r = validate(
      { sizeBytes: 40 * KB, width: 300, height: 450, format: "jpeg" },
      spec,
    );
    expect(r.pass).toBe(false);
    expect(r.checks.find((c) => c.rule === "width").ok).toBe(false);
  });

  it("fails when the size is outside the range", () => {
    const over = validate(
      { sizeBytes: 60 * KB, width: 350, height: 450, format: "jpeg" },
      spec,
    );
    expect(over.checks.find((c) => c.rule === "size").ok).toBe(false);

    const under = validate(
      { sizeBytes: 5 * KB, width: 350, height: 450, format: "jpeg" },
      spec,
    );
    expect(under.checks.find((c) => c.rule === "size").ok).toBe(false);
  });

  it("treats jpg and jpeg as the same format", () => {
    const r = validate(
      { sizeBytes: 40 * KB, width: 350, height: 450, format: "jpg" },
      spec,
    );
    expect(r.checks.find((c) => c.rule === "format").ok).toBe(true);
  });

  it("skips dimension checks for KB-only specs (dimensionSpecified false)", () => {
    const kbOnly = { format: "jpeg", dimensionSpecified: false, minKb: 20, maxKb: 50 };
    const r = validate({ sizeBytes: 40 * KB, width: 1234, height: 9999, format: "jpeg" }, kbOnly);
    expect(r.checks.find((c) => c.rule === "width")).toBeUndefined();
    expect(r.checks.find((c) => c.rule === "height")).toBeUndefined();
    expect(r.pass).toBe(true);
  });

  it("accepts a dimension inside a [min,max] range and rejects outside it", () => {
    const ranged = {
      format: "jpeg",
      dimensionSpecified: true,
      widthMin: 200, widthMax: 530, heightMin: 260, heightMax: 690,
      minKb: 5, maxKb: 600,
    };
    const inRange = validate({ sizeBytes: 100 * KB, width: 400, height: 500, format: "jpeg" }, ranged);
    expect(inRange.pass).toBe(true);
    const tooWide = validate({ sizeBytes: 100 * KB, width: 600, height: 500, format: "jpeg" }, ranged);
    expect(tooWide.checks.find((c) => c.rule === "width").ok).toBe(false);
  });

  it("treats a min-only bound as ≥ min", () => {
    const minOnly = { format: "jpeg", dimensionSpecified: true, widthMin: 140, widthMax: Infinity, heightMin: 60, heightMax: Infinity, minKb: 30, maxKb: 49 };
    const ok = validate({ sizeBytes: 40 * KB, width: 160, height: 70, format: "jpeg" }, minOnly);
    expect(ok.pass).toBe(true);
    const tooSmall = validate({ sizeBytes: 40 * KB, width: 120, height: 70, format: "jpeg" }, minOnly);
    expect(tooSmall.checks.find((c) => c.rule === "width").ok).toBe(false);
  });
});
