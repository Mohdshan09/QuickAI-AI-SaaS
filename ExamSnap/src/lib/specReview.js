// Turns the raw spec-health aggregates into review decisions for the admin page: which shipped
// specs portals are rejecting, which submitted specs disagree with the live ones, and which
// requested exams are still missing. Pure — it receives the endpoint payload plus the resolved
// exam list, so it can be unit-tested without a browser or a database.
//
// The loop always ends with a human editing src/specs/exams/*.json and redeploying: a Vercel
// function cannot write into the repo, so the UI only ever produces a draft to copy.

import { normalizeExamName } from "./normalize.js";
import { specHash } from "./specHash.js";

/** A spec is "failing" once it has enough rejections AND a meaningful rejection rate. */
export const FAILING_MIN_REJECTIONS = 2;
export const FAILING_RATE = 0.3;

export function currentSpecHash(exam) {
  return specHash(exam?.processableDocuments || exam?.documents || []);
}

/** Known exams whose name contains every token of `normalized` — a likely alias, not a new exam. */
export function findAliasCandidates(normalized, exams) {
  const tokens = String(normalized || "").split(" ").filter(Boolean);
  if (!tokens.length) return [];
  return exams.filter((exam) => {
    const known = new Set(normalizeExamName(exam.name).split(" ").filter(Boolean));
    return tokens.every((token) => known.has(token));
  });
}

function latest(a, b) {
  if (!a) return b || null;
  if (!b) return a;
  return new Date(b) > new Date(a) ? b : a;
}

function demandEntry(map, normalized, patch) {
  let entry = map.get(normalized);
  if (!entry) {
    entry = { normalized, name: normalized, requests: 0, lastAt: null, samples: [], submission: null };
    map.set(normalized, entry);
  }
  entry.requests += patch.requests || 0;
  if (patch.samples?.length) entry.samples = patch.samples;
  if (patch.submission) entry.submission = patch.submission;
  entry.lastAt = latest(entry.lastAt, patch.lastAt);
  return entry;
}

/**
 * @param {{outcomes?:Array, submissions?:Array, requests?:Array, feedback?:Array}} data endpoint payload
 * @param {Array} exams resolved exams (getExams())
 */
export function assessSpecHealth(data = {}, exams = []) {
  const known = new Map();
  const liveHash = new Map();
  for (const exam of exams) {
    // Outcomes arrive normalised from the exam name, but quality feedback stores the exam id
    // (e.g. "rrb-ntpc-cen-06-2025" for "RRB NTPC"), so both forms must resolve.
    for (const key of [normalizeExamName(exam.name), normalizeExamName(exam.id)]) {
      if (key) known.set(key, exam);
    }
    liveHash.set(exam.id, currentSpecHash(exam));
  }

  const failing = [];
  let rejected = 0;
  let accepted = 0;

  for (const outcome of data.outcomes || []) {
    rejected += outcome.rejected || 0;
    accepted += outcome.accepted || 0;
    const exam = known.get(outcome.normalized);
    if (!exam) continue;
    if (outcome.rejected >= FAILING_MIN_REJECTIONS && outcome.rejectionRate >= FAILING_RATE) {
      const hash = liveHash.get(exam.id);
      failing.push({
        ...outcome,
        exam,
        currentHash: hash,
        hashMismatch: (outcome.hashes || []).some((h) => h.specHash !== hash),
      });
    }
  }

  const updates = [];
  const demand = new Map();
  for (const submission of data.submissions || []) {
    const exam = known.get(submission.normalized);
    if (!exam) {
      // Newest submitted document set is the evidence for drafting a brand-new spec.
      const newest = (submission.hashes || [])[0];
      demandEntry(demand, submission.normalized, {
        submission: newest ? { ...newest, normalized: submission.normalized, count: submission.count } : null,
        lastAt: submission.lastAt,
      });
      continue;
    }
    const hash = liveHash.get(exam.id);
    const differing = (submission.hashes || []).find((h) => h.specHash !== hash);
    if (differing) {
      updates.push({
        exam,
        normalized: submission.normalized,
        totalSubmissions: submission.count,
        currentHash: hash,
        submission: { ...differing, normalized: submission.normalized, count: submission.count },
      });
    }
  }

  for (const request of data.requests || []) {
    if (known.has(request.normalized)) continue;
    demandEntry(demand, request.normalized, {
      requests: request.count,
      samples: request.samples,
      lastAt: request.lastAt,
    });
  }

  const feedback = (data.feedback || [])
    .map((entry) => {
      const normalized = normalizeExamName(entry.examRef);
      return { ...entry, normalized, exam: known.get(normalized) || null };
    })
    .filter((entry) => entry.down > 0 || entry.up > 0)
    .sort((a, b) => b.down - a.down || b.total - a.total);

  failing.sort((a, b) => b.rejected - a.rejected || b.rejectionRate - a.rejectionRate);
  updates.sort((a, b) => new Date(b.submission.lastAt) - new Date(a.submission.lastAt));

  const demandRows = [...demand.values()]
    .map((entry) => ({
      ...entry,
      name: entry.samples[0] || entry.name,
      aliases: findAliasCandidates(entry.normalized, exams),
    }))
    .sort(
      (a, b) =>
        b.requests - a.requests ||
        Number(Boolean(b.submission)) - Number(Boolean(a.submission)) ||
        new Date(b.lastAt || 0) - new Date(a.lastAt || 0),
    );

  return {
    failing,
    updates,
    demand: demandRows,
    feedback,
    totals: {
      rejected,
      accepted,
      failing: failing.length,
      updates: updates.length,
      demand: demandRows.length,
      down: feedback.reduce((sum, entry) => sum + entry.down, 0),
    },
  };
}

