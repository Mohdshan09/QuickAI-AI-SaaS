import { describe, it, expect } from "vitest";
import { specHash } from "./specHash.js";
import {
  assessSpecHealth,
  buildSubmissionDraft,
  diffDocuments,
  findAliasCandidates,
  currentSpecHash,
  submissionEvidence,
} from "./specReview.js";

const exams = [
  {
    id: "ssc-chsl-2026",
    slug: "ssc-chsl-photo-signature-size",
    name: "SSC CHSL",
    processableDocuments: [{ type: "signature", width: 300, height: 100, minKb: 10, maxKb: 20 }],
  },
  {
    id: "ibps-po-mt-xvi",
    slug: "ibps-po-photo-signature",
    name: "IBPS PO/MT-XVI",
    processableDocuments: [{ type: "photo", width: 200, height: 230, minKb: 20, maxKb: 50 }],
  },
  {
    id: "rrb-ntpc-cen-06-2025",
    slug: "rrb-ntpc-photo-signature",
    name: "RRB NTPC",
    processableDocuments: [{ type: "photo", width: 200, height: 230, minKb: 20, maxKb: 50 }],
  },
];

const chslDocs = [{ type: "signature", width: 300, height: 100, minKb: 10, maxKb: 20 }];
const chslHash = specHash(chslDocs);
const betterSignature = [{ type: "signature", width: 280, height: 80, minKb: 10, maxKb: 20 }];

function signal(normalized, extra = {}) {
  return { normalized, accepted: 0, rejected: 0, total: 0, rejectionRate: 0, lastAt: null, hashes: [], errors: [], ...extra };
}

describe("assessSpecHealth", () => {
  it("flags a shipped spec only past both the count and rate thresholds", () => {
    const { failing, totals } = assessSpecHealth(
      {
        outcomes: [
          signal("ssc chsl", {
            accepted: 1,
            rejected: 3,
            total: 4,
            rejectionRate: 0.75,
            hashes: [{ specHash: chslHash, accepted: 1, rejected: 3, lastAt: null }],
            errors: [{ message: "Signature too large", count: 3, lastAt: null }],
          }),
          // 1 rejection out of 2 is 50% but below FAILING_MIN_REJECTIONS.
          signal("ibps po mt", { accepted: 1, rejected: 1, total: 2, rejectionRate: 0.5 }),
        ],
      },
      exams,
    );
    expect(failing).toHaveLength(1);
    expect(failing[0].exam.id).toBe("ssc-chsl-2026");
    expect(failing[0].hashMismatch).toBe(false);
    expect(failing[0].errors[0].message).toBe("Signature too large");
    expect(totals).toMatchObject({ rejected: 4, accepted: 2, failing: 1 });
  });

  it("marks hash mismatch when rejections span several spec versions", () => {
    const { failing } = assessSpecHealth(
      {
        outcomes: [
          signal("ssc chsl", {
            accepted: 0,
            rejected: 3,
            total: 3,
            rejectionRate: 1,
            hashes: [{ specHash: "deadbeef", accepted: 0, rejected: 3, lastAt: null }],
          }),
        ],
      },
      exams,
    );
    expect(failing[0].hashMismatch).toBe(true);
  });

  it("surfaces a new submission hash as an update, not as demand", () => {
    const { updates, demand } = assessSpecHealth(
      {
        submissions: [
          {
            normalized: "ssc chsl",
            count: 4,
            lastAt: "2026-10-20T00:00:00Z",
            hashes: [
              { specHash: specHash(betterSignature), count: 3, lastAt: "2026-10-20T00:00:00Z", documents: betterSignature, notificationUrl: "https://ssc.gov.in/new.pdf" },
              { specHash: chslHash, count: 1, lastAt: "2026-10-01T00:00:00Z", documents: chslDocs, notificationUrl: "" },
            ],
          },
        ],
      },
      exams,
    );
    expect(demand).toHaveLength(0);
    expect(updates).toHaveLength(1);
    expect(updates[0].exam.id).toBe("ssc-chsl-2026");
    expect(updates[0].submission.documents).toEqual(betterSignature);
    expect(updates[0].currentHash).toBe(chslHash);
  });

  it("ignores a submission that matches the shipped spec", () => {
    const { updates } = assessSpecHealth(
      { submissions: [{ normalized: "ssc chsl", count: 1, lastAt: null, hashes: [{ specHash: chslHash, count: 1, lastAt: null, documents: chslDocs }] }] },
      exams,
    );
    expect(updates).toHaveLength(0);
  });

  it("merges requests and submissions for an unknown exam into one demand row", () => {
    const { demand } = assessSpecHealth(
      {
        requests: [
          { normalized: "rrb alp", count: 6, lastAt: "2026-10-18T00:00:00Z", samples: ["RRB ALP 2026"] },
          { normalized: "po", count: 2, lastAt: "2026-10-17T00:00:00Z", samples: ["PO"] },
        ],
        submissions: [
          {
            normalized: "rrb alp",
            count: 1,
            lastAt: "2026-10-19T00:00:00Z",
            hashes: [{ specHash: "f00d", count: 1, lastAt: "2026-10-19T00:00:00Z", documents: [{ type: "photo", width: 200, height: 230, minKb: 20, maxKb: 50 }], notificationUrl: "https://rrbcdg.gov.in/notice.pdf" }],
          },
        ],
      },
      exams,
    );
    expect(demand.map((row) => row.normalized)).toEqual(["rrb alp", "po"]);
    expect(demand[0]).toMatchObject({ requests: 6, name: "RRB ALP 2026" });
    expect(demand[0].submission.notificationUrl).toBe("https://rrbcdg.gov.in/notice.pdf");
    expect(demand[1].aliases.map((exam) => exam.id)).toEqual(["ibps-po-mt-xvi"]);
  });

  it("maps feedback exam refs back to shipped exams", () => {
    const { feedback, totals } = assessSpecHealth(
      {
        feedback: [
          { examRef: "ssc-chsl-2026", up: 2, down: 5, total: 7, reasons: [{ reason: "size", count: 4 }] },
          { examRef: "some unknown exam", up: 1, down: 1, total: 2, reasons: [] },
        ],
      },
      exams,
    );
    expect(feedback[0].exam.id).toBe("ssc-chsl-2026");
    expect(feedback[1].exam).toBeNull();
    expect(totals.down).toBe(6);
  });

  it("maps feedback stored against an id that differs from the exam name", () => {
    const { feedback, demand } = assessSpecHealth(
      { feedback: [{ examRef: "rrb-ntpc-cen-06-2025", up: 1, down: 2, total: 3, reasons: [] }] },
      exams,
    );
    expect(feedback[0].exam.name).toBe("RRB NTPC");
    expect(demand).toHaveLength(0);
  });
});

