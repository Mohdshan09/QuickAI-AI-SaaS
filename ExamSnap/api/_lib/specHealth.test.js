import { describe, it, expect } from "vitest";
import {
  summariseOutcomes,
  mergePortalErrors,
  summariseSubmissions,
  summariseRequests,
  summariseFeedback,
} from "./specHealth.js";

describe("summariseOutcomes", () => {
  const rows = [
    { normalized: "ssc chsl", spec_hash: "aaa", result: "rejected", n: 3, last_at: "2026-10-20T10:00:00Z" },
    { normalized: "ssc chsl", spec_hash: "aaa", result: "accepted", n: 1, last_at: "2026-10-21T10:00:00Z" },
    { normalized: "ssc cgl", spec_hash: "bbb", result: "accepted", n: 5, last_at: "2026-10-22T10:00:00Z" },
    { normalized: "ssc cgl", spec_hash: "ccc", result: "rejected", n: 1, last_at: "2026-10-19T10:00:00Z" },
  ];

  it("groups by exam and computes the rejection rate", () => {
    const [first, second] = summariseOutcomes(rows);
    expect(first.normalized).toBe("ssc chsl");
    expect(first).toMatchObject({ accepted: 1, rejected: 3, total: 4 });
    expect(first.rejectionRate).toBeCloseTo(0.75);
    expect(first.lastAt).toBe("2026-10-21T10:00:00Z");
    expect(second.normalized).toBe("ssc cgl");
    expect(second.rejectionRate).toBeCloseTo(1 / 6);
  });

  it("sorts by rejections, then total, and keeps per-hash splits", () => {
    const [first, second] = summariseOutcomes(rows);
    const [secondHash, firstHash] = second.hashes;
    expect(secondHash.specHash).toBe("bbb");
    expect(firstHash).toMatchObject({ specHash: "ccc", accepted: 0, rejected: 1 });
    expect(first.hashes).toHaveLength(1);
    expect(first.hashes[0]).toMatchObject({ specHash: "aaa", accepted: 1, rejected: 3 });
  });

  it("handles empty input", () => {
    expect(summariseOutcomes([])).toEqual([]);
    expect(summariseOutcomes()).toEqual([]);
  });
});

describe("mergePortalErrors", () => {
  it("attaches the top three errors in the order given", () => {
    const outcomes = summariseOutcomes([
      { normalized: "a", spec_hash: "h", result: "rejected", n: 4, last_at: null },
    ]);
    mergePortalErrors(outcomes, [
      { normalized: "a", portal_error: "Photo too big", n: 3, last_at: null },
      { normalized: "a", portal_error: "Signature blurry", n: 2, last_at: null },
      { normalized: "a", portal_error: "Wrong format", n: 1, last_at: null },
      { normalized: "a", portal_error: "Ignored fourth", n: 1, last_at: null },
      { normalized: "unknown", portal_error: "Not in outcomes", n: 9, last_at: null },
    ]);
    expect(outcomes[0].errors).toHaveLength(3);
    expect(outcomes[0].errors.map((e) => e.message)).toEqual(["Photo too big", "Signature blurry", "Wrong format"]);
  });
});

describe("summariseSubmissions", () => {
  it("sums submissions per exam and lists the newest hash first", () => {
    const [entry] = summariseSubmissions([
      {
        normalized: "ibps po",
        spec_hash: "old",
        documents: [{ type: "photo", width: 200, height: 230, minKb: 20, maxKb: 50 }],
        notification_url: "https://ibps.in/old.pdf",
        n: 2,
        last_at: "2026-10-01T00:00:00Z",
      },
      {
        normalized: "ibps po",
        spec_hash: "new",
        documents: [{ type: "photo", width: 240, height: 320, minKb: 20, maxKb: 50 }],
        notification_url: "https://ibps.in/new.pdf",
        n: 1,
        last_at: "2026-10-20T00:00:00Z",
      },
    ]);
    expect(entry.count).toBe(3);
    expect(entry.latest).toMatchObject({ specHash: "new", notificationUrl: "https://ibps.in/new.pdf" });
    expect(entry.hashes.map((h) => h.specHash)).toEqual(["new", "old"]);
  });

  it("defaults missing documents and URLs", () => {
    const [entry] = summariseSubmissions([{ normalized: "x", spec_hash: "h", documents: null, n: "2", last_at: null }]);
    expect(entry.count).toBe(2);
    expect(entry.latest.documents).toEqual([]);
    expect(entry.latest.notificationUrl).toBe("");
  });
});

describe("summariseRequests", () => {
  it("sorts by demand and keeps up to three sample names", () => {
    const rows = summariseRequests([
      { normalized: "rrb alp", n: 2, last_at: null, samples: ["RRB ALP", "rrb alp 2026"] },
      { normalized: "state psc", n: 7, last_at: null, samples: ["State PSC"] },
      { normalized: "", n: 9, last_at: null, samples: [] },
    ]);
    expect(rows.map((r) => r.normalized)).toEqual(["state psc", "rrb alp"]);
    expect(rows[1].samples).toEqual(["RRB ALP", "rrb alp 2026"]);
  });
});

describe("summariseFeedback", () => {
  it("counts ratings, ranks reasons and sorts by downvotes", () => {
    const rows = summariseFeedback([
      { exam_ref: "ssc-chsl-2026", rating: -1, reason: "size", n: 3, last_at: "2026-10-10T00:00:00Z" },
      { exam_ref: "ssc-chsl-2026", rating: -1, reason: "format", n: 1, last_at: "2026-10-11T00:00:00Z" },
      { exam_ref: "ssc-chsl-2026", rating: -1, reason: "size", n: 1, last_at: "2026-10-12T00:00:00Z" },
      { exam_ref: "ssc-chsl-2026", rating: 1, reason: null, n: 6, last_at: "2026-10-09T00:00:00Z" },
      { exam_ref: "ibps-po-xvi", rating: -1, reason: null, n: 1, last_at: null },
      { exam_ref: "ibps-po-xvi", rating: 1, reason: null, n: 9, last_at: null },
    ]);
    expect(rows[0].examRef).toBe("ssc-chsl-2026");
    expect(rows[0]).toMatchObject({ up: 6, down: 5, total: 11 });
    expect(rows[0].reasons).toEqual([
      { reason: "size", count: 4 },
      { reason: "format", count: 1 },
    ]);
    expect(rows[0].lastAt).toBe("2026-10-12T00:00:00Z");
    expect(rows[1]).toMatchObject({ up: 9, down: 1 });
  });
});
