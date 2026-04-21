/**
 * src/pages/receptionniste/DashboardReceptionniste.jsx
 * ──────────────────────────────────────────────────────
 * Tableau de bord réceptionniste.
 *
 * Affiche :
 *   - Stats globales (tous les patients, tous les RDV)
 *   - Planning du jour (RDV d'aujourd'hui)
 *   - Patients en attente de validation
 */

import { useEffect, useState } from "react";
import { useNavigate }       from "react-router-dom";
import { useDashboard }      from "../../hooks/useDashboard";
import { getPatients }       from "../../api/patientsAPI";
import { getRendezVous }     from "../../api/rendezvousAPI";

function StatCard({ label, value, color = "#0f4c81", bg = "#e8f4fd", sub }) {
  return (
    <div style={{ ...S.statCard, background: bg }}>
      <div style={{ ...S.statValue, color }}>{value ?? "—"}</div>
      <div style={S.statLabel}>{label}</div>
      {sub && <div style={S.statSub}>{sub}</div>}
    </div>
  );
}

export default function DashboardReceptionniste() {
  const navigate = useNavigate();
  const { patientStats, rdvStats, loading } = useDashboard();

  const [rdvDuJour,  setRdvDuJour]  = useState([]);
  const [pending,    setPending]    = useState([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getRendezVous({ aujourd_hui: "true" }),
      getPatients({ statut: "PENDING" }),
    ])
      .then(([rdv, pat]) => {
        setRdvDuJour(rdv.results ?? rdv);
        setPending(pat.results ?? pat);
      })
      .catch(() => {})
      .finally(() => setDataLoading(false));
  }, []);

  const formatHeure = (dt) => {
    if (!dt) return "—";
    try { return new Date(dt).toLocaleTimeString("fr-DZ", { hour: "2-digit", minute: "2-digit" }); }
    catch { return dt; }
  };

  const statutColor = {
    ACCEPTE: { bg: "#ecfdf5", color: "#059669", label: "Confirmé" },
    PENDING: { bg: "#fffbeb", color: "#d97706", label: "En attente" },
    REFUSE:  { bg: "#fef2f2", color: "#dc2626", label: "Refusé" },
    ANNULE:  { bg: "#f3f4f6", color: "#6b7280", label: "Annulé" },
  };

  return (
    <div style={S.page}>
      <div>
        <h1 style={S.title}>Accueil — Réception</h1>
        <p style={S.sub}>Gérez les patients et rendez-vous du cabinet</p>
      </div>

      {/* Bouton rapide */}
      <div>
        <button onClick={() => navigate("/receptionniste/patients")} style={S.btnAdd}>
          + Nouveau patient
        </button>
      </div>

      {/* Stats */}
      <div style={S.statsGrid}>
        <StatCard label="Total patients"   value={patientStats?.total}          color="#0f4c81" bg="#e8f4fd" />
        <StatCard label="RDV aujourd'hui"  value={rdvStats?.aujourd_hui}        color="#059669" bg="#ecfdf5" />
        <StatCard label="En attente"       value={patientStats?.en_attente}     color="#d97706" bg="#fffbeb" />
        <StatCard label="Nouveaux ce mois" value={patientStats?.nouveaux_ce_mois} color="#7c3aed" bg="#f5f3ff" />
      </div>

      <div style={S.twoCol}>
        {/* Planning du jour */}
        <section style={S.card}>
          <h3 style={S.cardTitle}>Planning du jour</h3>
          {dataLoading ? (
            <p style={S.empty}>Chargement...</p>
          ) : rdvDuJour.length === 0 ? (
            <p style={S.empty}>Aucun rendez-vous aujourd'hui.</p>
          ) : (
            rdvDuJour.map((rdv) => {
              const sc = statutColor[rdv.statut] || { bg: "#f3f4f6", color: "#374151", label: rdv.statut };
              return (
                <div key={rdv.id} style={S.rdvRow}>
                  <span style={S.rdvTime}>{formatHeure(rdv.date_heure)}</span>
                  <div style={S.rdvMid}>
                    <span style={S.rdvName}>{rdv.patient_nom || rdv.patient?.nom_complet || "—"}</span>
                    <span style={S.rdvSoin}>{rdv.type_soin}</span>
                  </div>
                  <span style={{ padding: "2px 8px", borderRadius: "12px", fontSize: "0.73rem", fontWeight: 600, background: sc.bg, color: sc.color }}>
                    {sc.label}
                  </span>
                </div>
              );
            })
          )}
        </section>

        {/* Patients en attente */}
        <section style={S.card}>
          <h3 style={S.cardTitle}>Patients en attente de validation</h3>
          {dataLoading ? (
            <p style={S.empty}>Chargement...</p>
          ) : pending.length === 0 ? (
            <p style={S.empty}>Aucune demande en attente.</p>
          ) : (
            pending.map((p) => (
              <div key={p.id} style={S.pendingRow}>
                <div>
                  <div style={S.pendingName}>{p.nom_complet}</div>
                  <div style={S.pendingMeta}>{p.telephone}</div>
                </div>
                <span style={{ padding: "2px 8px", borderRadius: "12px", fontSize: "0.73rem", fontWeight: 600, background: "#fffbeb", color: "#d97706" }}>
                  En attente
                </span>
              </div>
            ))
          )}
        </section>
      </div>
    </div>
  );
}

const S = {
  page:     { display: "flex", flexDirection: "column", gap: "1.75rem" },
  title:    { fontSize: "1.6rem", fontWeight: 700, color: "#111827", margin: 0 },
  sub:      { color: "#6b7280", fontSize: "0.9rem", marginTop: "4px" },
  btnAdd:   { padding: "0.65rem 1.25rem", background: "#0f4c81", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "0.9rem", fontWeight: 600 },
  statsGrid:{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "0.875rem" },
  statCard: { borderRadius: "12px", padding: "1.1rem 1rem", textAlign: "center" },
  statValue:{ fontSize: "1.75rem", fontWeight: 700, marginBottom: "0.2rem" },
  statLabel:{ fontSize: "0.78rem", color: "#6b7280", fontWeight: 500 },
  statSub:  { fontSize: "0.73rem", color: "#9ca3af", marginTop: "2px" },
  twoCol:   { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" },
  card:     { background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "1.25rem", display: "flex", flexDirection: "column", gap: "0.6rem" },
  cardTitle:{ fontSize: "0.95rem", fontWeight: 600, color: "#111827", marginBottom: "0.25rem" },
  empty:    { color: "#6b7280", fontSize: "0.85rem" },
  rdvRow:   { display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.5rem 0", borderBottom: "1px solid #f3f4f6" },
  rdvTime:  { fontSize: "0.85rem", fontWeight: 700, color: "#0f4c81", minWidth: "45px" },
  rdvMid:   { flex: 1, display: "flex", flexDirection: "column" },
  rdvName:  { fontSize: "0.85rem", fontWeight: 600, color: "#111827" },
  rdvSoin:  { fontSize: "0.75rem", color: "#6b7280" },
  pendingRow: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.5rem 0", borderBottom: "1px solid #f3f4f6" },
  pendingName: { fontSize: "0.85rem", fontWeight: 600, color: "#111827" },
  pendingMeta: { fontSize: "0.75rem", color: "#6b7280" },
};