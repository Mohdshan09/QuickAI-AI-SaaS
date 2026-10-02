// Offline-tolerant submission queue (spec §FR-C9). POSTs (demand, spec submissions, outcomes,
// quality feedback) are tried immediately; if offline or the request fails they're stored in
// IndexedDB and flushed on the next load and whenever the browser comes back online. All calls
// are best-effort — a blocked IndexedDB (private mode) degrades to "send now or drop", never
// throwing into the UI. Nothing here ever holds image data.

import { postJson } from "./apiClient.js";

const DB_NAME = "examsnap-queue";
const STORE = "pending";

function openDB() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("no-idb"));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function enqueue(item) {
  try {
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).add({ ...item, queuedAt: Date.now() });
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    /* storage blocked — nothing we can do; the submission is simply lost */
  }
}

/** Send now; on any failure (incl. offline) queue it for later. Never throws. */
export async function sendOrQueue(endpoint, body) {
  const online = typeof navigator === "undefined" || navigator.onLine !== false;
  if (online) {
    try {
      await postJson(endpoint, body);
      return;
    } catch {
      /* fall through to queue */
    }
  }
  await enqueue({ endpoint, body });
}

/** Flush queued submissions in order; stop at the first failure (likely still offline). */
export async function flushQueue() {
  let db;
  try {
    db = await openDB();
  } catch {
    return;
  }
  try {
    const all = await new Promise((resolve) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
    for (const item of all) {
      try {
        await postJson(item.endpoint, item.body);
      } catch {
        break; // still failing — keep this and the rest for next time
      }
      await new Promise((resolve) => {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).delete(item.id);
        tx.oncomplete = resolve;
        tx.onerror = resolve;
      });
    }
  } finally {
    db.close();
  }
}

/** Wire automatic flushing: once now, and whenever we regain connectivity. */
export function initQueueFlush() {
  if (typeof window === "undefined") return;
  flushQueue();
  window.addEventListener("online", flushQueue);
}
