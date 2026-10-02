// Stamp a DPI (pixel density) into a JPEG's JFIF APP0 header WITHOUT touching a single pixel
// (spec: physical-size specs with a minimum DPI, e.g. RRB NTPC's 100 DPI signature). Some
// portals read the embedded density to infer the physical size of a signature; canvas.toBlob
// writes units=0 (aspect-ratio only), so we patch (or insert) the APP0 density. Pure byte
// logic → node-testable, and mirrors the COM approach in encode/padJpeg.js.
//
// JFIF APP0 layout from its start offset `o`:
//   o+0 FF, o+1 E0, o+2..3 length, o+4..8 "JFIF\0", o+9 ver-major, o+10 ver-minor,
//   o+11 density units (0 none, 1 dpi, 2 dpcm), o+12..13 Xdensity, o+14..15 Ydensity,
//   o+16 Xthumb, o+17 Ythumb.

/**
 * @param {Uint8Array} bytes a valid JPEG (starts FF D8)
 * @param {number} dpi desired density in dots-per-inch
 * @returns {Uint8Array} the JPEG with its JFIF density set (original if not a JPEG / dpi<=0)
 */
export function setJpegDpiBytes(bytes, dpi) {
  if (!(dpi > 0)) return bytes;
  if (!(bytes[0] === 0xff && bytes[1] === 0xd8)) return bytes; // not a JPEG — don't touch
  const d = Math.min(0xffff, Math.round(dpi));

  // Walk the marker segments looking for an existing JFIF APP0.
  let off = 2;
  while (off + 4 <= bytes.length) {
    if (bytes[off] !== 0xff) break;
    const marker = bytes[off + 1];
    if (marker === 0xd9 || marker === 0xda) break; // EOI or start-of-scan → no header APP0
    if (marker >= 0xd0 && marker <= 0xd7) { off += 2; continue; } // standalone RSTn
    const len = (bytes[off + 2] << 8) | bytes[off + 3];
    if (len < 2) break;
    const isJfif =
      marker === 0xe0 &&
      bytes[off + 4] === 0x4a && bytes[off + 5] === 0x46 &&
      bytes[off + 6] === 0x49 && bytes[off + 7] === 0x46 && bytes[off + 8] === 0x00;
    if (isJfif) {
      const out = bytes.slice();
      out[off + 11] = 1; // units = dpi
      out[off + 12] = (d >> 8) & 0xff;
      out[off + 13] = d & 0xff;
      out[off + 14] = (d >> 8) & 0xff;
      out[off + 15] = d & 0xff;
      return out;
    }
    off += 2 + len;
  }

  // No JFIF APP0 present → insert a minimal one right after SOI.
  const app0 = new Uint8Array([
    0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, // FF E0, len 16, "JFIF\0"
    0x01, 0x01, 0x01, // version 1.1, units = dpi
    (d >> 8) & 0xff, d & 0xff, (d >> 8) & 0xff, d & 0xff, // Xdensity, Ydensity
    0x00, 0x00, // no thumbnail
  ]);
  const out = new Uint8Array(bytes.length + app0.length);
  out.set(bytes.subarray(0, 2), 0); // SOI
  out.set(app0, 2);
  out.set(bytes.subarray(2), 2 + app0.length);
  return out;
}

/** Blob-level convenience: set the JFIF density of a JPEG Blob to `dpi`. */
export async function setJpegDpiBlob(blob, dpi) {
  if (!(dpi > 0)) return blob;
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const stamped = setJpegDpiBytes(bytes, dpi);
  return new Blob([stamped], { type: "image/jpeg" });
}
