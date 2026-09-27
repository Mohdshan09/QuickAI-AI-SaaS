import sql from "../config/Neon.js";

/**
 * Gate a feature by plan. Premium users always pass. Free users are allowed
 * `freeLimit` total outputs of this kind, counted in job_outputs.
 *
 * planLimit("match", 3)  -> free users get 3 match checks, premium unlimited
 * planLimit("interview", 0) -> premium only (no count query needed)
 *
 * Requires `auth` to have run first (sets req.plan).
 */
export const planLimit = (kind, freeLimit) => async (req, res, next) => {
  try {
    if (req.plan === "premium") return next();

    if (freeLimit <= 0) {
      return res.status(403).json({
        success: false,
        message: "This feature is available on the premium plan. Upgrade to continue.",
      });
    }

    const { userId } = req.auth();
    const [{ count }] = await sql`
      SELECT count(*)::int AS count
      FROM job_outputs
      WHERE user_id = ${userId} AND kind = ${kind}
    `;

    if (count >= freeLimit) {
      return res.status(403).json({
        success: false,
        message: "Free plan limit reached. Upgrade for unlimited access.",
      });
    }

    next();
  } catch (error) {
    console.error("planLimit failed", error);
    res.status(503).json({
      success: false,
      message: "Service is temporarily unavailable. Please try again later.",
    });
  }
};
