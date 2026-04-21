/**
 * components/patients/PatientCard.jsx
 * ======================================
 * Carte patient — affichée dans la liste (PatientListSerializer).
 *
 * Props :
 *   patient  {Object}   - PatientListSerializer
 *   onView   {Function} - clic "Voir le dossier"
 *   onEdit   {Function} - clic "Modifier" (dentiste/admin uniquement)
 *   onDelete {Function} - clic "Archiver" (dentiste/admin uniquement)
 *   onValider {Function}- clic "Valider" (dentiste, PENDING uniquement)
 *   canEdit   {boolean} - afficher les boutons d'action
 *   canValider {boolean}- afficher le bouton valider
 */

import React from "react";

// ── Constantes ────────────────────────────────────────────────────────────────

const STATUT_CONFIG = {
  ACCEPTE: { label: "Accepté",   bg: "#f0fdf4", color: "#166534", border: "#bbf7d0" },
  PENDING: { label: "En attente", bg: "#fffbeb", color: "#92400e", border: "#fde68a" },
  REFUSE:  { label: "Refusé",    bg: "#fef2f2", color: "#991b1b", border: "#fecaca" },
};

const ALERTE_COLORS = {
  CRITIQUE:      { bg: "#fef2f2", color: "#dc2626", border: "#fecaca" },
  AVERTISSEMENT: { bg: "#fffbeb", color: "#d97706", border: "#fde68a" },
  INFO:          { bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" },
};

const SEXE_ICON = { M: "♂", F: "♀" };

// ── Composant ─────────────────────────────────────────────────────────────────

export default function PatientCard({
  patient,
  onView,
  onEdit,
  onDelete,
  onValider,
  canEdit    = false,
  canValider = false,
}) {
  const statut = STATUT_CONFIG[patient.statut] ?? STATUT_CONFIG.ACCEPTE;

  const S = {
    card: {
      backgroundColor: "#fff",
      borderRadius:    "12px",
      padding:         "1.25rem",
      boxShadow:       "0 1px 3px rgba(0,0,0,0.07)",
      border:          "1.5px solid #f1f5f9",
      display:         "flex",
      flexDirection:   "column",
      gap:             "0.75rem",
      transition:      "box-shadow 0.15s",
      fontFamily:      "system-ui, sans-serif",
    },
    header: {
      display:        "flex",
      justifyContent: "space-between",
      alignItems:     "flex-start",
      gap:            "0.5rem",
    },
    avatar: {
      width:           "44px",
      height:          "44px",
      borderRadius:    "50%",
      backgroundColor: patient.sexe === "F" ? "#fdf2f8" : "#eff6ff",
      display:         "flex",
      alignItems:      "center",
      justifyContent:  "center",
      fontSize:        "1rem",
      fontWeight:      "700",
      color:           patient.sexe === "F" ? "#be185d" : "#1d4ed8",
      flexShrink:      0,
    },
    nameBlock: { flex: 1 },
    name: {
      fontSize:   "0.9375rem",
      fontWeight: "600",
      color:      "#0f172a",
      margin:     0,
    },
    meta: {
      fontSize:  "0.8125rem",
      color:     "#64748b",
      marginTop: "0.15rem",
    },
    statutBadge: {
      display:         "inline-block",
      padding:         "0.2rem 0.6rem",
      borderRadius:    "20px",
      fontSize:        "0.72rem",
      fontWeight:      "600",
      backgroundColor: statut.bg,
      color:           statut.color,
      border:          `1px solid ${statut.border}`,
      whiteSpace:      "nowrap",
    },
    alerteRow: {
      display:   "flex",
      flexWrap:  "wrap",
      gap:       "0.35rem",
    },
    alerteBadge: (niveau) => ({
      display:         "inline-block",
      padding:         "0.15rem 0.5rem",
      borderRadius:    "4px",
      fontSize:        "0.7rem",
      fontWeight:      "600",
      backgroundColor: ALERTE_COLORS[niveau]?.bg     ?? "#f1f5f9",
      color:           ALERTE_COLORS[niveau]?.color  ?? "#475569",
      border:          `1px solid ${ALERTE_COLORS[niveau]?.border ?? "#e2e8f0"}`,
    }),
    divider: {
      height:          "1px",
      backgroundColor: "#f1f5f9",
      margin:          "0 -1.25rem",
    },
    infoRow: {
      display: "flex",
      gap:     "1rem",
      flexWrap: "wrap",
    },
    infoItem: {
      fontSize: "0.8125rem",
      color:    "#475569",
    },
    infoLabel: {
      fontWeight: "500",
      color:      "#1e293b",
    },
    actions: {
      display:        "flex",
      gap:            "0.4rem",
      flexWrap:       "wrap",
      justifyContent: "flex-end",
    },
    btnView: {
      padding:         "0.45rem 0.875rem",
      backgroundColor: "#2563eb",
      color:           "#fff",
      border:          "none",
      borderRadius:    "6px",
      fontSize:        "0.8rem",
      fontWeight:      "500",
      cursor:          "pointer",
    },
    btnEdit: {
      padding:         "0.45rem 0.875rem",
      backgroundColor: "#f8fafc",
      color:           "#475569",
      border:          "1.5px solid #e2e8f0",
      borderRadius:    "6px",
      fontSize:        "0.8rem",
      fontWeight:      "500",
      cursor:          "pointer",
    },
    btnDelete: {
      padding:         "0.45rem 0.875rem",
      backgroundColor: "#fef2f2",
      color:           "#dc2626",
      border:          "1.5px solid #fecaca",
      borderRadius:    "6px",
      fontSize:        "0.8rem",
      fontWeight:      "500",
      cursor:          "pointer",
    },
    btnValider: {
      padding:         "0.45rem 0.875rem",
      backgroundColor: "#fffbeb",
      color:           "#92400e",
      border:          "1.5px solid #fde68a",
      borderRadius:    "6px",
      fontSize:        "0.8rem",
      fontWeight:      "600",
      cursor:          "pointer",
    },
  };

  const initials = `${patient.prenom?.[0] ?? ""}${patient.nom?.[0] ?? ""}`.toUpperCase();

  return (
    <div style={S.card}>

      {/* En-tête : avatar + nom + statut */}
      <div style={S.header}>
        <div style={S.avatar}>
          {SEXE_ICON[patient.sexe] ?? initials}
        </div>
        <div style={S.nameBlock}>
          <p style={S.name}>{patient.nom_complet}</p>
          <p style={S.meta}>
            {patient.age} ans
            {patient.sexe && ` · ${patient.sexe === "M" ? "Masculin" : "Féminin"}`}
          </p>
        </div>
        <span style={S.statutBadge}>{statut.label}</span>
      </div>

      {/* Alertes médicales */}
      {patient.nb_alertes_critiques > 0 && (
        <div style={S.alerteRow}>
          <span style={S.alerteBadge("CRITIQUE")}>
            ⚠ {patient.nb_alertes_critiques} alerte{patient.nb_alertes_critiques > 1 ? "s" : ""} critique{patient.nb_alertes_critiques > 1 ? "s" : ""}
          </span>
        </div>
      )}

      <div style={S.divider} />

      {/* Infos rapides */}
      <div style={S.infoRow}>
        <span style={S.infoItem}>
          📱 <span style={S.infoLabel}>{patient.telephone}</span>
        </span>
        {patient.groupe_sanguin && patient.groupe_sanguin !== "INCONNU" && (
          <span style={S.infoItem}>
            🩸 <span style={S.infoLabel}>{patient.groupe_sanguin}</span>
          </span>
        )}
        <span style={S.infoItem}>
          📅 <span style={S.infoLabel}>
            {new Date(patient.date_naissance).toLocaleDateString("fr-FR")}
          </span>
        </span>
      </div>

      <div style={S.divider} />

      {/* Actions */}
      <div style={S.actions}>
        {/* Valider — dentiste, patient PENDING */}
        {canValider && patient.statut === "PENDING" && onValider && (
          <button style={S.btnValider} onClick={() => onValider(patient)}>
            ✅ Valider
          </button>
        )}

        {/* Modifier */}
        {canEdit && onEdit && (
          <button style={S.btnEdit} onClick={() => onEdit(patient)}>
            ✏️ Modifier
          </button>
        )}

        {/* Voir dossier */}
        {onView && (
          <button style={S.btnView} onClick={() => onView(patient)}>
            📁 Dossier
          </button>
        )}

        {/* Archiver */}
        {canEdit && onDelete && (
          <button style={S.btnDelete} onClick={() => onDelete(patient)}>
            🗑
          </button>
        )}
      </div>

    </div>
  );
}