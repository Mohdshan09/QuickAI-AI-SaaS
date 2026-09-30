import sql from "../../config/Neon.js";
import { parseRange } from "../../lib/adminQuery.js";

const div = (a, b) => (Number(b) > 0 ? Number(a) / Number(b) : 0);

// GET /api/admin/dashboard — overall system summary (KPI cards + top tables).
export const getDashboard = async (_req, res) => {
  try {
    const [users] = await sql`
      SELECT
        count(*)::int                                                              AS total,
        count(*) FILTER (WHERE status = 'suspended')::int                          AS suspended,
        count(*) FILTER (WHERE plan = 'premium')::int                              AS premium,
        count(*) FILTER (WHERE plan = 'free')::int                                 AS free,
        count(*) FILTER (WHERE clerk_created_at >= date_trunc('day', now()))::int  AS new_today,
        count(*) FILTER (WHERE clerk_created_at >= now() - interval '7 days')::int AS new_week,
        count(*) FILTER (WHERE clerk_created_at >= now() - interval '30 days')::int AS new_month,
        count(*) FILTER (WHERE last_active_at >= now() - interval '30 days')::int  AS active
      FROM users
    `;

    const [usage] = await sql`
      SELECT
        count(*)::int                                    AS total_requests,
        count(*) FILTER (WHERE status = 'success')::int  AS successful,
        count(*) FILTER (WHERE status = 'error')::int    AS failed,
        count(*) FILTER (WHERE status = 'refunded')::int AS refunded,
        coalesce(sum(total_tokens), 0)::bigint           AS total_tokens,
        coalesce(sum(input_tokens), 0)::bigint           AS input_tokens,
        coalesce(sum(output_tokens), 0)::bigint          AS output_tokens,
        coalesce(sum(credits_consumed), 0)::int          AS credits_consumed,
        count(DISTINCT user_id)::int                     AS unique_users
      FROM ai_requests
    `;

    const [cost] = await sql`
      SELECT
        coalesce(sum(total_cost), 0)                                                          AS total,
        coalesce(sum(total_cost) FILTER (WHERE created_at >= date_trunc('day', now())), 0)    AS today,
        coalesce(sum(total_cost) FILTER (WHERE created_at >= now() - interval '7 days'), 0)   AS week,
        coalesce(sum(total_cost) FILTER (WHERE created_at >= now() - interval '30 days'), 0)  AS month
      FROM ai_requests
    `;

    const topUsersByCost = await sql`
      SELECT r.user_id, u.email, count(*)::int AS requests,
             coalesce(sum(r.total_tokens), 0)::bigint AS tokens,
             coalesce(sum(r.total_cost), 0) AS cost
      FROM ai_requests r LEFT JOIN users u ON u.id = r.user_id
      GROUP BY r.user_id, u.email ORDER BY cost DESC LIMIT 10
    `;
    const topUsersByRequests = await sql`
      SELECT r.user_id, u.email, count(*)::int AS requests,
             coalesce(sum(r.total_cost), 0) AS cost
      FROM ai_requests r LEFT JOIN users u ON u.id = r.user_id
      GROUP BY r.user_id, u.email ORDER BY requests DESC LIMIT 10
    `;
    const topServicesByCost = await sql`
      SELECT service, count(*)::int AS requests, count(DISTINCT user_id)::int AS users,
             coalesce(sum(total_tokens), 0)::bigint AS tokens,
             coalesce(sum(total_cost), 0) AS cost
      FROM ai_requests GROUP BY service ORDER BY cost DESC LIMIT 10
    `;
    const topServicesByUsage = await sql`
      SELECT service, count(*)::int AS requests, count(DISTINCT user_id)::int AS users,
             coalesce(sum(total_cost), 0) AS cost
      FROM ai_requests GROUP BY service ORDER BY requests DESC LIMIT 10
    `;
    const mostExpensiveRequests = await sql`
      SELECT r.id, r.user_id, u.email, r.service, r.model,
             r.total_tokens, r.total_cost, r.created_at
      FROM ai_requests r LEFT JOIN users u ON u.id = r.user_id
      WHERE r.status = 'success'
      ORDER BY r.total_cost DESC LIMIT 10
    `;

    res.json({
      success: true,
      kpis: {
        users: {
          total: users.total,
          active: users.active,
          newToday: users.new_today,
          newWeek: users.new_week,
          newMonth: users.new_month,
          suspended: users.suspended,
          free: users.free,
          premium: users.premium,
        },
        usage: {
          totalRequests: usage.total_requests,
          successful: usage.successful,
          failed: usage.failed,
          refunded: usage.refunded,
          totalTokens: Number(usage.total_tokens),
          inputTokens: Number(usage.input_tokens),
          outputTokens: Number(usage.output_tokens),
          creditsConsumed: usage.credits_consumed,
          avgTokensPerRequest: div(usage.total_tokens, usage.total_requests),
          avgCreditsPerRequest: div(usage.credits_consumed, usage.total_requests),
          successRate: div(usage.successful, usage.total_requests),
        },
        cost: {
          total: Number(cost.total),
          today: Number(cost.today),
          week: Number(cost.week),
          month: Number(cost.month),
          avgPerRequest: div(cost.total, usage.total_requests),
          avgPerUser: div(cost.total, usage.unique_users),
        },
      },
      top: {
        usersByCost: topUsersByCost,
        usersByRequests: topUsersByRequests,
        servicesByCost: topServicesByCost,
        servicesByUsage: topServicesByUsage,
        expensiveRequests: mostExpensiveRequests,
      },
    });
  } catch (error) {
    console.error("getDashboard failed", error);
    res.status(500).json({ success: false, message: "Failed to load dashboard." });
  }
};