describe("findAliasCandidates", () => {
  it("matches a token subset of a known exam and ignores unrelated names", () => {
    expect(findAliasCandidates("po", exams).map((e) => e.id)).toEqual(["ibps-po-mt-xvi"]);
    expect(findAliasCandidates("rrb alp", exams)).toEqual([]);
    expect(findAliasCandidates("", exams)).toEqual([]);
  });
});

describe("currentSpecHash", () => {
  it("hashes only uploadable documents", () => {
    const exam = {
      documents: [
        { type: "photo", submission: "live", width: 200, height: 230 },
        { type: "signature", width: 300, height: 100, minKb: 10, maxKb: 20 },
      ],
      processableDocuments: [{ type: "signature", width: 300, height: 100, minKb: 10, maxKb: 20 }],
    };
    expect(currentSpecHash(exam)).toBe(chslHash);
  });
});

describe("buildSubmissionDraft", () => {
  it("builds a complete unverified file for a missing exam", () => {
    const draft = buildSubmissionDraft({
      submission: {
        documents: [{ type: "photo", width: 200, height: 230, minKb: 20, maxKb: 50 }],
        notificationUrl: "https://rrbcdg.gov.in/notice.pdf",
        specHash: "f00d",
        count: 1,
      },
      name: "RRB ALP",
      normalized: "rrb alp",
    });
    expect(draft.file).toBe("src/specs/exams/rrb-alp.json");
    const parsed = JSON.parse(draft.json);
    expect(parsed).toMatchObject({
      id: "rrb-alp",
      name: "RRB ALP",
      verified: false,
      listed: false,
      sourceUrl: "https://rrbcdg.gov.in/notice.pdf",
      lastVerified: null,
    });
    expect(parsed.documents).toEqual([
      { type: "photo", width: { px: 200 }, height: { px: 230 }, defaultWidthPx: 200, defaultHeightPx: 230, sizeKb: { min: 20, max: 50 } },
    ]);
  });

  it("emits only a documents snippet for a known exam, keeping its pixel defaults", () => {
    const draft = buildSubmissionDraft({
      exam: exams[0],
      submission: {
        documents: [{ type: "signature", width: null, height: null, minKb: 12, maxKb: 18 }],
        specHash: "abc",
        count: 2,
      },
    });
    expect(draft.file).toBe("src/specs/exams/ssc-chsl-2026.json");
    const parsed = JSON.parse(draft.json);
    expect(Object.keys(parsed)).toEqual(["documents"]);
    expect(parsed.documents[0]).toMatchObject({
      width: "not-specified",
      defaultWidthPx: 300,
      defaultHeightPx: 100,
      sizeKb: { min: 12, max: 18 },
    });
  });

  it("returns null when a submission carries no documents", () => {
    expect(buildSubmissionDraft({ submission: { documents: [] } })).toBeNull();
  });
});

describe("diffDocuments / submissionEvidence", () => {
  it("pairs live and submitted values per type", () => {
    const rows = diffDocuments(exams[0], betterSignature);
    expect(rows).toEqual([
      {
        type: "signature",
        current: { width: 300, height: 100, minKb: 10, maxKb: 20 },
        submitted: { width: 280, height: 80, minKb: 10, maxKb: 20 },
      },
    ]);
  });

  it("formats a copyable evidence block", () => {
    const text = submissionEvidence(exams[0], {
      normalized: "ssc chsl",
      specHash: "abc",
      count: 2,
      notificationUrl: "https://ssc.gov.in/new.pdf",
      documents: betterSignature,
    });
    expect(text).toContain("SSC CHSL — submitted spec");
    expect(text).toContain("Source: https://ssc.gov.in/new.pdf");
    expect(text).toContain("signature: 280×80 px, 10–20 KB");
  });
});
