/**
 * pages/admin/DashboardAdmin.jsx
 * ================================
 * Tableau de bord administrateur.
 *
 * Données :
 *   GET /api/auth/users/stats/ → { total, admins, dentistes, receptionnistes, inactifs }
 *
 * Compatibilité backend :
 *   UserViewSet.stats() → IsAuthenticated + IsAdmin
 */

import React, { useEffect, useState, useCallback } from "react";
import { useNavigate }   from "react-router-dom";
import { getUserStats }  from "@/api/usersAPI";
import { useAuth }       from "@/hooks/useAuth";

// ── Styles partagés ───────────────────────────────────────────────────────────

const S = {
  page: {
    minHeight:       "100vh",
    backgroundColor: "#f8fafc",
    fontFamily:      "system-ui, -apple-system, sans-serif",
    padding:         "2rem",
  },
  header: {
    marginBottom: "2rem",
  },
  greeting: {
    fontSize:   "1.5rem",
    fontWeight: "700",
    color:      "#0f172a",
    margin:     0,
  },
  subtitle: {
    fontSize:    "0.9rem",
    color:       "#64748b",
    marginTop:   "0.25rem",
  },
  grid: {
    display:             "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
    gap:                 "1.25rem",
    marginBottom:        "2rem",
  },
  card: (color) => ({
    backgroundColor: "#fff",
    borderRadius:    "12px",
    padding:         "1.5rem",
    boxShadow:       "0 1px 3px rgba(0,0,0,0.07)",
    borderTop:       `4px solid ${color}`,
  }),
  cardValue: (color) => ({
    fontSize:   "2.25rem",
    fontWeight: "800",
    color,
    margin:     0,
    lineHeight: 1,
  }),
  cardLabel: {
    fontSize:   "0.85rem",
    color:      "#64748b",
    marginTop:  "0.4rem",
    fontWeight: "500",
  },
  section: {
    backgroundColor: "#fff",
    borderRadius:    "12px",
    padding:         "1.5rem",
    boxShadow:       "0 1px 3px rgba(0,0,0,0.07)",
    marginBottom:    "1.5rem",
  },
  sectionTitle: {
    fontSize:     "1rem",
    fontWeight:   "600",
    color:        "#1e293b",
    marginBottom: "1rem",
    margin:       "0 0 1rem 0",
  },
  actionGrid: {
    display:             "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
    gap:                 "0.75rem",
  },
  actionBtn: (color) => ({
    display:         "flex",
    flexDirection:   "column",
    alignItems:      "center",
    gap:             "0.5rem",
    padding:         "1.25rem 1rem",
    backgroundColor: `${color}15`,
    border:          `1.5px solid ${color}30`,
    borderRadius:    "10px",
    cursor:          "pointer",
    transition:      "all 0.15s",
    textDecoration:  "none",
    color:           color,
    fontWeight:      "600",
    fontSize:        "0.875rem",
    textAlign:       "center",
  }),
  actionIcon: {
    fontSize: "1.5rem",
  },
  error: {
    backgroundColor: "#fef2f2",
    border:          "1px solid #fecaca",
    borderRadius:    "8px",
    padding:         "0.75rem 1rem",
    color:           "#dc2626",
    fontSize:        "0.875rem",
    marginBottom:    "1rem",
  },
  spinner: {
    display:        "flex",
    justifyContent: "center",
    alignItems:     "center",
    minHeight:      "200px",
    color:          "#94a3b8",
    fontSize:       "0.9rem",
    gap:            "0.5rem",
  },
};

// ── Composant carte stat ──────────────────────────────────────────────────────

function StatCard({ label, value, color, icon }) {
  return (
    <div style={S.card(color)}>
      <p style={S.cardValue(color)}>
        {value ?? <span style={{ fontSize: "1.5rem" }}>—</span>}
      </p>
      <p style={S.cardLabel}>{icon} {label}</p>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DashboardAdmin() {
  const navigate          = useNavigate();
  const { user }          = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await getUserStats();
      setStats(data);
    } catch (err) {
      setError(
        err?.response?.data?.detail ??
        "Impossible de charger les statistiques."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  // ── Rendu ─────────────────────────────────────────────────────────

  return (
    <div style={S.page}>

      {/* En-tête */}
      <div style={S.header}>
        <h1 style={S.greeting}>
          Bonjour, {user?.first_name ?? "Admin"} 👋
        </h1>
        <p style={S.subtitle}>
          Tableau de bord administrateur — {new Date().toLocaleDateString("fr-FR", {
            weekday: "long", year: "numeric", month: "long", day: "numeric",
          })}
        </p>
      </div>

      {/* Erreur */}
      {error && (
        <div style={S.error}>
          ⚠ {error}
          <button
            onClick={fetchStats}
            style={{ marginLeft: "1rem", cursor: "pointer", background: "none",
              border: "none", color: "#dc2626", fontWeight: "600" }}
          >
            Réessayer
          </button>
        </div>
      )}

      {/* Stats */}
      {loading ? (
        <div style={S.spinner}>
          <span style={{ width: "20px", height: "20px", border: "2.5px solid #e2e8f0",
            borderTop: "2.5px solid #2563eb", borderRadius: "50%",
            animation: "spin 0.7s linear infinite", display: "inline-block" }} />
          Chargement...
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      ) : (
        <div style={S.grid}>
          <StatCard label="Utilisateurs actifs"   value={stats?.total}           color="#2563eb" icon="👥" />
          <StatCard label="Dentistes"              value={stats?.dentistes}        color="#059669" icon="🦷" />
          <StatCard label="Réceptionnistes"        value={stats?.receptionnistes}  color="#7c3aed" icon="🧾" />
          <StatCard label="Administrateurs"        value={stats?.admins}           color="#0891b2" icon="🔐" />
          <StatCard label="Comptes inactifs"       value={stats?.inactifs}         color="#dc2626" icon="🚫" />
        </div>
      )}

      {/* Actions rapides */}
      <div style={S.section}>
        <h2 style={S.sectionTitle}>Actions rapides</h2>
        <div style={S.actionGrid}>
          <button
            style={S.actionBtn("#2563eb")}
            onClick={() => navigate("/admin/utilisateurs")}
          >
            <span style={S.actionIcon}>👥</span>
            Gérer les utilisateurs
          </button>
          <button
            style={S.actionBtn("#059669")}
            onClick={() => navigate("/admin/utilisateurs?role=dentiste")}
          >
            <span style={S.actionIcon}>🦷</span>
            Voir les dentistes
          </button>
          <button
            style={S.actionBtn("#7c3aed")}
            onClick={() => navigate("/admin/utilisateurs?role=receptionniste")}
          >
            <span style={S.actionIcon}>🧾</span>
            Voir les réceptionnistes
          </button>
          <button
            style={S.actionBtn("#0891b2")}
            onClick={() => navigate("/admin/compte")}
          >
            <span style={S.actionIcon}>⚙️</span>
            Mon compte
          </button>
        </div>
      </div>

    </div>
  );
}