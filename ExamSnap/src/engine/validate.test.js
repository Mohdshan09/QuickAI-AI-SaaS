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
});