// GET /api/admin/usage/overview?range=today|7d|30d|90d&from&to
// Time series: requests (success/fail), tokens, cost per day, plus active users.
export const getUsageOverview = async (req, res) => {
  try {
    const { from, to } = parseRange(req.query);

    const series = await sql`
      SELECT
        date_trunc('day', created_at) AS day,
        count(*)::int                                   AS requests,
        count(*) FILTER (WHERE status = 'success')::int AS successful,
        count(*) FILTER (WHERE status = 'error')::int   AS failed,
        coalesce(sum(input_tokens), 0)::bigint          AS input_tokens,
        coalesce(sum(output_tokens), 0)::bigint         AS output_tokens,
        coalesce(sum(total_tokens), 0)::bigint          AS total_tokens,
        coalesce(sum(total_cost), 0)                    AS cost,
        count(DISTINCT user_id)::int                    AS active_users
      FROM ai_requests
      WHERE created_at >= ${from} AND created_at <= ${to}
      GROUP BY day ORDER BY day ASC
    `;

    const [activeUsers] = await sql`
      SELECT
        count(DISTINCT user_id) FILTER (WHERE created_at >= now() - interval '1 day')::int  AS dau,
        count(DISTINCT user_id) FILTER (WHERE created_at >= now() - interval '7 days')::int AS wau,
        count(DISTINCT user_id) FILTER (WHERE created_at >= now() - interval '30 days')::int AS mau
      FROM ai_requests
    `;

    res.json({
      success: true,
      series: series.map((r) => ({
        day: r.day,
        requests: r.requests,
        successful: r.successful,
        failed: r.failed,
        inputTokens: Number(r.input_tokens),
        outputTokens: Number(r.output_tokens),
        totalTokens: Number(r.total_tokens),
        cost: Number(r.cost),
        activeUsers: r.active_users,
      })),
      activeUsers,
    });
  } catch (error) {
    console.error("getUsageOverview failed", error);
    res.status(500).json({ success: false, message: "Failed to load usage overview." });
  }
};
