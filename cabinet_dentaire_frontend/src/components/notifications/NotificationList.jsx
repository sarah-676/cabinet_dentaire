/**
 * components/notifications/NotificationList.jsx
 * ================================================
 * Page complète de notifications.
 * Compatible avec GET /notifications/?is_read=&type=
 *
 * Fonctionnalités :
 *   - Filtres : Toutes / Non lues / Lues
 *   - Filtre par type (PATIENT_EN_ATTENTE, RDV_CONFIRME, etc.)
 *   - Marquer lue / Supprimer sur chaque ligne
 *   - Bouton "Tout marquer lu"
 *   - Badge par niveau (INFO / SUCCES / ALERTE / CRITIQUE)
 */

import { useState } from "react";
import { useNotificationContext } from "../../context/NotificationContext";

// ─── Labels types (synchronisés avec TypeNotification backend) ─────────────
const TYPE_LABELS = {
  PATIENT_EN_ATTENTE: "Patient en attente",
  PATIENT_VALIDE:     "Patient accepté",
  PATIENT_REFUSE:     "Patient refusé",
  RDV_EN_ATTENTE:     "RDV en attente",
  RDV_VALIDE:         "RDV accepté",
  RDV_REFUSE:         "RDV refusé",
  RDV_ANNULE:         "RDV annulé",
  RDV_RAPPEL:         "Rappel RDV",
  SYSTEME:            "Système",
};

// ─── Styles par niveau ─────────────────────────────────────────────────────
const NIVEAU_CONFIG = {
  INFO:     { color: "#2563eb", bg: "#eff6ff",  label: "Info" },
  SUCCES:   { color: "#16a34a", bg: "#f0fdf4",  label: "Succès" },
  ALERTE:   { color: "#d97706", bg: "#fffbeb",  label: "Alerte" },
  CRITIQUE: { color: "#dc2626", bg: "#fef2f2",  label: "Critique" },
};

