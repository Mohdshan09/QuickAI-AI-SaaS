// Pure unit math for exam specs. No DOM, no React — safe to unit-test in node.
//
// Exam notifications give photo/signature sizes either directly in pixels, or in
// centimetres at a target DPI. Spec §5: px = round(cm / 2.54 * dpi). File sizes are in
// KB; we treat 1 KB = 1024 bytes by default (spec §FR-14) and keep a safety margin because
// some portals count KB as 1000 bytes.

export const BYTES_PER_KB = 1024;

/** Convert centimetres at a given DPI to whole pixels. */
export function cmToPx(cm, dpi) {
  if (!(cm > 0) || !(dpi > 0)) throw new Error("cmToPx requires positive cm and dpi");
  return Math.round((cm / 2.54) * dpi);
}

/** Bytes → KB (1024-based), not rounded, for comparisons. */
export function bytesToKb(bytes) {
  return bytes / BYTES_PER_KB;
}

/** KB → bytes (1024-based). */
export function kbToBytes(kb) {
  return kb * BYTES_PER_KB;
}

/**
 * Resolve a dimension descriptor from a spec document to whole pixels.
 * Accepts either { px } or { cm, dpi }. Returns an integer pixel count.
 */
export function resolveDimensionPx(dim, dpiFallback) {
  if (dim == null) return undefined;
  if (typeof dim === "number") return Math.round(dim);
  if (dim.px != null) return Math.round(dim.px);
  if (dim.cm != null) {
    const dpi = dim.dpi ?? dpiFallback;
    if (!dpi) throw new Error("cm dimension needs a dpi (on the dimension or a fallback)");
    return cmToPx(dim.cm, dpi);
  }
  throw new Error("Unrecognised dimension descriptor: " + JSON.stringify(dim));
}

/**
 * Compute the target KB window to aim *inside* of (spec §FR-14 step 4): a safety margin
 * of `marginKb` is subtracted from max and added to min so portal KB-rounding differences
 * don't push a valid file just over/under. The hard pass/fail bounds stay min/max; this is
 * only the target the compressor tries to land within.
 */
export function targetKbWindow({ minKb = 0, maxKb = Infinity }, marginKb = 2) {
  const hasMin = minKb > 0;
  const hasMax = Number.isFinite(maxKb);
  // Don't let the margin invert a tight range.
  const safeMargin = hasMin && hasMax ? Math.min(marginKb, Math.max(0, (maxKb - minKb) / 2 - 0.5)) : marginKb;
  return {
    targetMinKb: hasMin ? minKb + safeMargin : 0,
    targetMaxKb: hasMax ? maxKb - safeMargin : Infinity,
    hardMinKb: minKb,
    hardMaxKb: maxKb,
  };
}
