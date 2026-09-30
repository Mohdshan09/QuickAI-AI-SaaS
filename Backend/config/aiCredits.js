// Server-side credit cost of each AI service (spec §8, §56). Costs are an
// internal product unit, independent of provider $ cost, and centralized here so
// they can change without touching controllers. Each is env-overridable, e.g.
// AI_CREDIT_COST_MATCH_ANALYSIS=3.
import { SERVICES } from "./aiServices.js";

const envCost = (service, fallback) => {
  const raw = process.env[`AI_CREDIT_COST_${service}`];
  const n = parseInt(raw ?? "", 10);
  return Number.isInteger(n) && n >= 0 ? n : fallback;
};

// Default costs. JD_ANALYSIS runs inside a match today (not charged separately);
// it is listed for when/if JD analysis is exposed standalone.
export const AI_CREDIT_COSTS = {
  [SERVICES.MATCH_ANALYSIS]: envCost("MATCH_ANALYSIS", 2),
  [SERVICES.RESUME_OPTIMIZATION]: envCost("RESUME_OPTIMIZATION", 3),
  [SERVICES.JD_ANALYSIS]: envCost("JD_ANALYSIS", 1),
};

// Cost of a service, or 0 if it is not a credit-charged service.
export const getServiceCost = (service) => AI_CREDIT_COSTS[service] ?? 0;

// Max time to wait on an AI provider call before treating it as failed (spec §26).
export const AI_REQUEST_TIMEOUT_MS = Math.max(
  1000,
  parseInt(process.env.AI_REQUEST_TIMEOUT_MS ?? "60000", 10) || 60000
);
