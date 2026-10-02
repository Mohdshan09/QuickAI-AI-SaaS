// Runs the image pipeline off the main thread so the UI stays responsive on low-end
// phones (spec §FR-15). The engine modules are framework- and DOM-free, so they import
// cleanly here and use OffscreenCanvas via canvasEnv.js.
//
// Message in:  { id, file, docSpec, cropPixels, rotationDeg, options? }
// Message out: { id, ok:true, blob, meta, validation } | { id, ok:false, error }
//
// Phase 2 features are driven by the serialisable `options` object (cleanup params,
// background request, strip name/date) — all structured-cloneable, so no functions need to
// cross the worker boundary.

import { process } from "../engine/process.js";

self.onmessage = async (e) => {
  const { id, file, docSpec, cropPixels, rotationDeg, options } = e.data;
  try {
    const { blob, meta, validation } = await process({
      file,
      docSpec,
      cropPixels,
      rotationDeg,
      options,
    });
    self.postMessage({ id, ok: true, blob, meta, validation });
  } catch (err) {
    self.postMessage({ id, ok: false, error: err?.message || String(err) });
  }
};
