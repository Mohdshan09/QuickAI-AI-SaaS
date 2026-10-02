// Validate an output (or an uploaded file, in P2 checker mode) against a *resolved* exam
// document spec. Pure function — no DOM. Returns a per-rule checklist so the UI can show
// ✅ / ❌ for each rule (spec §FR-16/17) and gate the download on `pass` (§FR-18).
//
// A "resolved" docSpec has already converted any cm/dpi dimensions to integer pixels via
// specs/loadSpecs.js, so this module never deals with units.

import { bytesToKb } from "./units.js";

const KB = (n) => Math.round(n * 10) / 10;

/**
 * @param {{ sizeBytes:number, width:number, height:number, format:string }} meta
 * @param {object} docSpec resolved spec: { format, width, height, minKb, maxKb }
 * @returns {{ pass:boolean, checks: Array<{rule,label,ok,actual,expected}> }}
 */
export function validate(meta, docSpec) {
  const checks = [];

  if (docSpec.format) {
    const want = String(docSpec.format).toLowerCase().replace("jpg", "jpeg");
    const got = String(meta.format || "").toLowerCase().replace("jpg", "jpeg");
    checks.push({
      rule: "format",
      label: "File format",
      ok: got === want,
      actual: meta.format || "unknown",
      expected: docSpec.format,
    });
  }

  // Dimension checks only run when the official source actually specified a size. KB-only specs
  // (dimensionSpecified === false) output at a labelled default, so pixels are informational and
  // never fail. A specified dimension may be an exact value, a [min,max] range or a min-only
  // bound; min === max collapses to exact equality.
  if (docSpec.dimensionSpecified !== false) {
    const dimCheck = (rule, label, actual, min, max) => {
      if (min == null && (max == null || !Number.isFinite(max))) return;
      const okMin = min == null || actual >= min;
      const okMax = max == null || !Number.isFinite(max) || actual <= max;
      const expected =
        min === max ? `${min}px`
          : !Number.isFinite(max) ? `≥ ${min}px`
            : min == null ? `≤ ${max}px`
              : `${min}–${max}px`;
      checks.push({ rule, label, ok: okMin && okMax, actual: `${actual}px`, expected });
    };
    // Fall back to an exact width/height for flat specs that predate widthMin/widthMax.
    const wMin = docSpec.widthMin ?? docSpec.width;
    const wMax = docSpec.widthMax ?? docSpec.width;
    const hMin = docSpec.heightMin ?? docSpec.height;
    const hMax = docSpec.heightMax ?? docSpec.height;
    dimCheck("width", "Width", meta.width, wMin, wMax);
    dimCheck("height", "Height", meta.height, hMin, hMax);
  }

  const hasMin = docSpec.minKb > 0;
  const hasMax = docSpec.maxKb != null && Number.isFinite(docSpec.maxKb);
  if (hasMin || hasMax) {
    const sizeKb = bytesToKb(meta.sizeBytes);
    const okMin = !hasMin || sizeKb >= docSpec.minKb;
    const okMax = !hasMax || sizeKb <= docSpec.maxKb;
    const range = hasMin && hasMax
      ? `${docSpec.minKb}–${docSpec.maxKb} KB`
      : hasMax
        ? `≤ ${docSpec.maxKb} KB`
        : `≥ ${docSpec.minKb} KB`;
    checks.push({
      rule: "size",
      label: "File size",
      ok: okMin && okMax,
      actual: `${KB(sizeKb)} KB`,
      expected: range,
    });
  }

  return { pass: checks.every((c) => c.ok), checks };
}
