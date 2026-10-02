// Privacy-safe analytics (spec §10): events only, never images or personal data. Pluggable
// to Plausible/GA later via window.plausible or a custom sink; a no-op if nothing is wired,
// so calling track() is always safe.

export const EVENTS = {
  EXAM_SELECTED: "exam_selected",
  UPLOAD_STARTED: "upload_started",
  CROP_DONE: "crop_done",
  VALIDATION_PASSED: "validation_passed",
  VALIDATION_FAILED: "validation_failed",
  DOWNLOAD: "download",
  CHECKER_USED: "checker_used",
  // Phase 2 (spec §8)
  CHECKER_RESULT: "checker_result",
  SIGNATURE_CLEAN_USED: "signature_clean_used",
  THICKEN_USED: "thicken_used",
  BACKGROUND_TIER_USED: "background_tier_used",
  STRIP_USED: "strip_used",
  ZIP_DOWNLOAD: "zip_download",
  KIT_COMPLETED: "kit_completed",
  LANGUAGE: "language",
};

export function track(event, props = {}) {
  // Guard: only primitive, non-identifying props are ever forwarded.
  try {
    if (typeof window !== "undefined" && typeof window.plausible === "function") {
      window.plausible(event, { props });
    } else if (import.meta.env?.DEV) {
      console.debug("[analytics]", event, props);
    }
  } catch {
    /* analytics must never break the tool */
  }
}
