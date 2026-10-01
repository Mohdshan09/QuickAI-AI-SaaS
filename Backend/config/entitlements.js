// Central entitlement definition (spec §8). This file is the single source of
// truth for the application's feature keys, how they map to the AI service
// registry, and the FREE-plan access rules that scripts/seedPlans.js writes into
// `plan_entitlements`. Routes must NOT hardcode magic limits (spec §11, §16).
import { SERVICES } from "./aiServices.js";
import { getServiceCost } from "./aiCredits.js";

// Feature keys stored in plan_entitlements.feature_key / feature_usage.feature_key
// (lowercase snake, per spec §8). Only features that correspond to a real route
// exist here — do not invent identifiers for features that don't exist (spec §8).
export const ENTITLEMENTS = {
  // Career AI — entitlement + credits (monthly_limit NULL; credits are the meter).
  MATCH_ANALYSIS: "match_analysis",
  RESUME_OPTIMIZATION: "resume_optimization",

  // Generic AI — entitlement + monthly free-usage limit (not credit-metered).
  RESUME_REVIEW: "resume_review",
  ARTICLE_GENERATION: "article_generation",
  BLOG_TITLE_GENERATION: "blog_title_generation",
  IMAGE_GENERATION: "image_generation",
  IMAGE_EDITING: "image_editing",
};

// Map the central AI service registry (config/aiServices.js) to feature keys.
// Note: background removal and object removal are both the IMAGE_EDIT service, so
// they share the single `image_editing` monthly counter.
export const SERVICE_TO_FEATURE = {
  [SERVICES.MATCH_ANALYSIS]: ENTITLEMENTS.MATCH_ANALYSIS,
  [SERVICES.RESUME_OPTIMIZATION]: ENTITLEMENTS.RESUME_OPTIMIZATION,
  [SERVICES.RESUME_REVIEW]: ENTITLEMENTS.RESUME_REVIEW,
  [SERVICES.ARTICLE]: ENTITLEMENTS.ARTICLE_GENERATION,
  [SERVICES.BLOG_TITLE]: ENTITLEMENTS.BLOG_TITLE_GENERATION,
  [SERVICES.IMAGE_GENERATION]: ENTITLEMENTS.IMAGE_GENERATION,
  [SERVICES.IMAGE_EDIT]: ENTITLEMENTS.IMAGE_EDITING,
};

// Reverse: feature_key -> the SERVICES.* key whose credit cost applies. Only
// credit-metered features appear meaningfully (the rest cost 0).
const FEATURE_TO_SERVICE = Object.fromEntries(
  Object.entries(SERVICE_TO_FEATURE).map(([service, feature]) => [feature, service])
);

// Human-friendly labels for UI/admin (falls back to the raw key).
export const FEATURE_LABELS = {
  [ENTITLEMENTS.MATCH_ANALYSIS]: "Match Analysis",
  [ENTITLEMENTS.RESUME_OPTIMIZATION]: "Resume Optimization",
  [ENTITLEMENTS.RESUME_REVIEW]: "Resume Review",
  [ENTITLEMENTS.ARTICLE_GENERATION]: "Article Generation",
  [ENTITLEMENTS.BLOG_TITLE_GENERATION]: "Blog Title Generation",
  [ENTITLEMENTS.IMAGE_GENERATION]: "Image Generation",
  [ENTITLEMENTS.IMAGE_EDITING]: "Image Editing",
};

// FREE-plan access rules (spec §6, §11), the decision locked for Phase 4:
//   - Career ops: enabled, monthlyLimit null (credit-metered).
//   - Generic ops: enabled with a per-feature monthly free-usage limit.
// Limits are overridable via env (e.g. FREE_LIMIT_RESUME_REVIEW=5) so they can be
// tuned without code changes; seedPlans.js reads the resolved values.
const envLimit = (feature, fallback) => {
  const raw = process.env[`FREE_LIMIT_${feature.toUpperCase()}`];
  const n = parseInt(raw ?? "", 10);
  return Number.isInteger(n) && n >= 0 ? n : fallback;
};

