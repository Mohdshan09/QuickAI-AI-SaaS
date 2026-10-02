// Detect the REAL image format from the file's leading bytes, not its extension (P2-FR-1).
// A PNG renamed to .jpg must be reported as png. Pure byte logic → node-testable.

/**
 * @param {Uint8Array} b first ~16 bytes of a file
 * @returns {"jpeg"|"png"|"webp"|"gif"|"heic"|"bmp"|"unknown"}
 */
export function sniffFormat(b) {
  if (!b || b.length < 4) return "unknown";

  // JPEG: FF D8 FF
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "png";

  // GIF: "GIF87a" / "GIF89a"
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return "gif";

  // BMP: "BM"
  if (b[0] === 0x42 && b[1] === 0x4d) return "bmp";

  const ascii = (i, s) => {
    for (let k = 0; k < s.length; k++) if (b[i + k] !== s.charCodeAt(k)) return false;
    return true;
  };

  // WebP: "RIFF"...."WEBP"
  if (b.length >= 12 && ascii(0, "RIFF") && ascii(8, "WEBP")) return "webp";

  // HEIC/HEIF: ...."ftyp" + a heic/heif-family brand
  if (b.length >= 12 && ascii(4, "ftyp")) {
    const brand = String.fromCharCode(b[8], b[9], b[10], b[11]).toLowerCase();
    if (["heic", "heix", "heif", "hevc", "mif1", "msf1"].includes(brand)) return "heic";
  }

  return "unknown";
}

/** Read the first bytes of a File/Blob and sniff its real format. */
export async function formatOfFile(file) {
  const slice = file.slice(0, 16);
  const buf = await slice.arrayBuffer();
  return sniffFormat(new Uint8Array(buf));
}
