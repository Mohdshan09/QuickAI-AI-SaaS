// file -> decoded bitmap, with:
//  - HEIC/HEIF conversion (lazy-loaded heic2any; iPhone photos) — spec §FR-6
//  - EXIF orientation auto-rotate via createImageBitmap imageOrientation — spec §FR-7
//  - downscale of very large inputs (>MAX_DIM) so low-end phones stay responsive — §FR-8
//
// Returns an ImageBitmap plus its (post-rotation, post-downscale) dimensions. Keeping this
// separate from crop/resize means the rest of the engine never cares about file formats.

const MAX_DIM = 4000;
const HEIC_TYPES = ["image/heic", "image/heif"];

function isHeic(file) {
  const type = (file.type || "").toLowerCase();
  if (HEIC_TYPES.includes(type)) return true;
  // Some browsers report an empty type for HEIC; fall back to the extension.
  return /\.hei[cf]$/i.test(file.name || "");
}

async function toDecodableBlob(file) {
  if (!isHeic(file)) return file;
  // heic2any is heavy (~1 MB) — only pulled in when an actual HEIC file shows up.
  const { default: heic2any } = await import("heic2any");
  const converted = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.92 });
  return Array.isArray(converted) ? converted[0] : converted;
}

/**
 * @param {File|Blob} file
 * @returns {Promise<{ bitmap: ImageBitmap, width:number, height:number, sourceType:string }>}
 */
export async function loadImage(file) {
  const blob = await toDecodableBlob(file);

  // First decode to read intrinsic size (with EXIF orientation applied).
  let bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" });

  // Downscale oversized inputs to keep memory/time bounded on mobile.
  const longEdge = Math.max(bitmap.width, bitmap.height);
  if (longEdge > MAX_DIM) {
    const scale = MAX_DIM / longEdge;
    const resizeWidth = Math.round(bitmap.width * scale);
    const resizeHeight = Math.round(bitmap.height * scale);
    const downscaled = await createImageBitmap(blob, {
      imageOrientation: "from-image",
      resizeWidth,
      resizeHeight,
      resizeQuality: "high",
    });
    bitmap.close?.();
    bitmap = downscaled;
  }

  return {
    bitmap,
    width: bitmap.width,
    height: bitmap.height,
    sourceType: file.type || (isHeic(file) ? "image/heic" : "unknown"),
  };
}