export const FREE_ENTITLEMENTS = {
  [ENTITLEMENTS.MATCH_ANALYSIS]: { enabled: true, monthlyLimit: null },
  [ENTITLEMENTS.RESUME_OPTIMIZATION]: { enabled: true, monthlyLimit: null },
  [ENTITLEMENTS.RESUME_REVIEW]: { enabled: true, monthlyLimit: envLimit(ENTITLEMENTS.RESUME_REVIEW, 3) },
  [ENTITLEMENTS.ARTICLE_GENERATION]: { enabled: true, monthlyLimit: envLimit(ENTITLEMENTS.ARTICLE_GENERATION, 10) },
  [ENTITLEMENTS.BLOG_TITLE_GENERATION]: { enabled: true, monthlyLimit: envLimit(ENTITLEMENTS.BLOG_TITLE_GENERATION, 10) },
  [ENTITLEMENTS.IMAGE_GENERATION]: { enabled: true, monthlyLimit: envLimit(ENTITLEMENTS.IMAGE_GENERATION, 5) },
  [ENTITLEMENTS.IMAGE_EDITING]: { enabled: true, monthlyLimit: envLimit(ENTITLEMENTS.IMAGE_EDITING, 3) },
};

// Paid plans (Phase 5): career ops stay credit-metered (monthlyLimit null) on every
// plan; generic tools get higher monthly caps per tier. Career entitlement must stay
// enabled so credit-gated ops remain available on paid plans too.
const paidEntitlements = (limits) => ({
  [ENTITLEMENTS.MATCH_ANALYSIS]: { enabled: true, monthlyLimit: null },
  [ENTITLEMENTS.RESUME_OPTIMIZATION]: { enabled: true, monthlyLimit: null },
  [ENTITLEMENTS.RESUME_REVIEW]: { enabled: true, monthlyLimit: limits.resume_review },
  [ENTITLEMENTS.ARTICLE_GENERATION]: { enabled: true, monthlyLimit: limits.article_generation },
  [ENTITLEMENTS.BLOG_TITLE_GENERATION]: { enabled: true, monthlyLimit: limits.blog_title_generation },
  [ENTITLEMENTS.IMAGE_GENERATION]: { enabled: true, monthlyLimit: limits.image_generation },
  [ENTITLEMENTS.IMAGE_EDITING]: { enabled: true, monthlyLimit: limits.image_editing },
});

export const STARTER_ENTITLEMENTS = paidEntitlements({
  article_generation: 50,
  blog_title_generation: 50,
  image_generation: 25,
  image_editing: 15,
  resume_review: 15,
});

export const PRO_ENTITLEMENTS = paidEntitlements({
  article_generation: 150,
  blog_title_generation: 150,
  image_generation: 75,
  image_editing: 40,
  resume_review: 40,
});

// Entitlements per plan key, for seeding (Phase 5: FREE, STARTER, PRO).
export const PLAN_ENTITLEMENTS = {
  FREE: FREE_ENTITLEMENTS,
  STARTER: STARTER_ENTITLEMENTS,
  PRO: PRO_ENTITLEMENTS,
};

export const ALL_FEATURE_KEYS = Object.values(ENTITLEMENTS);

export const isKnownFeature = (key) => ALL_FEATURE_KEYS.includes(key);

export const featureForService = (service) => SERVICE_TO_FEATURE[service] ?? null;

// Credit cost for a feature (0 for non-credit / generic features). Used by the
// entitlements API so the UI can show "N credits" for career ops.
export const creditCostForFeature = (featureKey) => {
  const service = FEATURE_TO_SERVICE[featureKey];
  return service ? getServiceCost(service) : 0;
};

// A feature is credit-metered when it has a positive credit cost (career ops).
export const isCreditMetered = (featureKey) => creditCostForFeature(featureKey) > 0;
