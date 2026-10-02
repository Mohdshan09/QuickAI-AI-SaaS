// Exam spec loading + normalisation. Raw specs are static JSON; this module is the single
// seam between that data and the rest of the app, so a future NeonDB/admin source can replace
// the glob import without touching the engine or UI.
//
// It resolves each document's dimensions to the integer-pixel TARGET the engine (crop/resize/
// validate) expects, while also carrying the richer verified-dataset shape: dimension ranges,
// KB-only specs (with a labelled default target), physical size + minimum DPI, aspect-ratio
// ranges, submission mode, a "not specified" value, content-rule checklists and spec groups
// shared by several exams.

import { resolveDimensionPx, cmToPx } from "../engine/units.js";

// Eagerly import every exam JSON at build time so getStaticPaths() can enumerate routes.
// A file may export a single exam object OR an array of exams.
const examModules = import.meta.glob("./exams/*.json", { eager: true });
// Shared document groups (e.g. the four IBPS exams share one set of documents).
const groupModules = import.meta.glob("./groups/*.json", { eager: true });

const GROUPS = (() => {
  const map = new Map();
  for (const m of Object.values(groupModules)) {
    const g = m.default ?? m;
    if (g && g.id) map.set(g.id, g.documents || []);
  }
  return map;
})();

// Default labels per document type (same size fields as a signature for thumb/declaration).
const DEFAULT_LABELS = {
  signature: "Signature",
  thumb: "Left thumb impression",
  declaration: "Handwritten declaration",
  photo: "Photograph",
};

function aspectRatioFromString(ratio) {
  if (!ratio || typeof ratio !== "string" || !ratio.includes(":")) return undefined;
  const [w, h] = ratio.split(":").map(Number);
  return w > 0 && h > 0 ? w / h : undefined;
}

/** Convert a physicalSize descriptor ({ w, h, unit }) to centimetres, or undefined. */
function physicalToCm(physical) {
  if (!physical || !(physical.w > 0) || !(physical.h > 0)) return undefined;
  const factor = physical.unit === "mm" ? 0.1 : 1; // cm is the base; mm → cm
  return { w: physical.w * factor, h: physical.h * factor, unit: physical.unit || "cm" };
}

/**
 * Resolve one axis (width or height) of a document to a concrete integer TARGET plus the
 * allowed range and whether the official source actually specified it.
 *
 * Accepts: a number, { px }, { cm, dpi }, { mm, dpi }, { minPx, maxPx }, { minPx }, { maxPx },
 * the literal "not-specified", or null/undefined. `defaultPx` is the labelled fallback target
 * used when the dimension is unspecified.
 *
 * @returns {{ target:(number|undefined), min:(number|undefined), max:number, specified:boolean }}
 */
function resolveAxis(dim, defaultPx, dpiFallback) {
  const def = defaultPx != null ? Math.round(defaultPx) : undefined;

  if (dim == null || dim === "not-specified") {
    return { target: def, min: undefined, max: Infinity, specified: false };
  }
  if (typeof dim === "number") {
    const v = Math.round(dim);
    return { target: v, min: v, max: v, specified: true };
  }
  if (dim.px != null || dim.cm != null || dim.mm != null) {
    // Exact dimension (px, or a physical size at a dpi). units.js handles px/cm.
    const d = dim.mm != null ? { cm: dim.mm * 0.1, dpi: dim.dpi } : dim;
    const v = resolveDimensionPx(d, dpiFallback);
    return { target: v, min: v, max: v, specified: true };
  }
  if (dim.minPx != null || dim.maxPx != null) {
    const min = dim.minPx != null ? Math.round(dim.minPx) : undefined;
    const max = dim.maxPx != null ? Math.round(dim.maxPx) : Infinity;
    // Target the lower bound when present, else the upper bound, else the labelled default.
    const target = min ?? (Number.isFinite(max) ? max : def);
    return { target, min, max, specified: true };
  }
  throw new Error("Unrecognised dimension descriptor: " + JSON.stringify(dim));
}

/** Normalise an aspect-ratio descriptor (string "W:H" or { min, max }). */
function resolveAspect(aspect, target) {
  if (aspect && typeof aspect === "object" && (aspect.min != null || aspect.max != null)) {
    const min = aspect.min ?? aspect.max;
    const max = aspect.max ?? aspect.min;
    return { aspectRatioMin: min, aspectRatioMax: max, aspectRatioValue: (min + max) / 2 };
  }
  const v = aspectRatioFromString(aspect) ?? (target.width && target.height ? target.width / target.height : undefined);
  return { aspectRatioMin: undefined, aspectRatioMax: undefined, aspectRatioValue: v };
}

/** Normalise a name/date strip descriptor, or undefined. */
function resolveStrip(strip) {
  if (!strip || !strip.heightPx) return undefined;
  return {
    heightPx: Math.round(strip.heightPx),
    lines: Array.isArray(strip.lines) && strip.lines.length ? strip.lines : ["name", "date"],
    dateFormat: strip.dateFormat || "DD-MM-YYYY",
    case: strip.case || "none",
  };
}

