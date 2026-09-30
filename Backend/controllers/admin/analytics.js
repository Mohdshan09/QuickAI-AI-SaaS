import sql from "../../config/Neon.js";
import { parseRange } from "../../lib/adminQuery.js";

// GET /api/admin/costs?by=day|user|service|model|provider&from&to&range
// Cost breakdown along one dimension, within a date range.
export const getCosts = async (req, res) => {
  try {
    const { from, to } = parseRange(req.query);
    const by = req.query.by || "day";

    let rows;
    if (by === "user") {
      rows = await sql`
        SELECT r.user_id AS key, u.email AS label, count(*)::int AS requests,
               coalesce(sum(r.total_tokens), 0)::bigint AS tokens,
               coalesce(sum(r.total_cost), 0) AS cost,
               coalesce(sum(r.credits_consumed), 0)::int AS credits
        FROM ai_requests r LEFT JOIN users u ON u.id = r.user_id
        WHERE r.created_at >= ${from} AND r.created_at <= ${to}
        GROUP BY r.user_id, u.email ORDER BY cost DESC LIMIT 50
      `;
    } else if (by === "service") {
      rows = await sql`
        SELECT service AS key, service AS label, count(*)::int AS requests,
               coalesce(sum(total_tokens), 0)::bigint AS tokens,
               coalesce(sum(total_cost), 0) AS cost,
               coalesce(sum(credits_consumed), 0)::int AS credits
        FROM ai_requests
        WHERE created_at >= ${from} AND created_at <= ${to}
        GROUP BY service ORDER BY cost DESC
      `;
    } else if (by === "model") {
      rows = await sql`
        SELECT (provider || ' / ' || coalesce(model, '—')) AS key,
               (provider || ' / ' || coalesce(model, '—')) AS label, count(*)::int AS requests,
               coalesce(sum(total_tokens), 0)::bigint AS tokens,
               coalesce(sum(total_cost), 0) AS cost,
               coalesce(sum(credits_consumed), 0)::int AS credits
        FROM ai_requests
        WHERE created_at >= ${from} AND created_at <= ${to}
        GROUP BY provider, model ORDER BY cost DESC
      `;
    } else if (by === "provider") {
      rows = await sql`
        SELECT provider AS key, provider AS label, count(*)::int AS requests,
               coalesce(sum(total_tokens), 0)::bigint AS tokens,
               coalesce(sum(total_cost), 0) AS cost,
               coalesce(sum(credits_consumed), 0)::int AS credits
        FROM ai_requests
        WHERE created_at >= ${from} AND created_at <= ${to}
        GROUP BY provider ORDER BY cost DESC
      `;
    } else {
      // by day (time series)
      rows = await sql`
        SELECT date_trunc('day', created_at) AS key,
               date_trunc('day', created_at) AS label, count(*)::int AS requests,
               coalesce(sum(total_tokens), 0)::bigint AS tokens,
               coalesce(sum(total_cost), 0) AS cost,
               coalesce(sum(credits_consumed), 0)::int AS credits
        FROM ai_requests
        WHERE created_at >= ${from} AND created_at <= ${to}
        GROUP BY 1 ORDER BY 1 ASC
      `;
    }

    res.json({
      success: true,
      by,
      rows: rows.map((r) => ({
        ...r,
        tokens: Number(r.tokens),
        cost: Number(r.cost),
        credits: Number(r.credits),
      })),
    });
  } catch (error) {
    console.error("getCosts failed", error);
    res.status(500).json({ success: false, message: "Failed to load cost analytics." });
  }
};
