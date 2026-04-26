/**
 * src/components/ui/DataTable.jsx
 * ✅ Logique 100% conservée (columns, rows, keyField, loading, emptyText)
 * 🎨 UI redesignée — Tailwind CSS
 * ✨ Ajout : prop onRowClick pour rendre les lignes cliquables
 */
import { memo } from "react";
import PageState from "./PageState";

function DataTable({
  columns,
  rows,
  keyField = "id",
  loading = false,
  emptyText = "Aucune donnée.",
  onRowClick,          // nouveau : optionnel, (row) => void
}) {
  if (loading) return <PageState type="loading" />;
  if (!rows?.length) return <PageState type="empty" message={emptyText} />;

  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50/80">
            {columns.map((col) => (
              <th
                key={col.key}
                className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap"
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {rows.map((row) => (
            <tr
              key={row[keyField]}
              onClick={() => onRowClick?.(row)}
              className={`transition-colors ${
                onRowClick ? "cursor-pointer hover:bg-cyan-50/40" : "hover:bg-gray-50/60"
              }`}
            >
              {columns.map((col) => (
                <td
                  key={`${row[keyField]}-${col.key}`}
                  className="px-4 py-3 text-gray-800 align-top"
                >
                  {typeof col.render === "function" ? col.render(row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default memo(DataTable);