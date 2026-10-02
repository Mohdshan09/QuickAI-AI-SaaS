// Shared luminance helper for the analyze/* and signature steps. Pure: ImageData-like
// ({ data:Uint8ClampedArray|Array, width, height }) → Float64Array of 0–255 luma.

export function toLuma({ data, width, height }) {
  const out = new Float64Array(width * height);
  for (let i = 0, p = 0; p < out.length; i += 4, p++) {
    // Rec. 601 luma.
    out[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  return out;
}
