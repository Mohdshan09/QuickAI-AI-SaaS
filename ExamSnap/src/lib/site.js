// Client-side view of the deployment URL. vite.config.js injects SITE_URL as __SITE_URL__
// (see scripts/site.mjs) and sets BASE_URL to the same base path the router uses, so canonical,
// Open Graph and JSON-LD URLs stay in sync with sitemap.xml and robots.txt.
//
// SITE_URL is already the public root, subfolder included ("https://host/examsnap"), so it is
// used as-is; BASE is only for in-app routing.

export const SITE_URL = __SITE_URL__;
export const BASE = import.meta.env.BASE_URL || "/";

/** Absolute URL of an app path (no trailing slash; the host redirects those). */
export function siteUrl(path = "/") {
  const clean = path.replace(/^\/+/, "").replace(/\/+$/, "");
  return clean ? `${SITE_URL}/${clean}` : SITE_URL;
}
