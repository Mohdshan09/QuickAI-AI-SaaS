import sql from "../../config/Neon.js";
import { parseList, paginated } from "../../lib/adminQuery.js";

// Whitelisted sort keys -> SQL expressions (guards against injection in raw SQL).
const SORT = {
  email: "u.email",
  plan: "u.plan",
  status: "u.status",
  created_at: "u.clerk_created_at",
  last_active: "u.last_active_at",
  requests: "requests",
  tokens: "tokens",
  cost: "cost",
};

// GET /api/admin/users?page&limit&sort&order&search&status&plan
export const listUsers = async (req, res) => {
  try {
    const { page, limit, offset, sort, order, search } = parseList(req.query, {
      sortable: Object.keys(SORT),
      defaultSort: "cost",
    });

    // Build WHERE + params.
    const conds = [];
    const params = [];
    let i = 1;
    if (req.query.status === "active" || req.query.status === "suspended") {
      conds.push(`u.status = $${i++}`);
      params.push(req.query.status);
    }
    if (req.query.plan === "free" || req.query.plan === "premium") {
      conds.push(`u.plan = $${i++}`);
      params.push(req.query.plan);
    }
    if (search) {
      conds.push(
        `(u.email ILIKE $${i} OR u.id = $${i + 1} OR (coalesce(u.first_name,'')||' '||coalesce(u.last_name,'')) ILIKE $${i})`
      );
      params.push(`%${search}%`, search);
      i += 2;
    }
    const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";

    const [{ total }] = await sql.query(
      `SELECT count(*)::int AS total FROM users u ${where}`,
      params
    );

    const rows = await sql.query(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.plan, u.status,
              u.clerk_created_at, u.last_active_at,
              count(r.id)::int                        AS requests,
              coalesce(sum(r.total_tokens), 0)::bigint AS tokens,
              coalesce(sum(r.total_cost), 0)          AS cost
       FROM users u LEFT JOIN ai_requests r ON r.user_id = u.id
       ${where}
       GROUP BY u.id
       ORDER BY ${SORT[sort]} ${order} NULLS LAST
       LIMIT $${i} OFFSET $${i + 1}`,
      [...params, limit, offset]
    );

    res.json({ success: true, ...paginated(rows, total, page, limit) });
  } catch (error) {
    console.error("listUsers failed", error);
    res.status(500).json({ success: false, message: "Failed to load users." });
  }
};

// GET /api/admin/users/:id — full usage profile for one user.
export const getUserProfile = async (req, res) => {
  try {
    const { id } = req.params;

    const [account] = await sql`SELECT * FROM users WHERE id = ${id}`;
    if (!account) return res.status(404).json({ success: false, message: "User not found." });

    const [usage] = await sql`
      SELECT
        count(*)::int                                    AS total_requests,
        count(*) FILTER (WHERE status = 'success')::int  AS successful,
        count(*) FILTER (WHERE status = 'error')::int    AS failed,
        coalesce(sum(input_tokens), 0)::bigint           AS input_tokens,
        coalesce(sum(output_tokens), 0)::bigint          AS output_tokens,
        coalesce(sum(total_tokens), 0)::bigint           AS total_tokens,
        coalesce(sum(total_cost), 0)                     AS total_cost,
        coalesce(sum(total_cost) FILTER (WHERE created_at >= now() - interval '7 days'), 0)  AS week_cost,
        coalesce(sum(total_cost) FILTER (WHERE created_at >= now() - interval '30 days'), 0) AS month_cost
      FROM ai_requests WHERE user_id = ${id}
    `;

    const services = await sql`
      SELECT service, count(*)::int AS requests,
             coalesce(sum(total_tokens), 0)::bigint AS tokens,
             coalesce(sum(total_cost), 0) AS cost
      FROM ai_requests WHERE user_id = ${id}
      GROUP BY service ORDER BY requests DESC
    `;

    const recent = await sql`
      SELECT id, service, provider, model, status, total_tokens, total_cost,
             duration_ms, created_at
      FROM ai_requests WHERE user_id = ${id}
      ORDER BY created_at DESC LIMIT 20
    `;

    res.json({
      success: true,
      account: {
        id: account.id,
        email: account.email,
        firstName: account.first_name,
        lastName: account.last_name,
        imageUrl: account.image_url,
        plan: account.plan,
        status: account.status,
        adminRole: account.admin_role,
        createdAt: account.clerk_created_at,
        lastActiveAt: account.last_active_at,
      },
      usage: {
        totalRequests: usage.total_requests,
        successful: usage.successful,
        failed: usage.failed,
        inputTokens: Number(usage.input_tokens),
        outputTokens: Number(usage.output_tokens),
        totalTokens: Number(usage.total_tokens),
      },
      cost: {
        total: Number(usage.total_cost),
        week: Number(usage.week_cost),
        month: Number(usage.month_cost),
      },
      services: services.map((s) => ({ ...s, tokens: Number(s.tokens), cost: Number(s.cost) })),
      recent,
    });
  } catch (error) {
    console.error("getUserProfile failed", error);
    res.status(500).json({ success: false, message: "Failed to load user profile." });
  }
};
