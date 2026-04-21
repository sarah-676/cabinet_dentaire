/**
 * src/components/patients/PatientCard.jsx
 * ─────────────────────────────────────────
 * Carte patient réutilisable.
 *
 * Props :
 *   patient       : objet PatientListSerializer
 *   onView        : (id) => void — voir le détail
 *   onEdit        : (patient) => void — ouvrir formulaire d'édition
 *   onDelete      : (id) => void — archiver
 *   onValider     : (id, decision) => void — accepter/refuser (dentiste)
 *   showActions   : bool (défaut true)
 *   showDentiste  : bool (défaut false) — afficher le dentiste_id
 */

import { useState } from "react";

const STATUT_CONFIG = {
  ACCEPTE: { label: "Actif",       bg: "#ecfdf5", color: "#059669" },
  PENDING: { label: "En attente",  bg: "#fffbeb", color: "#d97706" },
  REFUSE:  { label: "Refusé",      bg: "#fef2f2", color: "#dc2626" },
};

export default function PatientCard({
  patient,
  onView,
  onEdit,
  onDelete,
  onValider,
  showActions = true,
}) {
  const [validating, setValidating] = useState(false);
  const cfg = STATUT_CONFIG[patient.statut] || STATUT_CONFIG.ACCEPTE;

  const initials = `${patient.prenom?.[0] || ""}${patient.nom?.[0] || ""}`.toUpperCase();

  const handleValider = async (decision) => {
    if (!onValider) return;
    setValidating(true);
    try {
      await onValider(patient.id, decision);
    } finally {
      setValidating(false);
    }
  };

  return (
    <div style={styles.card}>
      {/* En-tête */}
      <div style={styles.header}>
        <div style={styles.avatar}>{initials}</div>
        <div style={styles.info}>
          <div style={styles.name}>{patient.nom_complet}</div>
          <div style={styles.meta}>
            {patient.sexe === "M" ? "♂" : patient.sexe === "F" ? "♀" : ""}
            {patient.sexe && patient.date_naissance ? " · " : ""}
            {patient.date_naissance}
            {patient.age ? ` (${patient.age} ans)` : ""}
          </div>
        </div>
        <span style={{ ...styles.badge, background: cfg.bg, color: cfg.color }}>
          {cfg.label}
        </span>
      </div>

      {/* Contact */}
      <div style={styles.contact}>
        {patient.telephone && (
          <span style={styles.contactItem}>📞 {patient.telephone}</span>
        )}
        {patient.email && (
          <span style={styles.contactItem}>✉ {patient.email}</span>
        )}
      </div>

      {/* Alertes critiques */}
      {patient.nb_alertes_critiques > 0 && (
        <div style={styles.alertBanner}>
          ⚠ {patient.nb_alertes_critiques} alerte{patient.nb_alertes_critiques > 1 ? "s" : ""} critique{patient.nb_alertes_critiques > 1 ? "s" : ""}
        </div>
      )}

      {/* Actions */}
      {showActions && (
        <div style={styles.actions}>
          {/* Boutons voir/éditer/supprimer */}
          <button onClick={() => onView?.(patient.id)} style={styles.btnView}>
            Voir
          </button>
          {onEdit && (
            <button onClick={() => onEdit?.(patient)} style={styles.btnEdit}>
              Modifier
            </button>
          )}
          {onDelete && (
            <button onClick={() => onDelete?.(patient.id)} style={styles.btnDelete}>
              Archiver
            </button>
          )}

          {/* Valider / Refuser si PENDING */}
          {patient.statut === "PENDING" && onValider && (
            <>
              <button
                onClick={() => handleValider("ACCEPTE")}
                disabled={validating}
                style={styles.btnAccept}
              >
                {validating ? "..." : "✓ Accepter"}
              </button>
              <button
                onClick={() => handleValider("REFUSE")}
                disabled={validating}
                style={styles.btnRefuse}
              >
                {validating ? "..." : "✗ Refuser"}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

const styles = {
  card: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "12px",
    padding: "1.25rem",
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
    transition: "box-shadow 0.15s",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
  },
  avatar: {
    width: "42px",
    height: "42px",
    borderRadius: "50%",
    background: "#0f4c81",
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    fontSize: "0.9rem",
    flexShrink: 0,
  },
  info: { flex: 1, minWidth: 0 },
  name: {
    fontWeight: 600,
    fontSize: "0.95rem",
    color: "#111827",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  meta: { fontSize: "0.78rem", color: "#6b7280", marginTop: "2px" },
  badge: {
    padding: "2px 8px",
    borderRadius: "12px",
    fontSize: "0.73rem",
    fontWeight: 600,
    flexShrink: 0,
  },
  contact: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
  contactItem: { fontSize: "0.8rem", color: "#6b7280" },
  alertBanner: {
    background: "#fef2f2",
    border: "1px solid #fecaca",
    borderRadius: "6px",
    padding: "0.4rem 0.75rem",
    fontSize: "0.8rem",
    color: "#dc2626",
    fontWeight: 500,
  },
  actions: {
    display: "flex",
    flexWrap: "wrap",
    gap: "0.4rem",
    marginTop: "0.25rem",
  },
  btnView: {
    padding: "0.35rem 0.8rem",
    background: "#eff6ff",
    color: "#1d4ed8",
    border: "1px solid #bfdbfe",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "0.8rem",
    fontWeight: 500,
  },
  btnEdit: {
    padding: "0.35rem 0.8rem",
    background: "#f9fafb",
    color: "#374151",
    border: "1px solid #d1d5db",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "0.8rem",
  },
  btnDelete: {
    padding: "0.35rem 0.8rem",
    background: "#fff7ed",
    color: "#c2410c",
    border: "1px solid #fed7aa",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "0.8rem",
  },
  btnAccept: {
    padding: "0.35rem 0.8rem",
    background: "#059669",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "0.8rem",
    fontWeight: 500,
  },
  btnRefuse: {
    padding: "0.35rem 0.8rem",
    background: "#dc2626",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "0.8rem",
    fontWeight: 500,
  },
};