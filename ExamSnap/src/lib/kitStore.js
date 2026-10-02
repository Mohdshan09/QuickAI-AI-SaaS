// Kit persistence (spec §4.5, P2-FR-52): hold an exam's processed documents so a user who
// leaves mid-kit can resume, cleared on finish/reset. IndexedDB keeps Blobs efficiently and
// stays entirely on-device — nothing is uploaded. All calls are best-effort: storage can be
// blocked (private mode), so failures resolve to a safe empty/no-op instead of throwing.

const DB_NAME = "examsnap-kits";
const STORE = "kits";

function openDB() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("no-idb"));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Save the current kit items for an exam slug. items: [{docType, filename, blob, meta}] */
export async function saveKit(slug, items) {
  try {
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(items, slug);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    /* storage unavailable — kit simply won't persist */
  }
}

/** Load a saved kit for an exam slug, or [] if none / storage unavailable. */
export async function loadKit(slug) {
  try {
    const db = await openDB();
    const result = await new Promise((resolve) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(slug);
      req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : []);
      req.onerror = () => resolve([]);
    });
    db.close();
    return result;
  } catch {
    return [];
  }
}

/** Clear a kit (on finish or explicit reset). */
export async function clearKit(slug) {
  try {
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(slug);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    /* ignore */
  }
}
