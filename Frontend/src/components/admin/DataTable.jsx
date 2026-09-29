import { ChevronDown, ChevronUp, ChevronLeft, ChevronRight } from "lucide-react";
import { Spinner, EmptyState } from "./ui";

/**
 * Presentational table wired for server-side pagination + sorting. The parent
 * owns the data + query state and passes callbacks.
 *
 * columns: [{ key, label, sortable?, align?, render?(row) }]
 */
const DataTable = ({
  columns,
  rows = [],
  loading,
  sort,
  order,
  onSort,
  page = 1,
  pages = 1,
  total = 0,
  onPage,
  onRowClick,
}) => {
  const toggleSort = (key) => {
    if (!onSort) return;
    if (sort === key) onSort(key, order === "asc" ? "desc" : "asc");
    else onSort(key, "desc");
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50/60">
              {columns.map((c) => (
                <th
                  key={c.key}
                  onClick={() => c.sortable && toggleSort(c.key)}
                  className={`px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide ${
                    c.align === "right" ? "text-right" : "text-left"
                  } ${c.sortable ? "cursor-pointer select-none hover:text-slate-700" : ""}`}
                >
                  <span className="inline-flex items-center gap-1">
                    {c.label}
                    {c.sortable && sort === c.key ? (
                      order === "asc" ? (
                        <ChevronUp className="w-3 h-3" />
                      ) : (
                        <ChevronDown className="w-3 h-3" />
                      )
                    ) : null}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!loading &&
              rows.map((row, idx) => (
                <tr
                  key={row.id ?? idx}
                  onClick={() => onRowClick?.(row)}
                  className={`border-b border-gray-100 last:border-0 ${
                    onRowClick ? "cursor-pointer hover:bg-gray-50" : ""
                  }`}
                >
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      className={`px-4 py-3 text-slate-700 ${
                        c.align === "right" ? "text-right tabular-nums" : "text-left"
                      }`}
                    >
                      {c.render ? c.render(row) : row[c.key] ?? "—"}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {loading && <Spinner />}
      {!loading && rows.length === 0 && <EmptyState />}

      {!loading && rows.length > 0 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-xs text-gray-500">
          <span>
            Page {page} of {pages} · {total.toLocaleString()} total
          </span>
          <div className="flex items-center gap-1">
            <button
              disabled={page <= 1}
              onClick={() => onPage?.(page - 1)}
              className="p-1.5 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              disabled={page >= pages}
              onClick={() => onPage?.(page + 1)}
              className="p-1.5 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataTable;
