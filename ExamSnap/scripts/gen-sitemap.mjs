// Generate public/sitemap.xml from the exam specs so new exams are indexed automatically.
// Runs before the SSG build (see package.json "build"). Base URL is overridable via
// SITE_URL for different environments.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const examsDir = join(__dirname, "..", "src", "specs", "exams");
const base = (process.env.SITE_URL || "https://quickai.com/examsnap").replace(/\/$/, "");

const slugs = ["", "custom"]; // home + custom
for (const file of readdirSync(examsDir)) {
  if (!file.endsWith(".json")) continue;
  const data = JSON.parse(readFileSync(join(examsDir, file), "utf8"));
  // A file may hold a single exam object or an array (the catalog).
  for (const raw of Array.isArray(data) ? data : [data]) {
    const slug = raw.slug || raw.id;
    slugs.push(slug);
    slugs.push(`check/${slug}`); // Phase 2: per-exam checker page
  }
}
// De-dupe in case a catalog entry and a dedicated file share an id/slug.
const uniqueSlugs = [...new Set(slugs)];

const today = new Date().toISOString().slice(0, 10);
const urls = uniqueSlugs
  .map((s) => `  <url>\n    <loc>${base}/${s}</loc>\n    <lastmod>${today}</lastmod>\n  </url>`)
  .join("\n");

const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;

writeFileSync(join(__dirname, "..", "public", "sitemap.xml"), xml);
console.log(`sitemap.xml written with ${uniqueSlugs.length} URLs`);