const DEFAULT_PX = {
  photo: { w: 200, h: 230 },
  signature: { w: 300, h: 80 },
  thumb: { w: 240, h: 240 },
  declaration: { w: 800, h: 400 },
};

function slugify(normalized) {
  return String(normalized || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Draft a spec file the owner can paste into src/specs/exams/. For a known exam this returns the
 * uploaded documents as a raw-spec `documents` snippet (a full file would lose the live-capture
 * docs and the richer fields); for a missing exam it returns a complete, unverified file.
 */
export function buildSubmissionDraft({ exam = null, submission, name = "", normalized = "" }) {
  const submitted = submission?.documents || [];
  if (!submitted.length) return null;

  const existing = new Map((exam?.processableDocuments || exam?.documents || []).map((d) => [d.type, d]));
  const documents = submitted.map((doc) => {
    const base = existing.get(doc.type) || {};
    const fallback = DEFAULT_PX[doc.type] || DEFAULT_PX.photo;
    const width = doc.width != null ? Math.round(doc.width) : null;
    const height = doc.height != null ? Math.round(doc.height) : null;
    return {
      type: doc.type,
      width: width != null ? { px: width } : "not-specified",
      height: height != null ? { px: height } : "not-specified",
      defaultWidthPx: width ?? base.width ?? fallback.w,
      defaultHeightPx: height ?? base.height ?? fallback.h,
      sizeKb: { min: doc.minKb || 0, max: doc.maxKb ?? null },
    };
  });

  if (exam) {
    return {
      file: `src/specs/exams/${exam.id}.json`,
      json: JSON.stringify({ documents }, null, 2),
    };
  }

  const id = slugify(normalized || name) || "new-exam";
  return {
    file: `src/specs/exams/${id}.json`,
    json: JSON.stringify(
      {
        id,
        slug: id,
        name: name || normalized,
        organization: "",
        conductedBy: "",
        posts: "",
        cycle: "",
        popular: false,
        verified: false,
        listed: false,
        sourceUrl: submission.notificationUrl || "",
        sourcePage: "",
        lastVerified: null,
        documents,
      },
      null,
      2,
    ),
  };
}

/** Live vs submitted values per document type, for the review table. */
export function diffDocuments(exam, submitted = []) {
  const live = new Map((exam?.processableDocuments || []).map((doc) => [doc.type, doc]));
  return submitted.map((doc) => {
    const current = live.get(doc.type) || null;
    return {
      type: doc.type,
      current: current
        ? {
            width: current.width,
            height: current.height,
            minKb: current.minKb,
            maxKb: Number.isFinite(current.maxKb) ? current.maxKb : null,
          }
        : null,
      submitted: {
        width: doc.width,
        height: doc.height,
        minKb: doc.minKb ?? 0,
        maxKb: doc.maxKb ?? null,
      },
    };
  });
}

/** Plain-text evidence block copied alongside the review (safe to paste into a commit note). */
export function submissionEvidence(exam, submission) {
  const lines = [
    `${exam?.name || submission?.normalized || "Exam"} — submitted spec`,
    `Source: ${submission?.notificationUrl || "none supplied"}`,
    `Hash: ${submission?.specHash || "?"} · ${submission?.count || 0} submission(s)`,
  ];
  for (const doc of submission?.documents || []) {
    const dims = doc.width != null && doc.height != null ? `${doc.width}×${doc.height} px` : "pixels not specified";
    const kb = `${doc.minKb ?? 0}–${doc.maxKb ?? "∞"} KB`;
    lines.push(`${doc.type}: ${dims}, ${kb}`);
  }
  return lines.join("\n");
}
