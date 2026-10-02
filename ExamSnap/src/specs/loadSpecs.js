// Exam spec loading + normalisation. Raw specs are static JSON (spec §5); this module is
// the single seam between that data and the rest of the app, so a future NeonDB/admin
// source (Phase 4) can replace the glob import without touching the engine or UI.
//
// It resolves each document's dimensions to integer pixels (px or cm+dpi) and flattens the
// KB range, producing the "resolved docSpec" shape the engine (validate/process) expects.

import { resolveDimensionPx } from "../engine/units.js";

// Eagerly import every exam JSON at build time so getStaticPaths() can enumerate routes.
// A file may export a single exam object OR an array of exams (the catalog).
const modules = import.meta.glob("./exams/*.json", { eager: true });

// Generic placeholder documents applied to any catalog exam that has no verified specs yet.
// This is ONE clearly-labelled template (never invented per-exam), so the exam is usable
// immediately while the UI warns that the numbers must be confirmed against the official
// notification. Most Indian govt portals ask for a passport-style photo + a signature.
const GENERIC_DOCUMENTS = [
  {
    type: "photo",
    label: "Photograph",
    format: "jpeg",
    width: { px: 200 },
    height: { px: 230 },
    sizeKb: { min: 20, max: 50 },
    aspectRatio: "200:230",
    background: "white",
    notes: "Generic placeholder — confirm the exact px and KB in the official notification.",
  },
  {
    type: "signature",
    label: "Signature",
    format: "jpeg",
    width: { px: 140 },
    height: { px: 60 },
    sizeKb: { min: 10, max: 20 },
    aspectRatio: "140:60",
    background: "white",
    notes: "Generic placeholder — confirm the exact px and KB in the official notification.",
  },
];

function aspectRatioValue(ratio) {
  if (!ratio || typeof ratio !== "string" || !ratio.includes(":")) return undefined;
  const [w, h] = ratio.split(":").map(Number);
  return w > 0 && h > 0 ? w / h : undefined;
}

// Default labels per document type (Phase 2 adds thumb + declaration — same size fields as
// signature, spec §3).
const DEFAULT_LABELS = {
  signature: "Signature",
  thumb: "Left thumb impression",
  declaration: "Handwritten declaration",
  photo: "Photograph",
};

/** Normalise a Phase 2 name/date strip descriptor (spec §3), or undefined. */
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
  const width = resolveDimensionPx(doc.width, dpiFallback);
  const height = resolveDimensionPx(doc.height, dpiFallback);
  return {
    type: doc.type,
    label: doc.label || DEFAULT_LABELS[doc.type] || "Photograph",
    format: (doc.format || "jpeg").toLowerCase(),
    width,
    height,
    minKb: doc.sizeKb?.min ?? 0,
    maxKb: doc.sizeKb?.max ?? Infinity,
    background: doc.background || "white",
    nameDateStrip: Boolean(doc.nameDateStrip),
    strip: resolveStrip(doc.strip),
    notes: doc.notes || "",
    aspectRatio: doc.aspectRatio,
    aspectRatioValue: aspectRatioValue(doc.aspectRatio) ?? (width && height ? width / height : undefined),
    // Exam photos almost always require EXACT pixel dimensions, so dimension step-down in
    // the compressor is off unless a spec explicitly allows a size range.
    allowDimensionStepDown: Boolean(doc.allowDimensionStepDown),
  };
}

/** Normalise a whole exam. */
export function resolveExam(raw) {
  const dpiFallback = raw.dpi;
  // No documents on this exam yet → fall back to the generic template (never verified).
  const hasOwnDocs = Array.isArray(raw.documents) && raw.documents.length > 0;
  const rawDocs = hasOwnDocs ? raw.documents : GENERIC_DOCUMENTS;
  return {
    id: raw.id,
    slug: raw.slug || raw.id,
    name: raw.name,
    organization: raw.organization,
    conductedBy: raw.conductedBy || raw.organization,
    posts: raw.posts || "",
    year: raw.year,
    popular: Boolean(raw.popular),
    // An exam using generic defaults can never be "verified", regardless of its flag.
    verified: hasOwnDocs ? Boolean(raw.verified) : false,
    usesGenericDefaults: !hasOwnDocs,
    sourceUrl: raw.sourceUrl || "",
    lastVerified: raw.lastVerified || null,
    documents: rawDocs.map((d) => resolveDocument(d, dpiFallback)),
  };
}

let _cache;
/** All exams, resolved, sorted (popular first, then name). Dedupes by id. */
export function getExams() {
  if (!_cache) {
    const raw = Object.values(modules).flatMap((m) => {
      const data = m.default ?? m;
      return Array.isArray(data) ? data : [data];
    });
    const byId = new Map();
    for (const r of raw) {
      // A dedicated file (its own documents) wins over a catalog metadata entry.
      const resolved = resolveExam(r);
      const existing = byId.get(resolved.id);
      if (!existing || (resolved.usesGenericDefaults === false && existing.usesGenericDefaults)) {
        byId.set(resolved.id, resolved);
      }
    }
    _cache = [...byId.values()].sort(
      (a, b) => Number(b.popular) - Number(a.popular) || a.name.localeCompare(b.name),
    );
  }
  return _cache;
}

/** Exams grouped by conducting body, for a grouped dropdown. */
export function getExamsByGroup() {
  const groups = new Map();
  for (const e of getExams()) {
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

/** Build a one-document resolved exam from Custom-mode user input (spec §FR-4). */
export function buildCustomExam({ width, height, minKb, maxKb, type = "photo", label }) {
  return {
    id: "custom",
    slug: "custom",
    name: "Custom size",
    organization: "Custom",
    verified: false,
    sourceUrl: "",
    lastVerified: null,
    documents: [
      {
        type,
        label: label || "Custom document",
        format: "jpeg",
        width: Math.round(width),
        height: Math.round(height),
        minKb: Number(minKb) || 0,
        maxKb: Number(maxKb) || Infinity,
        background: "white",
        nameDateStrip: false,
        notes: "",
        aspectRatioValue: width && height ? width / height : undefined,
        allowDimensionStepDown: false,
      },
    ],
  };
}
