/**
 * src/components/ui/Button.jsx
 * Composant bouton réutilisable — Tailwind CSS
 */
import { memo } from "react";

function Button({
  children,
  onClick,
  type = "button",
  variant = "primary",   // primary | secondary | danger | ghost | outline
  size = "md",           // sm | md | lg
  disabled = false,
  loading = false,
  icon,
  className = "",
  ...props
}) {
  const base =
    "inline-flex items-center justify-center gap-2 font-medium rounded-xl transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97]";

  const variants = {
    primary:
      "bg-gradient-to-r from-[#1aa3c8] to-[#0e8faf] text-white hover:opacity-90 shadow-sm focus:ring-[#1aa3c8]",
    secondary:
      "bg-gray-100 text-gray-700 hover:bg-gray-200 focus:ring-gray-300",
    danger:
      "bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 focus:ring-red-300",
    ghost:
      "bg-transparent text-gray-600 hover:bg-gray-100 focus:ring-gray-300",
    outline:
      "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 focus:ring-gray-300 shadow-sm",
  };

  const sizes = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2.5 text-sm",
    lg: "px-6 py-3 text-base",
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {loading ? (
        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      ) : icon ? (
        <span className="flex-shrink-0">{icon}</span>
      ) : null}
      {children}
    </button>
  );
}

export default memo(Button);