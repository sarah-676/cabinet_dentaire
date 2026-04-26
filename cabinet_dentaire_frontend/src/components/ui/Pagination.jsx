/**
 * src/components/ui/Pagination.jsx
 * Pagination réutilisable — Tailwind CSS
 */
import { memo } from "react";

function Pagination({ page, totalPages, onChange }) {
  if (!totalPages || totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-1 mt-4">
      <PagBtn onClick={() => onChange(page - 1)} disabled={page <= 1}>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </PagBtn>

      {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
        <PagBtn
          key={p}
          onClick={() => onChange(p)}
          active={p === page}
        >
          {p}
        </PagBtn>
      ))}

      <PagBtn onClick={() => onChange(page + 1)} disabled={page >= totalPages}>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </PagBtn>
    </div>
  );
}

function PagBtn({ children, onClick, disabled, active }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-medium transition-all
        ${active
          ? "bg-[#1aa3c8] text-white shadow-sm"
          : "text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
        }`}
    >
      {children}
    </button>
  );
}

export default memo(Pagination);