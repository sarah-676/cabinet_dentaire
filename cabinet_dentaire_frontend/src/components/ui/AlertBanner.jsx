/**
 * src/components/ui/AlertBanner.jsx
 * Bannière d'alerte réutilisable — Tailwind CSS
 */
import { memo } from "react";

function AlertBanner({ type = "info", message, onClose }) {
  const types = {
    info:    { bg: "bg-blue-50 border-blue-200",   text: "text-blue-700",   icon: "ℹ" },
    success: { bg: "bg-green-50 border-green-200", text: "text-green-700",  icon: "✓" },
    warning: { bg: "bg-orange-50 border-orange-200", text: "text-orange-700", icon: "⚠" },
    error:   { bg: "bg-red-50 border-red-200",     text: "text-red-700",    icon: "✕" },
  };
  const t = types[type] || types.info;

  return (
    <div className={`flex items-start gap-3 px-4 py-3 rounded-xl border ${t.bg} ${t.text} text-sm`}>
      <span className="font-bold flex-shrink-0">{t.icon}</span>
      <span className="flex-1">{message}</span>
      {onClose && (
        <button onClick={onClose} className="flex-shrink-0 opacity-60 hover:opacity-100 transition">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}

export default memo(AlertBanner);