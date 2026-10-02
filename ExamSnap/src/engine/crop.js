// Apply the crop rectangle + rotation chosen in the UI (react-easy-crop) to a decoded
// bitmap and return a canvas of exactly the cropped area. The follow-up resizeToSpec step
// scales this to the exam's required pixel dimensions.
//
// This mirrors react-easy-crop's reference getCroppedImg: draw the rotated image onto a
// bounding-box canvas, then lift out the crop rectangle. `cropPixels` ({x,y,width,height})
// are in the source image's natural pixels, as react-easy-crop reports them.

import { createCanvas } from "./canvasEnv.js";

const toRad = (deg) => (deg * Math.PI) / 180;

function rotatedBoundingBox(width, height, rotationDeg) {
  const rad = toRad(rotationDeg);
  return {
    width: Math.abs(Math.cos(rad) * width) + Math.abs(Math.sin(rad) * height),
    height: Math.abs(Math.sin(rad) * width) + Math.abs(Math.cos(rad) * height),
  };
}

/**
 * @param {{ bitmap, cropPixels:{x,y,width,height}, rotationDeg?:number }} params
 * @returns {canvas} a canvas sized cropPixels.width × cropPixels.height
 */
export function cropToCanvas({ bitmap, cropPixels, rotationDeg = 0 }) {
  const bbox = rotatedBoundingBox(bitmap.width, bitmap.height, rotationDeg);

  const stage = createCanvas(Math.round(bbox.width), Math.round(bbox.height));
  const sctx = stage.getContext("2d");
  sctx.translate(bbox.width / 2, bbox.height / 2);
  sctx.rotate(toRad(rotationDeg));
  sctx.translate(-bitmap.width / 2, -bitmap.height / 2);
  sctx.drawImage(bitmap, 0, 0);

  const { x, y, width, height } = cropPixels;
  const data = sctx.getImageData(Math.round(x), Math.round(y), Math.round(width), Math.round(height));

  const out = createCanvas(Math.round(width), Math.round(height));
  out.getContext("2d").putImageData(data, 0, 0);
  return out;
}