function timeAgo(dateString) {
  const diff = Math.floor((Date.now() - new Date(dateString)) / 1000);
  if (diff < 60)    return "à l'instant";
  if (diff < 3600)  return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`;
  return new Date(dateString).toLocaleDateString("fr-FR", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

// ===========================================================================

export default function NotificationList() {
  const [filtreStatut, setFiltreStatut] = useState("toutes");  // toutes | non_lues | lues
  const [filtreType,   setFiltreType]   = useState("");

  const {
    notifications,
    stats,
    loading,
    error,
    wsConnected,
    marquerLue,
    marquerToutesLues,
    supprimerNotification,
    refetch,
  } = useNotificationContext();

  // Filtrage côté frontend (la liste complète est déjà en mémoire)
  const filtered = notifications.filter((n) => {
    if (filtreStatut === "non_lues" && n.is_read)  return false;
    if (filtreStatut === "lues"     && !n.is_read) return false;
    if (filtreType && n.type !== filtreType)        return false;
    return true;
  });

  if (loading) {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "#9ca3af" }}>
        Chargement des notifications…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        margin: "24px",
        padding: "16px",
        background: "#fef2f2",
        border: "1px solid #fecaca",
        borderRadius: "8px",
        color: "#dc2626",
        fontSize: "14px",
      }}>
        {error}
        <button onClick={refetch} style={{
          marginLeft: "12px", color: "#dc2626",
          background: "none", border: "none", cursor: "pointer",
          textDecoration: "underline",
        }}>
          Réessayer
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: "24px", maxWidth: "800px", margin: "0 auto" }}>

      {/* ── En-tête ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
        <div>
          <h1 style={{ fontSize: "20px", fontWeight: 700, color: "#111827", margin: 0 }}>
            Notifications
          </h1>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" }}>
            <span style={{ fontSize: "13px", color: "#6b7280" }}>
              {stats.non_lues} non lue{stats.non_lues !== 1 ? "s" : ""} · {stats.total} au total
            </span>
            <span style={{
              fontSize: "11px",
              color: wsConnected ? "#16a34a" : "#9ca3af",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}>
              <span style={{
                width: "6px", height: "6px",
                borderRadius: "50%",
                background: wsConnected ? "#22c55e" : "#d1d5db",
                display: "inline-block",
              }} />
              {wsConnected ? "Temps réel" : "Polling"}
            </span>
          </div>
        </div>

        {stats.non_lues > 0 && (
          <button
            onClick={marquerToutesLues}
            style={{
              padding: "8px 16px",
              background: "#eff6ff",
              color: "#2563eb",
              border: "1px solid #bfdbfe",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "13px",
              fontWeight: 500,
            }}
          >
            ✓ Tout marquer lu
          </button>
        )}
      </div>

      {/* ── Filtres ── */}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "16px" }}>
        {/* Filtre statut */}
        {[
          { val: "toutes",   label: `Toutes (${stats.total})` },
          { val: "non_lues", label: `Non lues (${stats.non_lues})` },
          { val: "lues",     label: `Lues (${stats.lues})` },
        ].map(({ val, label }) => (
          <button
            key={val}
            onClick={() => setFiltreStatut(val)}
            style={{
              padding: "6px 14px",
              borderRadius: "20px",
              border: "1px solid",
              borderColor: filtreStatut === val ? "#2563eb" : "#e5e7eb",
              background: filtreStatut === val ? "#eff6ff" : "#fff",
              color: filtreStatut === val ? "#2563eb" : "#6b7280",
              fontSize: "13px",
              fontWeight: filtreStatut === val ? 600 : 400,
              cursor: "pointer",
            }}
          >
            {label}
          </button>
        ))}

        {/* Filtre type */}
        <select
          value={filtreType}
          onChange={(e) => setFiltreType(e.target.value)}
          style={{
            padding: "6px 12px",
            borderRadius: "20px",
            border: "1px solid #e5e7eb",
            background: filtreType ? "#f0fdf4" : "#fff",
            color: filtreType ? "#16a34a" : "#6b7280",
            fontSize: "13px",
            cursor: "pointer",
          }}
        >
          <option value="">Tous les types</option>
          {Object.entries(TYPE_LABELS).map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>
      </div>

      {/* ── Liste ── */}
      {filtered.length === 0 ? (
        <div style={{
          padding: "48px 24px",
          textAlign: "center",
          background: "#f9fafb",
          borderRadius: "12px",
          color: "#9ca3af",
          fontSize: "14px",
        }}>
          Aucune notification pour ce filtre
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          {filtered.map((notif) => {
            const niveau = NIVEAU_CONFIG[notif.niveau] || NIVEAU_CONFIG.INFO;
            return (
              <div
                key={notif.id}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "14px",
                  padding: "14px 16px",
                  background: notif.is_read ? "#fff" : niveau.bg,
                  borderRadius: "10px",
                  border: "1px solid",
                  borderColor: notif.is_read ? "#f3f4f6" : "#e5e7eb",
                  transition: "background 0.15s",
                }}
              >
                {/* Indicateur lu/non-lu */}
                <div style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  background: notif.is_read ? "#d1d5db" : niveau.color,
                  marginTop: "5px",
                  flexShrink: 0,
                }} />

                {/* Contenu */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "3px" }}>
                    <span style={{
                      fontSize: "13px",
                      fontWeight: notif.is_read ? 400 : 600,
                      color: "#111827",
                    }}>
                      {notif.titre}
                    </span>
                    {/* Badge type */}
                    <span style={{
                      fontSize: "10px",
                      fontWeight: 600,
                      background: "#f3f4f6",
                      color: "#6b7280",
                      borderRadius: "4px",
                      padding: "1px 6px",
                    }}>
                      {TYPE_LABELS[notif.type] || notif.type}
                    </span>
                    {/* Badge niveau */}
                    <span style={{
                      fontSize: "10px",
                      fontWeight: 600,
                      background: niveau.bg,
                      color: niveau.color,
                      borderRadius: "4px",
                      padding: "1px 6px",
                    }}>
                      {niveau.label}
                    </span>
                  </div>

                  <p style={{
                    fontSize: "13px",
                    color: "#6b7280",
                    margin: "0 0 6px",
                    lineHeight: 1.5,
                  }}>
                    {notif.message}
                  </p>

                  {/* Acteur + date */}
                  <div style={{ fontSize: "11px", color: "#9ca3af", display: "flex", gap: "10px" }}>
                    {notif.acteur_nom && <span>Par : {notif.acteur_nom}</span>}
                    {notif.patient_nom && <span>Patient : {notif.patient_nom}</span>}
                    <span>{timeAgo(notif.created_at)}</span>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                  {!notif.is_read && (
                    <button
                      onClick={() => marquerLue(notif.id)}
                      title="Marquer comme lue"
                      style={{
                        background: "#eff6ff",
                        border: "none",
                        borderRadius: "6px",
                        padding: "5px 8px",
                        cursor: "pointer",
                        color: "#2563eb",
                        fontSize: "12px",
                      }}
                    >
                      ✓
                    </button>
                  )}
                  <button
                    onClick={() => supprimerNotification(notif.id)}
                    title="Supprimer"
                    style={{
                      background: "#fef2f2",
                      border: "none",
                      borderRadius: "6px",
                      padding: "5px 8px",
                      cursor: "pointer",
                      color: "#dc2626",
                      fontSize: "12px",
                    }}
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}