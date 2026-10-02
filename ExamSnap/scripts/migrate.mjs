// Minimal SQL migration runner (no ORM). Applies api/_db/migrations/*.sql in filename order and
// records applied files in a _migrations table so each runs once. The Neon HTTP driver executes
// one statement per call, so we split each file on ';' (our DDL has no semicolons inside strings).
//
// Usage: DATABASE_URL=... node scripts/migrate.mjs
import { neon } from "@neondatabase/serverless";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dir = join(__dirname, "..", "api", "_db", "migrations");

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}
const sql = neon(url);

// The Neon HTTP driver only runs a query via its tagged-template form. This executes a plain
// SQL string (no interpolation) by handing it a synthetic TemplateStringsArray — one statement
// per call, which is why we split the file below.
function exec(text) {
  const parts = Object.assign([text], { raw: [text] });
  return sql(parts);
}

function statements(text) {
  return text
    // strip line comments so a stray ';' inside one can't split a statement
    .replace(/^\s*--.*$/gm, "")
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

async function run() {
  await sql`CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT now())`;
  const applied = new Set((await sql`SELECT name FROM _migrations`).map((r) => r.name));

  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    if (applied.has(file)) {
      console.log(`skip   ${file} (already applied)`);
      continue;
    }
    console.log(`apply  ${file}`);
    const text = readFileSync(join(dir, file), "utf8");
    for (const stmt of statements(text)) {
      await exec(stmt);
    }
    await sql`INSERT INTO _migrations (name) VALUES (${file})`;
  }
  console.log("migrations up to date");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
