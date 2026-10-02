// Deploy-time step: move the whole build into dist/examsnap/ so every absolute asset URL
// the app emits (base '/examsnap/…') resolves when the static host serves dist at the domain
// root. This also puts the service worker at /examsnap/sw.js, matching its /examsnap/ scope.
//
// Used only by `npm run build:vercel` (production). Local `npm run build` + `npm run dev`
// stay un-nested so `vite preview`/dev keep working with base '/examsnap/'.
import { readdirSync, mkdirSync, renameSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const dist = join(dirname(fileURLToPath(import.meta.url)), "..", "dist");
const nested = join(dist, "examsnap");

if (!existsSync(dist)) {
  console.error("nest-dist: dist/ not found — run the build first.");
  process.exit(1);
}
if (existsSync(nested)) {
  console.log("nest-dist: dist/examsnap already exists — nothing to do.");
  process.exit(0);
}

// Move every top-level entry (except the target folder itself) into dist/examsnap/.
const entries = readdirSync(dist).filter((name) => name !== "examsnap");
mkdirSync(nested, { recursive: true });
for (const name of entries) {
  renameSync(join(dist, name), join(nested, name));
}
console.log(`nest-dist: moved ${entries.length} entries into dist/examsnap/`);
