import sql from "../../config/Neon.js";
import { parseList, paginated, parseRange } from "../../lib/adminQuery.js";

const num = (v) => Number(v) || 0;

const SORT = {
  created_at: "r.created_at",
  cost: "r.total_cost",
  tokens: "r.total_tokens",
  duration: "r.duration_ms",
};

// GET /api/admin/ai/requests?page&limit&sort&order&service&model&status&userId&from&to
export const listRequests = async (req, res) => {
  try {
    const { page, limit, offset, sort, order } = parseList(req.query, {
      sortable: Object.keys(SORT),
      defaultSort: "created_at",
    });

    const conds = [];
    const params = [];
    let i = 1;
    const eq = (col, val) => {
      conds.push(`${col} = $${i++}`);
      params.push(val);
    };
    if (req.query.service) eq("r.service", req.query.service);
    if (req.query.model) eq("r.model", req.query.model);
    if (req.query.status === "success" || req.query.status === "error") eq("r.status", req.query.status);
    if (req.query.userId) eq("r.user_id", req.query.userId);
    if (req.query.from) {
      conds.push(`r.created_at >= $${i++}`);
      params.push(new Date(`${req.query.from}T00:00:00.000Z`));
    }
    if (req.query.to) {
      conds.push(`r.created_at <= $${i++}`);
      params.push(new Date(`${req.query.to}T23:59:59.999Z`));
    }
    const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";

    const [{ total }] = await sql.query(
      `SELECT count(*)::int AS total FROM ai_requests r ${where}`,
      params
    );

    const rows = await sql.query(
      `SELECT r.id, r.user_id, u.email, r.service, r.provider, r.model, r.status,
              r.total_tokens, r.total_cost, r.duration_ms, r.error_code, r.created_at
       FROM ai_requests r LEFT JOIN users u ON u.id = r.user_id
       ${where}
       ORDER BY ${SORT[sort]} ${order} NULLS LAST
       LIMIT $${i} OFFSET $${i + 1}`,
      [...params, limit, offset]
    );

    res.json({ success: true, ...paginated(rows, total, page, limit) });
  } catch (error) {
    console.error("listRequests failed", error);
    res.status(500).json({ success: false, message: "Failed to load AI requests." });
  }
};

// GET /api/admin/ai/requests/:id — metadata only; never prompts, responses or keys.
export const getRequest = async (req, res) => {
  try {
    const [row] = await sql`
      SELECT r.*, u.email
      FROM ai_requests r LEFT JOIN users u ON u.id = r.user_id
      WHERE r.id = ${req.params.id}
    `;
    if (!row) return res.status(404).json({ success: false, message: "Request not found." });
    res.json({ success: true, request: row });
  } catch (error) {
    console.error("getRequest failed", error);
    res.status(500).json({ success: false, message: "Failed to load request." });
  }
};

// GET /api/admin/ai/services — per-service aggregates.
export const getServices = async (_req, res) => {
  try {
    const rows = await sql`
      SELECT
        service,
        count(*)::int                                    AS requests,
        count(*) FILTER (WHERE status = 'success')::int  AS successful,
        count(*) FILTER (WHERE status = 'error')::int    AS failed,
        count(DISTINCT user_id)::int                     AS users,
        coalesce(sum(input_tokens), 0)::bigint           AS input_tokens,
        coalesce(sum(output_tokens), 0)::bigint          AS output_tokens,
        coalesce(sum(total_tokens), 0)::bigint           AS total_tokens,
        coalesce(sum(total_cost), 0)                     AS cost,
        coalesce(avg(duration_ms) FILTER (WHERE status = 'success'), 0) AS avg_latency
      FROM ai_requests GROUP BY service ORDER BY cost DESC
    `;
    res.json({
      success: true,
      services: rows.map((r) => ({
        service: r.service,
        requests: r.requests,
        successful: r.successful,
        failed: r.failed,
        users: r.users,
        inputTokens: num(r.input_tokens),
        outputTokens: num(r.output_tokens),
        totalTokens: num(r.total_tokens),
        cost: num(r.cost),
        avgCostPerRequest: r.requests > 0 ? num(r.cost) / r.requests : 0,
        avgLatencyMs: Math.round(num(r.avg_latency)),
      })),
    });
  } catch (error) {
    console.error("getServices failed", error);
    res.status(500).json({ success: false, message: "Failed to load services." });
  }
};

// GET /api/admin/ai/models — per provider+model aggregates.
export const getModels = async (_req, res) => {
  try {
    const rows = await sql`
      SELECT
        provider, model,
        count(*)::int                                    AS requests,
        count(*) FILTER (WHERE status = 'success')::int  AS successful,
        count(*) FILTER (WHERE status = 'error')::int    AS failed,
        coalesce(sum(input_tokens), 0)::bigint           AS input_tokens,
        coalesce(sum(output_tokens), 0)::bigint          AS output_tokens,
        coalesce(sum(total_tokens), 0)::bigint           AS total_tokens,
        coalesce(sum(total_cost), 0)                     AS cost,
        coalesce(avg(duration_ms) FILTER (WHERE status = 'success'), 0) AS avg_latency
      FROM ai_requests GROUP BY provider, model ORDER BY cost DESC
    `;
    res.json({
      success: true,
      models: rows.map((r) => ({
        provider: r.provider,
        model: r.model,
        requests: r.requests,
        successful: r.successful,
        failed: r.failed,
        inputTokens: num(r.input_tokens),
        outputTokens: num(r.output_tokens),
        totalTokens: num(r.total_tokens),
        cost: num(r.cost),
        avgCostPerRequest: r.requests > 0 ? num(r.cost) / r.requests : 0,
        avgLatencyMs: Math.round(num(r.avg_latency)),
      })),
    });
  } catch (error) {
    console.error("getModels failed", error);
    res.status(500).json({ success: false, message: "Failed to load models." });
  }
};

// GET /api/admin/ai/errors?groupBy=service|model|error_code&from&to
export const getErrors = async (req, res) => {
  try {
    const { from, to } = parseRange(req.query);
    const groupCol =
      { service: "service", model: "model", error_code: "error_code" }[req.query.groupBy] ||
      "error_code";

    const rows = await sql.query(
      `SELECT ${groupCol} AS group_key,
              count(*)::int AS count,
              count(DISTINCT user_id)::int AS affected_users,
              max(created_at) AS last_occurrence
       FROM ai_requests
       WHERE status = 'error' AND created_at >= $1 AND created_at <= $2
       GROUP BY ${groupCol} ORDER BY count DESC`,
      [from, to]
    );

    res.json({ success: true, groupBy: groupCol, errors: rows });
  } catch (error) {
    console.error("getErrors failed", error);
    res.status(500).json({ success: false, message: "Failed to load errors." });
  }
};
