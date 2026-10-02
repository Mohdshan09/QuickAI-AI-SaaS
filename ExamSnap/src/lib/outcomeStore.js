// Local download records that drive the next-visit outcome prompt (spec §8.2). On every
// download we store { examRef, specHash, documentTypes, downloadedAt } plus display fields.
// On a later visit, if a record is 1 hour–14 days old, not yet answered and dismissed < 2
// times, we ask whether the portal accepted the files. This also gates outcome reporting to
// specs the user actually processed (§7.5). Best-effort IndexedDB — never throws into the UI.
// Keyed by examRef so a new download for the same exam replaces the old pending question.

const DB_NAME = "examsnap-outcomes";
const STORE = "records";
const HOUR = 60 * 60 * 1000;
const MIN_AGE = 1 * HOUR;
const MAX_AGE = 14 * 24 * HOUR;
const MAX_DISMISSALS = 2;

function openDB() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("no-idb"));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "examRef" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(db, mode, fn) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const store = t.objectStore(STORE);
    const out = fn(store);
    t.oncomplete = () => resolve(out?.result ?? out);
    t.onerror = () => reject(t.error);
  });
}

/** Record a download (replaces any pending record for the same examRef). */
export async function recordDownload(rec) {
  try {
    const db = await openDB();
    await tx(db, "readwrite", (s) =>
      s.put({ dismissals: 0, answered: false, downloadedAt: Date.now(), ...rec }),
    );
    db.close();
  } catch {
    /* storage blocked — the outcome prompt just won't appear */
  }
}

/** The most recent record currently due for an outcome question, or null. */
export async function getDueRecord(now = Date.now()) {
  try {
    const db = await openDB();
    const all = await tx(db, "readonly", (s) => s.getAll());
    db.close();
    const due = (all || [])
      .filter(
        (r) =>
          !r.answered &&
          (r.dismissals || 0) < MAX_DISMISSALS &&
          now - r.downloadedAt >= MIN_AGE &&
          now - r.downloadedAt <= MAX_AGE,
      )
      .sort((a, b) => b.downloadedAt - a.downloadedAt);
    return due[0] || null;
  } catch {
    return null;
  }
}

async function patch(examRef, changes) {
  try {
    const db = await openDB();
    const existing = await tx(db, "readonly", (s) => s.get(examRef));
    if (existing) await tx(db, "readwrite", (s) => s.put({ ...existing, ...changes }));
    db.close();
  } catch {
    /* ignore */
  }
}

/** Mark answered and clear it from the active set (§FR-F7). */
export function markAnswered(examRef) {
  return patch(examRef, { answered: true });
}

/** "Haven't uploaded yet" — ask again next visit, stop after two dismissals (§FR-F6). */
export async function bumpDismissal(examRef) {
  try {
    const db = await openDB();
    const existing = await tx(db, "readonly", (s) => s.get(examRef));
    if (existing) {
      await tx(db, "readwrite", (s) => s.put({ ...existing, dismissals: (existing.dismissals || 0) + 1 }));
    }
    db.close();
  } catch {
    /* ignore */
  }
}
