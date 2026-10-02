// Spec identity (spec §6): two submissions match when every document has identical width,
// height, min KB and max KB. We hash a canonical form of the document set so the same spec
// always produces the same `spec_hash`. MIRRORED server-side in api/_lib/specHash.js — the
// canonical form and hash MUST be identical on both sides.

/** Canonical, order-independent form of a document set (upload docs only). */
export function canonicalSpec(documents) {
  return (documents || [])
    .filter((d) => !d.isLive)
    .map((d) => ({
      type: String(d.type || ""),
      width: d.width != null ? Math.round(d.width) : null,
      height: d.height != null ? Math.round(d.height) : null,
      minKb: Number(d.minKb) || 0,
      maxKb: Number.isFinite(d.maxKb) ? Number(d.maxKb) : null,
    }))
    .sort((a, b) => a.type.localeCompare(b.type));
}

/** FNV-1a 32-bit hash → 8-char hex. Deterministic, dependency-free, worker/node safe. */
function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export function specHash(documents) {
  return fnv1a(JSON.stringify(canonicalSpec(documents)));
}
