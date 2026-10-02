// Public engine entry — a thin wrapper over the composable pipeline (engine/pipeline.js).
// Kept so existing callers (lib/processClient.js, the worker) stay unchanged while Phase 2
// steps are added inside the pipeline.

import { run } from "./pipeline.js";

/**
 * @param {object} args { file, docSpec, cropPixels, rotationDeg?, options? }
 *   options (Phase 2): { cleanup?:{strength,ink,thicken}, background?:"brighten", strip?:{name,date} }
 * @returns {Promise<{ blob, meta, validation }>}
 */
export async function process(args) {
  return run(args);
}
