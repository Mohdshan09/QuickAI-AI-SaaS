// Canvas helpers that work both on the main thread and inside a Web Worker.
// In a worker there is no `document`, so we use OffscreenCanvas; on the main thread we
// prefer OffscreenCanvas when available and fall back to a DOM <canvas> (e.g. older Safari).

export function hasOffscreenCanvas() {
  return typeof OffscreenCanvas !== "undefined";
}

/** Create a drawing surface of the given pixel size. */
export function createCanvas(width, height) {
  if (hasOffscreenCanvas()) {
    return new OffscreenCanvas(width, height);
  }
  if (typeof document !== "undefined") {
    const c = document.createElement("canvas");
    c.width = width;
    c.height = height;
    return c;
  }
  throw new Error("No canvas implementation available in this environment.");
}

/** Read a canvas's pixels as ImageData. */
export function getImageData(canvas) {
  const ctx = canvas.getContext("2d");
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

/** Build a fresh canvas from ImageData. */
export function canvasFromImageData(imageData) {
  const c = createCanvas(imageData.width, imageData.height);
  c.getContext("2d").putImageData(imageData, 0, 0);
  return c;
}

/** Encode a canvas to a JPEG Blob at a given quality (0–1). */
export async function encodeJpeg(canvas, quality) {
  // OffscreenCanvas uses convertToBlob; DOM canvas uses toBlob.
  if (typeof canvas.convertToBlob === "function") {
    return canvas.convertToBlob({ type: "image/jpeg", quality });
  }
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Canvas toBlob returned null"))),
      "image/jpeg",
      quality,
    );
  });
}
