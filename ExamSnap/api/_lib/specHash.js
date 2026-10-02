// Server copy of the spec hash. MUST stay identical to src/lib/specHash.js so the hash a client
// records at download matches the one the server derives from a submitted document set (spec §6).

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
