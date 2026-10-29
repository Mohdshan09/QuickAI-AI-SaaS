// Generate public/sitemap.xml and public/robots.txt from the exam specs, so new exams are
// indexed automatically. Runs before the SSG build (see package.json "build"). Every URL is
// built from SITE_URL (scripts/site.mjs) — the same origin the pages put in their canonical
// and og:url tags, so the three can never drift apart.
//
// Each page is emitted twice (English + Hindi) and every entry carries the full hreflang
// set, so Google sees the pair no matter which URL it crawls first.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { BASE, absoluteUrl } from "./site.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const examsDir = join(__dirname, "..", "src", "specs", "exams");
const publicDir = join(__dirname, "..", "public");

const today = new Date().toISOString().slice(0, 10);
/** path → lastmod (an ISO date). Later duplicates win only with a newer date. */
const pages = new Map([["/", today], ["/custom", today], ["/privacy", today]]);

for (const file of readdirSync(examsDir)) {
  if (!file.endsWith(".json")) continue;
  const data = JSON.parse(readFileSync(join(examsDir, file), "utf8"));
  // A file may hold a single exam object or an array.
  for (const raw of Array.isArray(data) ? data : [data]) {
    // Only verified AND listed exams are indexable (unverified placeholders and exams whose
    // application window isn't open yet, e.g. listed:false, stay out of the sitemap).
    if (raw.verified !== true || raw.listed === false) continue;
    const slug = raw.slug || raw.id;
    const lastmod = raw.lastVerified || today;
    pages.set(`/${slug}`, lastmod);
    pages.set(`/check/${slug}`, lastmod); // per-exam checker page
  }
}

// Mirrors localePath() in src/i18n/index.jsx — kept in sync by hand because this script
// runs in plain Node before Vite (and therefore before the JSX source is loadable).
const hiPath = (path) => (path === "/" ? "/hi" : `/hi${path}`);

const entry = (path, lastmod) => {
  const en = absoluteUrl(path);
  const hi = absoluteUrl(hiPath(path));
  return [
    `  <url>`,
    `    <loc>${en}</loc>`,
    `    <lastmod>${lastmod}</lastmod>`,
    `    <xhtml:link rel="alternate" hreflang="en-IN" href="${en}" />`,
    `    <xhtml:link rel="alternate" hreflang="hi-IN" href="${hi}" />`,
    `    <xhtml:link rel="alternate" hreflang="x-default" href="${en}" />`,
    `  </url>`,
    `  <url>`,
    `    <loc>${hi}</loc>`,
    `    <lastmod>${lastmod}</lastmod>`,
    `    <xhtml:link rel="alternate" hreflang="en-IN" href="${en}" />`,
    `    <xhtml:link rel="alternate" hreflang="hi-IN" href="${hi}" />`,
    `    <xhtml:link rel="alternate" hreflang="x-default" href="${en}" />`,
    `  </url>`,
  ].join("\n");
};

const urls = [...pages].map(([path, lastmod]) => entry(path, lastmod)).join("\n");
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls}\n</urlset>\n`;
writeFileSync(join(publicDir, "sitemap.xml"), sitemap);

// robots.txt has to repeat the Sitemap: URL, and it must be the one Search Console can fetch.
const robots = `User-agent: *
Allow: /

# API endpoints are never indexable.
Disallow: ${BASE}api/

Sitemap: ${absoluteUrl("/sitemap.xml")}
`;
writeFileSync(join(publicDir, "robots.txt"), robots);

console.log(`sitemap.xml written with ${pages.size * 2} URLs (en + hi) → ${absoluteUrl("/")}`);
