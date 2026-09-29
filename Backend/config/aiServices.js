// Centralized, extensible registry of AI services and providers.
// The spec requires the service list to live in one place (not scattered as
// magic strings across features) so admin analytics can group by it and new
// features can be added without touching the tracking layer.

// Provider keys used on ai_requests.provider and in ai_model_pricing.
export const PROVIDERS = {
  GEMINI: "gemini",
  CLIPDROP: "clipdrop",
  CLOUDINARY: "cloudinary",
};

// Every trackable AI operation. Keys are what code passes; values are stored
// verbatim on ai_requests.service. RESUME_RECHECK / COVER_LETTER / AI_INTERVIEW
// are declared ahead of those features so the admin service list is stable.
export const SERVICES = {
  RESUME_PARSING: "RESUME_PARSING",
  JD_ANALYSIS: "JD_ANALYSIS",
  MATCH_ANALYSIS: "MATCH_ANALYSIS",
  RESUME_OPTIMIZATION: "RESUME_OPTIMIZATION",
  RESUME_RECHECK: "RESUME_RECHECK",
  RESUME_REVIEW: "RESUME_REVIEW",
  COVER_LETTER: "COVER_LETTER",
  AI_INTERVIEW: "AI_INTERVIEW",
  ARTICLE: "ARTICLE",
  BLOG_TITLE: "BLOG_TITLE",
  IMAGE_GENERATION: "IMAGE_GENERATION",
  IMAGE_EDIT: "IMAGE_EDIT",
  OTHER: "OTHER",
};

// Human-friendly labels for the admin UI (falls back to the raw key).
export const SERVICE_LABELS = {
  RESUME_PARSING: "Resume Parsing",
  JD_ANALYSIS: "JD Analysis",
  MATCH_ANALYSIS: "Match Analysis",
  RESUME_OPTIMIZATION: "Resume Optimization",
  RESUME_RECHECK: "Resume Re-check",
  RESUME_REVIEW: "Resume Review",
  COVER_LETTER: "Cover Letter",
  AI_INTERVIEW: "AI Interview",
  ARTICLE: "Article",
  BLOG_TITLE: "Blog Title",
  IMAGE_GENERATION: "Image Generation",
  IMAGE_EDIT: "Image Edit",
  OTHER: "Other",
};

export const isKnownService = (s) => Object.prototype.hasOwnProperty.call(SERVICES, s);
