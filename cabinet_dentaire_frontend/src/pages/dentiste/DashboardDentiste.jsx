/**
 * src/pages/dentiste/DashboardDentiste.jsx
 * ─────────────────────────────────────────
 * Tableau de bord du dentiste :
 *  - Statistiques patients (total, actifs, en attente, nouveaux ce mois)
 *  - Statistiques RDV (aujourd'hui, cette semaine)
 *  - Patients en attente de validation (avec boutons Accepter/Refuser)
 *  - RDV du jour
 */

import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { getPatientStats, validerPatient, getPatients } from "../../api/patientsAPI";
import { getRendezVousStats, getRendezVous } from "../../api/rendezvousAPI";
import { useNotifications } from "../../context/NotificationContext";

// ── Composant carte stat ──────────────────────────────────────────────────────

function StatCard({ label, value, color = "#0f4c81", bg = "#e8f4fd" }) {
  return (
    <div style={{ ...styles.statCard, background: bg }}>
      <div style={{ ...styles.statValue, color }}>{value ?? "—"}</div>
      <div style={styles.statLabel}>{label}</div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DashboardDentiste() {
  const navigate               = useNavigate();
  const { fetchStats: fetchNotifStats } = useNotifications();

  const [patientStats, setPatientStats] = useState(null);
  const [rdvStats,     setRdvStats]     = useState(null);
  const [pending,      setPending]      = useState([]);
  const [rdvAujourd,   setRdvAujourd]   = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [validating,   setValidating]   = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ps, rs, pendingData, rdvData] = await Promise.all([
        getPatientStats(),
        getRendezVousStats(),
        getPatients({ statut: "PENDING" }),
        getRendezVous({ today: true }),
      ]);
      setPatientStats(ps);
      setRdvStats(rs);
      setPending(pendingData.results || pendingData);
      setRdvAujourd(rdvData.results || rdvData);
    } catch (err) {
      console.error("Dashboard load error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Valider un patient ────────────────────────────────────────────

  const handleValider = async (id, decision) => {
    setValidating((v) => ({ ...v, [id]: true }));
    try {
      await validerPatient(id, decision);
      await load();
      await fetchNotifStats();
    } catch (err) {
      alert(err.response?.data?.detail || "Erreur lors de la validation");
    } finally {
      setValidating((v) => ({ ...v, [id]: false }));
    }
  };

  if (loading) return <div style={styles.loading}>Chargement...</div>;

  return (
    <div style={styles.page}>

      {/* ── Stats patients ── */}
      <section style={styles.section}>
        <h3 style={styles.sectionTitle}>Mes patients</h3>
        <div style={styles.statsGrid}>
          <StatCard label="Total"          value={patientStats?.total}            color="#0f4c81" bg="#e8f4fd" />
          <StatCard label="Actifs"         value={patientStats?.actifs}           color="#059669" bg="#ecfdf5" />
          <StatCard label="En attente"     value={patientStats?.en_attente}       color="#d97706" bg="#fffbeb" />
          <StatCard label="Nouveaux / mois"value={patientStats?.nouveaux_ce_mois} color="#7c3aed" bg="#f5f3ff" />
          <StatCard label="Avec alertes"   value={patientStats?.avec_alertes}     color="#dc2626" bg="#fef2f2" />
          <StatCard label="Mineurs"        value={patientStats?.mineurs}          color="#0891b2" bg="#ecfeff" />
        </div>
      </section>

      {/* ── Stats RDV ── */}
      {rdvStats && (
        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>Rendez-vous</h3>
          <div style={styles.statsGrid}>
            <StatCard label="Aujourd'hui"     value={rdvStats.aujourd_hui}  color="#0f4c81" bg="#e8f4fd" />
            <StatCard label="Cette semaine"   value={rdvStats.cette_semaine} color="#059669" bg="#ecfdf5" />
            <StatCard label="En attente val." value={rdvStats.en_attente}   color="#d97706" bg="#fffbeb" />
            <StatCard label="Total"           value={rdvStats.total}         color="#6b7280" bg="#f9fafb" />
          </div>
        </section>
      )}

      {/* ── Patients en attente de validation ── */}
      {pending.length > 0 && (
        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>
            Patients en attente de validation
            <span style={styles.badge}>{pending.length}</span>
          </h3>
          <div style={styles.pendingList}>
            {pending.map((p) => (
              <div key={p.id} style={styles.pendingCard}>
                <div style={styles.pendingInfo}>
                  <strong>{p.nom_complet}</strong>
                  <span style={styles.pendingMeta}>
                    {p.age} ans · {p.telephone}
                  </span>
                </div>
                <div style={styles.pendingActions}>
                  <button
                    onClick={() => handleValider(p.id, "ACCEPTE")}
                    disabled={validating[p.id]}
                    style={styles.acceptBtn}
                  >
                    {validating[p.id] ? "..." : "✓ Accepter"}
                  </button>
                  <button
                    onClick={() => handleValider(p.id, "REFUSE")}
                    disabled={validating[p.id]}
                    style={styles.refuseBtn}
                  >
                    {validating[p.id] ? "..." : "✗ Refuser"}
                  </button>
                  <button
                    onClick={() => navigate(`/dentiste/patients/${p.id}`)}
                    style={styles.viewBtn}
                  >
                    Voir
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── RDV du jour ── */}
      <section style={styles.section}>
        <h3 style={styles.sectionTitle}>Rendez-vous du jour</h3>
        {rdvAujourd.length === 0 ? (
          <p style={styles.empty}>Aucun rendez-vous aujourd'hui.</p>
        ) : (
          <div style={styles.rdvList}>
            {rdvAujourd.map((rdv) => (
              <div key={rdv.id} style={styles.rdvCard}>
                <div style={styles.rdvHour}>{rdv.heure || "—"}</div>
                <div>
                  <strong>{rdv.patient_nom}</strong>
                  <div style={styles.rdvMeta}>{rdv.motif || "Consultation"}</div>
                </div>
                <span style={{
                  ...styles.rdvStatus,
                  background: rdv.statut === "CONFIRME" ? "#ecfdf5" : "#fffbeb",
                  color:      rdv.statut === "CONFIRME" ? "#059669" : "#d97706",
                }}>
                  {rdv.statut}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

    </div>
  );
}

const styles = {
  page: { display: "flex", flexDirection: "column", gap: "2rem" },
  loading: { padding: "2rem", color: "#6b7280" },
  section: {},
  sectionTitle: {
    fontSize: "1rem", fontWeight: 600, color: "#111827",
    marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
    gap: "1rem",
  },
  statCard: {
    borderRadius: "12px", padding: "1.25rem 1rem", textAlign: "center",
  },
  statValue: { fontSize: "1.75rem", fontWeight: 700, marginBottom: "0.25rem" },
  statLabel: { fontSize: "0.8rem", color: "#6b7280", fontWeight: 500 },
  badge: {
    background: "#fef3c7", color: "#92400e",
    borderRadius: "12px", padding: "2px 8px", fontSize: "0.8rem", fontWeight: 600,
  },
  pendingList: { display: "flex", flexDirection: "column", gap: "0.75rem" },
  pendingCard: {
    background: "#ffffff", border: "1px solid #fed7aa",
    borderRadius: "10px", padding: "1rem 1.25rem",
    display: "flex", alignItems: "center", justifyContent: "space-between",
    gap: "1rem", flexWrap: "wrap",
  },
  pendingInfo: { display: "flex", flexDirection: "column", gap: "2px" },
  pendingMeta: { fontSize: "0.8rem", color: "#6b7280" },
  pendingActions: { display: "flex", gap: "0.5rem", flexWrap: "wrap" },
  acceptBtn: {
    padding: "0.4rem 0.9rem", background: "#059669", color: "#fff",
    border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "0.85rem",
  },
  refuseBtn: {
    padding: "0.4rem 0.9rem", background: "#dc2626", color: "#fff",
    border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "0.85rem",
  },
  viewBtn: {
    padding: "0.4rem 0.9rem", background: "#f3f4f6", color: "#374151",
    border: "1px solid #d1d5db", borderRadius: "6px", cursor: "pointer", fontSize: "0.85rem",
  },
  rdvList: { display: "flex", flexDirection: "column", gap: "0.6rem" },
  rdvCard: {
    background: "#ffffff", border: "1px solid #e5e7eb",
    borderRadius: "10px", padding: "0.875rem 1.25rem",
    display: "flex", alignItems: "center", gap: "1rem",
  },
  rdvHour: { fontSize: "0.85rem", fontWeight: 700, color: "#0f4c81", minWidth: "48px" },
  rdvMeta: { fontSize: "0.8rem", color: "#6b7280", marginTop: "2px" },
  rdvStatus: {
    marginLeft: "auto", padding: "3px 10px",
    borderRadius: "12px", fontSize: "0.75rem", fontWeight: 600,
  },
  empty: { color: "#6b7280", fontSize: "0.9rem" },
};