// Single source of truth for where ExamSnap is published. Everything SEO derives from it:
// the Vite base path, the canonical/OG URLs in <Seo>, the sitemap and robots.txt.
//
// Set SITE_URL in the Vercel project (and .env.local for local production builds). It is the
// public root of the app and may include a subfolder:
//   "https://exam-snap-drab.vercel.app/examsnap" → base "/examsnap/"
//   "https://examsnap.app"                       → base "/"
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Vite configs and plain `node scripts/*.mjs` runs both end up here, so load .env files
// ourselves instead of relying on Vite's loader. Real environment variables win.
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
for (const file of [".env", ".env.local"]) {
  try {
    process.loadEnvFile(join(root, file));
  } catch {
    /* file absent — fine */
  }
}

/** Public root of the app, absolute and without a trailing slash. */
export const SITE_URL = (process.env.SITE_URL || "https://exam-snap-drab.vercel.app/examsnap").replace(/\/+$/, "");

/** Base path Vite serves under, always with a trailing slash ("/" or "/examsnap/"). */
export const BASE = new URL(SITE_URL).pathname.replace(/\/*$/, "/");

/** Absolute URL of an app path (no trailing slash; Vercel's trailingSlash:false serves that). */
export function absoluteUrl(path = "/") {
  const clean = path.replace(/^\/+/, "").replace(/\/+$/, "");
  return clean ? `${SITE_URL}/${clean}` : SITE_URL;
}
