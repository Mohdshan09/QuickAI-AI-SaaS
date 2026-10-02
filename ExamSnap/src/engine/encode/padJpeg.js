// Pad a JPEG up to a minimum byte size WITHOUT touching a single pixel (spec §6.3). Some
// portals reject files that are too small; a JPEG COM (comment) segment carries arbitrary
// filler bytes that decoders ignore, so the image decodes identically. Pure byte logic →
// node-testable.
//
// A COM segment is: FF FE <len hi> <len lo> <payload…>, where len counts the two length
// bytes + payload (so max payload is 65533). We insert segments right after the SOI (FF D8)
// so they sit before the rest of the stream and are skipped on decode. For large pads we add
// several segments.

const SOI = 0xffd8;
const MAX_PAYLOAD = 65533; // 0xFFFF − 2 length bytes

/**
 * @param {Uint8Array} bytes a valid JPEG (starts FF D8)
 * @param {number} targetBytes desired minimum total size
 * @returns {Uint8Array} padded JPEG (or the original if already ≥ target / not a JPEG)
 */
export function padJpegBytes(bytes, targetBytes) {
  if (bytes.length >= targetBytes) return bytes;
  if (!(bytes[0] === 0xff && bytes[1] === 0xd8)) return bytes; // not a JPEG — don't touch

  let needed = targetBytes - bytes.length;

  // Build the COM segments. Each segment's overhead is 4 bytes (marker + length).
  const segments = [];
  while (needed > 0) {
    // Choose a payload size; ensure we actually close the remaining gap including overhead.
    let payload = Math.min(MAX_PAYLOAD, Math.max(1, needed - 4));
    // If a tiny gap remains that's smaller than the 4-byte overhead, still emit a minimal
    // segment — it overshoots by a few bytes, which is fine (we target min + margin anyway).
    const segLen = payload + 2; // length field counts itself (2) + payload
    const seg = new Uint8Array(payload + 4);
    seg[0] = 0xff;
    seg[1] = 0xfe; // COM
    seg[2] = (segLen >> 8) & 0xff;
    seg[3] = segLen & 0xff;
    // payload bytes default to 0x00 (already zero-filled)
    segments.push(seg);
    needed -= seg.length;
  }

  const totalSeg = segments.reduce((n, s) => n + s.length, 0);
  const out = new Uint8Array(bytes.length + totalSeg);
  out.set(bytes.subarray(0, 2), 0); // SOI
  let offset = 2;
  for (const seg of segments) {
    out.set(seg, offset);
    offset += seg.length;
  }
  out.set(bytes.subarray(2), offset); // rest of the original stream, unchanged
  return out;
}

/** Blob-level convenience: pad a JPEG Blob up to targetBytes. */
export async function padJpegBlob(blob, targetBytes) {
  if (blob.size >= targetBytes) return blob;
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const padded = padJpegBytes(bytes, targetBytes);
  return new Blob([padded], { type: "image/jpeg" });
}

export { SOI, MAX_PAYLOAD };
