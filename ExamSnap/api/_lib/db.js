// Neon serverless Postgres client. The `neon()` tagged-template runs ONE parameterised
// statement per call over HTTP — ideal for short-lived Vercel functions. Interpolated values
// are always sent as bound parameters, never string-concatenated, so queries stay injection-safe.
import { neon } from "@neondatabase/serverless";

let _sql;

export function getSql() {
  if (!_sql) {
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
    _sql = neon(process.env.DATABASE_URL);
  }
  return _sql;
}