/** Normalise one raw document descriptor into the engine's resolved docSpec. */
export function resolveDocument(doc, dpiFallback) {
  const submission = doc.submission || "upload";
  const isLive = submission === "live";

  const w = resolveAxis(doc.width, doc.defaultWidthPx, dpiFallback);
  const h = resolveAxis(doc.height, doc.defaultHeightPx, dpiFallback);
  const dimensionSpecified = w.specified && h.specified;

  const sizeKb = doc.sizeKb === "not-specified" || doc.sizeKb == null ? {} : doc.sizeKb;
  const physicalCm = physicalToCm(doc.physicalSize);
  const aspect = resolveAspect(doc.aspectRatio, { width: w.target, height: h.target });

  return {
    type: doc.type,
    label: doc.label || DEFAULT_LABELS[doc.type] || "Photograph",
    format: (doc.format || "jpeg").toLowerCase(),
    submission,
    isLive,
    // Concrete integer target the crop/resize/compress stages consume.
    width: w.target,
    height: h.target,
    widthMin: w.min,
    widthMax: w.max,
    heightMin: h.min,
    heightMax: h.max,
    dimensionSpecified,
    minKb: sizeKb.min ?? 0,
    maxKb: sizeKb.max ?? Infinity,
    sizeSpecified: sizeKb.min != null || sizeKb.max != null,
    background: doc.background || "white",
    physicalSize: physicalCm,
    minDpi: doc.minDpi != null ? Math.round(doc.minDpi) : undefined,
    ink: doc.ink || "",
    contentRules: Array.isArray(doc.contentRules) ? doc.contentRules : [],
    nameDateStrip: Boolean(doc.nameDateStrip),
    strip: resolveStrip(doc.strip),
    notes: doc.notes || "",
    aspectRatio: typeof doc.aspectRatio === "string" ? doc.aspectRatio : undefined,
    aspectRatioMin: aspect.aspectRatioMin,
    aspectRatioMax: aspect.aspectRatioMax,
    aspectRatioValue: aspect.aspectRatioValue,
    // Exam photos usually require EXACT pixel dimensions, so dimension step-down is off unless
    // a spec explicitly allows a size range.
    allowDimensionStepDown: Boolean(doc.allowDimensionStepDown),
  };
}

/** Normalise a whole exam. */
export function resolveExam(raw) {
  const dpiFallback = raw.dpi;
  // Documents come from an inline `documents` array, or from a shared spec group.
  const rawDocs = Array.isArray(raw.documents) && raw.documents.length > 0
    ? raw.documents
    : (raw.group && GROUPS.get(raw.group)) || [];
  const documents = rawDocs.map((d) => resolveDocument(d, dpiFallback));
  return {
    id: raw.id,
    slug: raw.slug || raw.id,
    name: raw.name,
    organization: raw.organization,
    conductedBy: raw.conductedBy || raw.organization,
    posts: raw.posts || "",
    year: raw.year,
    cycle: raw.cycle || (raw.year ? String(raw.year) : ""),
    popular: Boolean(raw.popular),
    verified: Boolean(raw.verified),
    listed: raw.listed !== false, // default true; false hides from list/prerender/sitemap
    group: raw.group || null,
    sourceUrl: raw.sourceUrl || "",
    sourcePage: raw.sourcePage || "",
    lastVerified: raw.lastVerified || null,
    documents,
    // Documents a user actually uploads + processes (live-capture docs are informational only).
    processableDocuments: documents.filter((d) => !d.isLive),
    liveDocuments: documents.filter((d) => d.isLive),
  };
}

let _cache;
/** All VERIFIED exams, resolved, sorted (popular first, then name). Dedupes by id. */
export function getExams() {
  if (!_cache) {
    const raw = Object.values(examModules).flatMap((m) => {
      const data = m.default ?? m;
      return Array.isArray(data) ? data : [data];
    });
    const byId = new Map();
    for (const r of raw) {
      const resolved = resolveExam(r);
      if (!resolved.verified) continue; // placeholders/unverified never ship
      if (!byId.has(resolved.id)) byId.set(resolved.id, resolved);
    }
    _cache = [...byId.values()].sort(
      (a, b) => Number(b.popular) - Number(a.popular) || a.name.localeCompare(b.name),
    );
  }
  return _cache;
}

/** Verified exams that are also listed — used for the home list, prerendering and the sitemap. */
export function getListedExams() {
  return getExams().filter((e) => e.listed);
}

/** Listed exams grouped by conducting body, for a grouped dropdown. */
export function getExamsByGroup() {
  const groups = new Map();
  for (const e of getListedExams()) {
    const key = e.conductedBy || e.organization || "Other";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(e);
  }
  return [...groups.entries()]
    .map(([group, exams]) => ({ group, exams }))
    .sort((a, b) => a.group.localeCompare(b.group));
}

export function getExamBySlug(slug) {
  return getExams().find((e) => e.slug === slug);
}

/** Build a one-document resolved exam from Custom-mode user input. */
export function buildCustomExam({ width, height, minKb, maxKb, type = "photo", label, name }) {
  return resolveExam({
    id: "custom",
    slug: "custom",
    name: name || "Custom size",
    organization: "Custom",
    verified: false, // user-entered specs are never "verified"
    listed: false,
    sourceUrl: "",
    lastVerified: null,
    documents: [
      {
        type,
        label: label || "Custom document",
        format: "jpeg",
        submission: "upload",
        width: { px: Math.round(width) },
        height: { px: Math.round(height) },
        sizeKb: { min: Number(minKb) || 0, max: Number(maxKb) || Infinity },
        background: "white",
      },
    ],
  });
}

export { cmToPx };
