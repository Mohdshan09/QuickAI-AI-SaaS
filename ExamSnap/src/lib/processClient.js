// Thin client the UI calls to run the pipeline. Prefers the Web Worker (OffscreenCanvas),
// and transparently falls back to running the engine on the main thread where either is
// unavailable (e.g. older Safari). Same inputs/outputs either way.

import { hasOffscreenCanvas } from "../engine/canvasEnv.js";

let worker;
let nextId = 1;
const pending = new Map();

function canUseWorker() {
  return typeof Worker !== "undefined" && hasOffscreenCanvas();
}

function getWorker() {
  if (!worker) {
    worker = new Worker(new URL("../workers/processor.worker.js", import.meta.url), {
      type: "module",
    });
    worker.onmessage = (e) => {
      const { id, ok, blob, meta, validation, error } = e.data;
      const entry = pending.get(id);
      if (!entry) return;
      pending.delete(id);
      ok ? entry.resolve({ blob, meta, validation }) : entry.reject(new Error(error));
    };
    worker.onerror = (e) => {
      // Surface a worker-level failure to every in-flight job.
      for (const [, entry] of pending) entry.reject(new Error(e.message || "Worker error"));
      pending.clear();
    };
  }
  return worker;
}

/**
 * @param {{ file, docSpec, cropPixels, rotationDeg?, transform? }} job
 * @returns {Promise<{ blob, meta, validation }>}
 */
export async function runPipeline(job) {
  if (canUseWorker()) {
    const id = nextId++;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      getWorker().postMessage({ id, ...job });
    });
  }
  // Main-thread fallback: import the engine directly.
  const { process } = await import("../engine/process.js");
  return process(job);
}
