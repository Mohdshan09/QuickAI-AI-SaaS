import sql from "../config/Neon.js";

const PER_MINUTE = Number(process.env.RATE_LIMIT_PER_MINUTE) || 5;
const PER_DAY = Number(process.env.RATE_LIMIT_PER_DAY) || 50;
const GLOBAL_PER_DAY = Number(process.env.AI_GLOBAL_DAILY_LIMIT) || 1000;

// Atomically increment the counter for the current time window and return the new count
const hit = async (key, windowSeconds) => {
  const [row] = await sql`
    INSERT INTO usage_counters (key, window_start, count)
    VALUES (
      ${key},
      to_timestamp(floor(extract(epoch FROM now()) / ${windowSeconds}::int) * ${windowSeconds}::int),
      1
    )
    ON CONFLICT (key, window_start)
    DO UPDATE SET count = usage_counters.count + 1
    RETURNING count
  `;
  return row.count;
};

// Occasionally drop old windows so the table stays small
const cleanup = () =>
  sql`DELETE FROM usage_counters WHERE window_start < now() - interval '2 days'`.catch(
    (error) => console.error("usage_counters cleanup failed", error)
  );

export const aiRateLimit = async (req, res, next) => {
  try {
    const { userId } = req.auth();

    if (Math.random() < 0.01) cleanup();

    if ((await hit(`user:${userId}:min`, 60)) > PER_MINUTE) {
      return res.status(429).json({
        success: false,
        message: "Too many requests. Please wait a minute and try again.",
      });
    }

    if ((await hit(`user:${userId}:day`, 86400)) > PER_DAY) {
      return res.status(429).json({
        success: false,
        message: "Daily limit reached. Please try again tomorrow.",
      });
    }

    if ((await hit("global:day", 86400)) > GLOBAL_PER_DAY) {
      return res.status(503).json({
        success: false,
        message: "Service is busy right now. Please try again later.",
      });
    }

    next();
  } catch (error) {
    // Fail closed: never allow unlimited AI calls because the limiter is down
    console.error("Rate limiter failed", error);
    res.status(503).json({
      success: false,
      message: "Service is temporarily unavailable. Please try again later.",
    });
  }
};
