/**
 * components/ui/Spinner.jsx
 */
export function Spinner({ size = 24, color = "#2563eb" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      style={{ animation: "spin 0.7s linear infinite" }}
    >
      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
      <circle cx="12" cy="12" r="10" stroke="#e5e7eb" strokeWidth="3" />
      <path
        d="M12 2a10 10 0 0 1 10 10"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ===========================================================================

/**
 * components/ui/Badge.jsx
 * Variantes : success | warning | danger | info | neutral
 */
const BADGE_STYLES = {
  success: { bg: "#f0fdf4", color: "#16a34a", border: "#bbf7d0" },
  warning: { bg: "#fffbeb", color: "#d97706", border: "#fde68a" },
  danger:  { bg: "#fef2f2", color: "#dc2626", border: "#fecaca" },
  info:    { bg: "#eff6ff", color: "#2563eb", border: "#bfdbfe" },
  neutral: { bg: "#f9fafb", color: "#6b7280", border: "#e5e7eb" },
};

export function Badge({ children, variant = "neutral", style: extraStyle = {} }) {
  const s = BADGE_STYLES[variant] || BADGE_STYLES.neutral;
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      padding: "2px 8px",
      borderRadius: "12px",
      fontSize: "12px",
      fontWeight: 600,
      background: s.bg,
      color: s.color,
      border: `1px solid ${s.border}`,
      ...extraStyle,
    }}>
      {children}
    </span>
  );
}

// ===========================================================================

/**
 * components/ui/AlertBanner.jsx
 * Alerte médicale rouge/orange pour PatientDossier et PatientCard.
 * variant : "danger" | "warning" | "info"
 */
export function AlertBanner({ children, variant = "danger", onClose }) {
  const s = BADGE_STYLES[variant] || BADGE_STYLES.danger;
  const icons = { danger: "🔴", warning: "🟡", info: "🔵" };

  return (
    <div style={{
      display: "flex",
      alignItems: "flex-start",
      gap: "10px",
      padding: "12px 16px",
      background: s.bg,
      border: `1px solid ${s.border}`,
      borderRadius: "8px",
      color: s.color,
      fontSize: "13px",
      lineHeight: 1.5,
    }}>
      <span style={{ fontSize: "14px", flexShrink: 0 }}>{icons[variant]}</span>
      <span style={{ flex: 1 }}>{children}</span>
      {onClose && (
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: s.color,
            fontSize: "14px",
            padding: 0,
            flexShrink: 0,
          }}
        >
          ✕
        </button>
      )}
    </div>
  );
}