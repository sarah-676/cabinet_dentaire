/**
 * src/components/ui/PageToolbar.jsx
 * ✅ Logique 100% conservée (title, search, filters, addLabel, onAdd)
 * 🎨 UI redesignée — Tailwind CSS — style Lovable
 */
export default function PageToolbar({
  title,
  subtitle,
  searchValue,
  onSearchChange,
  searchPlaceholder = "Rechercher...",
  filters = [],
  addLabel,
  onAdd,
}) {
  return (
    <div className="flex flex-col gap-4 mb-6">
      {/* Titre + bouton Ajouter */}
      {(title || (addLabel && onAdd)) && (
        <div className="flex items-start justify-between gap-4">
          {title && (
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
              {subtitle && (
                <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>
              )}
            </div>
          )}
          {addLabel && onAdd && (
            <button
              onClick={onAdd}
              className="flex-shrink-0 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold shadow-sm hover:opacity-90 active:scale-[0.97] transition-all"
              style={{ background: "linear-gradient(135deg, #1aa3c8, #0e8faf)" }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              {addLabel}
            </button>
          )}
        </div>
      )}

      {/* Barre de recherche + filtres */}
      {(typeof searchValue === "string" || filters.length > 0) && (
        <div className="flex flex-wrap items-center gap-3">
          {typeof searchValue === "string" && typeof onSearchChange === "function" && (
            <div className="relative flex-1 min-w-[220px] max-w-md">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                  <circle cx="11" cy="11" r="8" />
                  <path strokeLinecap="round" d="M21 21l-4.35-4.35" />
                </svg>
              </span>
              <input
                value={searchValue}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full pl-10 pr-4 py-2.5 text-sm bg-white border border-gray-200 rounded-xl text-gray-800 placeholder-gray-400 outline-none focus:border-[#1aa3c8] focus:ring-2 focus:ring-[#1aa3c8]/10 transition shadow-sm"
              />
            </div>
          )}
          {filters.map((node, index) => (
            <div key={index}>{node}</div>
          ))}
        </div>
      )}
    </div>
  );
}