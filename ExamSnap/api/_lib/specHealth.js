// Pure aggregation for the spec-admin loop. The DB returns flat grouped rows; these functions
// fold them into one entry per exam so the admin page can show "rejected 3/4 times" without
// re-deriving anything in JSX. No I/O here, so it is unit-tested directly.

const num = (value) => Number(value) || 0;

function latest(a, b) {
  if (!a) return b || null;
  if (!b) return a;
  return new Date(b) > new Date(a) ? b : a;
}

/**
 * Rows: one per (normalized, spec_hash, result) — `{ normalized, spec_hash, result, n, last_at }`.
 * Returns per exam: accepted/rejected totals, rejection rate, last signal and per-hash splits.
 */
export function summariseOutcomes(rows = []) {
  const byName = new Map();
  for (const row of rows) {
    const key = row.normalized;
    if (!key) continue;
    let entry = byName.get(key);
    if (!entry) {
      entry = { normalized: key, accepted: 0, rejected: 0, total: 0, lastAt: null, hashes: [], errors: [] };
      byName.set(key, entry);
    }
    const count = num(row.n);
    const accepted = row.result === "accepted";
    entry[accepted ? "accepted" : "rejected"] += count;
    entry.total += count;
    entry.lastAt = latest(entry.lastAt, row.last_at);

    let hash = entry.hashes.find((h) => h.specHash === row.spec_hash);
    if (!hash) {
      hash = { specHash: row.spec_hash, accepted: 0, rejected: 0, lastAt: null };
      entry.hashes.push(hash);
    }
    hash[accepted ? "accepted" : "rejected"] += count;
    hash.lastAt = latest(hash.lastAt, row.last_at);
  }

  for (const entry of byName.values()) {
    entry.rejectionRate = entry.total ? entry.rejected / entry.total : 0;
    entry.hashes.sort((a, b) => b.rejected + b.accepted - (a.rejected + a.accepted));
  }

  return [...byName.values()].sort(
    (a, b) => b.rejected - a.rejected || b.total - a.total || a.normalized.localeCompare(b.normalized),
  );
}

/** Attach the top portal errors (already ordered by count) to their outcome groups. */
export function mergePortalErrors(outcomes, rows = []) {
  const byName = new Map(outcomes.map((o) => [o.normalized, o]));
  for (const row of rows) {
    const entry = byName.get(row.normalized);
    if (!entry || !row.portal_error) continue;
    if (entry.errors.length >= 3) continue;
    entry.errors.push({ message: row.portal_error, count: num(row.n), lastAt: row.last_at });
  }
  return outcomes;
}

/**
 * Rows: one per (normalized, spec_hash) with the newest documents for that hash —
 * `{ normalized, spec_hash, documents, notification_url, n, last_at }`.
 * Returns per exam: total submissions, newest hash first.
 */
export function summariseSubmissions(rows = []) {
  const byName = new Map();
  for (const row of rows) {
    const key = row.normalized;
    if (!key) continue;
    let entry = byName.get(key);
    if (!entry) {
      entry = { normalized: key, count: 0, lastAt: null, hashes: [], latest: null };
      byName.set(key, entry);
    }
    entry.count += num(row.n);
    entry.lastAt = latest(entry.lastAt, row.last_at);
    entry.hashes.push({
      specHash: row.spec_hash,
      count: num(row.n),
      lastAt: row.last_at,
      documents: Array.isArray(row.documents) ? row.documents : [],
      notificationUrl: row.notification_url || "",
    });
  }

  for (const entry of byName.values()) {
    entry.hashes.sort((a, b) => new Date(b.lastAt) - new Date(a.lastAt) || b.count - a.count);
    entry.latest = entry.hashes[0] || null;
  }

  return [...byName.values()].sort((a, b) => b.count - a.count || a.normalized.localeCompare(b.normalized));
}

/** Rows: `{ normalized, n, last_at, samples }` — `samples` is up to three raw names. */
export function summariseRequests(rows = []) {
  return rows
    .filter((row) => row.normalized)
    .map((row) => ({
      normalized: row.normalized,
      count: num(row.n),
      lastAt: row.last_at,
      samples: (Array.isArray(row.samples) ? row.samples : []).filter(Boolean),
    }))
    .sort((a, b) => b.count - a.count || a.normalized.localeCompare(b.normalized));
}

/** Rows: `{ exam_ref, rating, reason, n, last_at }` — folded into thumbs up/down per exam. */
export function summariseFeedback(rows = []) {
  const byRef = new Map();
  for (const row of rows) {
    const key = row.exam_ref;
    if (!key) continue;
    let entry = byRef.get(key);
    if (!entry) {
      entry = { examRef: key, up: 0, down: 0, total: 0, lastAt: null, reasons: [] };
      byRef.set(key, entry);
    }
    const count = num(row.n);
    entry[row.rating === 1 ? "up" : "down"] += count;
    entry.total += count;
    entry.lastAt = latest(entry.lastAt, row.last_at);

    if (row.rating !== 1 && row.reason) {
      const reason = entry.reasons.find((r) => r.reason === row.reason);
      if (reason) reason.count += count;
      else entry.reasons.push({ reason: row.reason, count });
    }
  }

  for (const entry of byRef.values()) {
    entry.reasons.sort((a, b) => b.count - a.count);
  }

  return [...byRef.values()].sort((a, b) => b.down - a.down || b.total - a.total);
}
