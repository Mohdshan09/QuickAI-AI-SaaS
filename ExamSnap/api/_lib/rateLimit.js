// Abuse rate limiting (spec §7.5): at most LIMIT writes per hashed IP per endpoint per hour.
// The IP is hashed with a secret salt and NEVER stored raw. Uses an atomic upsert on the
// rate_limits table so concurrent requests count correctly.
import crypto from "node:crypto";
import { getSql } from "./db.js";

const LIMIT = 20;
const WINDOW_MS = 60 * 60 * 1000; // 1 hour

/** @returns {Promise<boolean>} true if the request is within the limit. */
export async function checkRateLimit(ip, endpoint) {
  const salt = process.env.RATE_LIMIT_SALT || "";
  const key = crypto.createHash("sha256").update(`${ip}|${endpoint}|${salt}`).digest("hex");
  const windowStart = new Date(Math.floor(Date.now() / WINDOW_MS) * WINDOW_MS).toISOString();
  const sql = getSql();
  const rows = await sql`
    INSERT INTO rate_limits (key, window_start, count)
    VALUES (${key}, ${windowStart}, 1)
    ON CONFLICT (key, window_start)
    DO UPDATE SET count = rate_limits.count + 1
    RETURNING count`;
  return rows[0].count <= LIMIT;
}
