// Shared helpers for admin list/analytics endpoints: safe parsing of
// pagination, sorting (column whitelist to keep raw SQL injection-proof),
// search and date ranges. Server-side pagination is mandatory (spec section 29).

const MAX_LIMIT = 100;

/**
 * Parse pagination + sort + search from a query string.
 * @param {object} query  req.query
 * @param {object} opts   { sortable: string[], defaultSort: string, maxLimit?: number }
 * @returns {{ page, limit, offset, sort, order, search }}
 *   `sort` is guaranteed to be one of `sortable`; `order` is 'ASC'|'DESC'.
 */
export const parseList = (query = {}, { sortable = [], defaultSort, maxLimit = MAX_LIMIT } = {}) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit, 10) || 25));
  const offset = (page - 1) * limit;
  const sort = sortable.includes(query.sort) ? query.sort : defaultSort;
  const order = String(query.order).toLowerCase() === "asc" ? "ASC" : "DESC";
  const search = (query.search || "").toString().trim().slice(0, 200) || null;
  return { page, limit, offset, sort, order, search };
};

const DAY = 86400000;

/**
 * Parse a date range from `range` (today|7d|30d|90d) or explicit from/to
 * (YYYY-MM-DD). Falls back to the last 30 days. `to` is end-of-day inclusive.
 * @returns {{ from: Date, to: Date, days: number }}
 */
export const parseRange = (query = {}) => {
  const now = new Date();
  const to = query.to ? new Date(`${query.to}T23:59:59.999Z`) : now;

  if (query.from) {
    const from = new Date(`${query.from}T00:00:00.000Z`);
    return { from, to, days: Math.max(1, Math.round((to - from) / DAY)) };
  }

  const map = { today: 1, "7d": 7, "30d": 30, "90d": 90 };
  const days = map[query.range] ?? 30;
  const from =
    query.range === "today"
      ? new Date(now.toISOString().slice(0, 10) + "T00:00:00.000Z")
      : new Date(now.getTime() - days * DAY);
  return { from, to, days };
};

/** Standard paginated envelope. */
export const paginated = (rows, total, page, limit) => ({
  rows,
  total: Number(total) || 0,
  page,
  limit,
  pages: Math.max(1, Math.ceil((Number(total) || 0) / limit)),
});
