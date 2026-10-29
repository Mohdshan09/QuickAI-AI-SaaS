// Deploy-time step for subfolder hosting: move the whole build into dist/examsnap/ so every
// absolute asset URL the app emits (base '/examsnap/…') resolves when the static host serves
// dist at the domain root. This also puts the service worker at /examsnap/sw.js, matching its
// /examsnap/ scope. A root deployment (SITE_URL without a path) skips this entirely.
//
// Used only by `npm run build:vercel` (production). Local `npm run build` + `npm run dev`
// stay un-nested so `vite preview`/dev keep working with base '/examsnap/'.
import { readdirSync, mkdirSync, renameSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { BASE } from "./site.mjs";

const dist = join(dirname(fileURLToPath(import.meta.url)), "..", "dist");
// BASE is the source of truth ("/examsnap/" → folder "examsnap"); path segments are already
// URL-safe for a folder name.
const folder = BASE.split("/").filter(Boolean).join("/");
const nested = join(dist, folder);

// Root deployments (SITE_URL without a path, base "/") already sit at the domain root.
if (BASE === "/") {
  console.log("nest-dist: base is '/', dist already at the domain root — nothing to do.");
  process.exit(0);
}
if (!existsSync(dist)) {
  console.error("nest-dist: dist/ not found — run the build first.");
  process.exit(1);
}
if (existsSync(nested)) {
  console.log(`nest-dist: dist/${folder} already exists — nothing to do.`);
  process.exit(0);
}

// Move every top-level entry (except the target folder itself) into dist/<folder>/.
const entries = readdirSync(dist).filter((name) => name !== folder);
mkdirSync(nested, { recursive: true });
for (const name of entries) {
  renameSync(join(dist, name), join(nested, name));
}
console.log(`nest-dist: moved ${entries.length} entries into dist/${folder}/`);
