/**
 * src/components/ui/Badge.jsx
 * Badge de statut réutilisable — Tailwind CSS
 */
import { memo } from "react";

function Badge({ children, variant = "default", className = "" }) {
  // variant: default | success | warning | danger | info | cyan | orange
  const variants = {
    default:  "bg-gray-100 text-gray-600",
    success:  "bg-green-50 text-green-700 border border-green-200",
    warning:  "bg-orange-50 text-orange-600 border border-orange-200",
    danger:   "bg-red-50 text-red-600 border border-red-200",
    info:     "bg-blue-50 text-blue-600 border border-blue-200",
    cyan:     "bg-cyan-50 text-cyan-700 border border-cyan-200",
    orange:   "bg-orange-50 text-orange-500 border border-orange-200",
    // statuts rendez-vous
    confirmé: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    annulé:   "bg-red-50 text-red-600 border border-red-200",
    attente:  "bg-orange-50 text-orange-600 border border-orange-200",
    // statuts patients
    actif:    "bg-emerald-50 text-emerald-700 border border-emerald-200",
    archivé:  "bg-gray-100 text-gray-500 border border-gray-200",
    // types demandes
    rdv:      "bg-cyan-50 text-cyan-700 border border-cyan-200",
    patient:  "bg-orange-50 text-orange-500 border border-orange-200",
  };

  const cls = variants[variant?.toLowerCase()] || variants.default;

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cls} ${className}`}
    >
      {children}
    </span>
  );
}

export default memo(Badge);