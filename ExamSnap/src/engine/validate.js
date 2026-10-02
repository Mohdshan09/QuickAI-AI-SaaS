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

  if (docSpec.width != null) {
    checks.push({
      rule: "width",
      label: "Width",
      ok: meta.width === docSpec.width,
      actual: `${meta.width}px`,
      expected: `${docSpec.width}px`,
    });
  }

  if (docSpec.height != null) {
    checks.push({
      rule: "height",
      label: "Height",
      ok: meta.height === docSpec.height,
      actual: `${meta.height}px`,
      expected: `${docSpec.height}px`,
    });
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
