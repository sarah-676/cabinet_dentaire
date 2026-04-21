/**
 * src/pages/dentiste/DashboardDentiste.jsx
 * ──────────────────────────────────────────
 * Tableau de bord du dentiste — version Partie 2.
 *
 * Utilise useDashboard() + appels directs pour les données temps-réel.
 *
 * Champs stats patients (backend /patients/stats/) :
 *   total, actifs, archives, nouveaux_ce_mois, en_attente, refuses, mineurs, avec_alertes
 *
 * Champs stats RDV (backend /rendezvous/stats/) :
 *   total, aujourd_hui, cette_semaine, ce_mois,
 *   en_attente, acceptes, refuses, annules, termines, urgents, a_venir
 *
 * Patients en attente → GET /patients/?statut=PENDING
 * RDV du jour         → GET /rendezvous/?aujourd_hui=true
 */

import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useDashboard }        from "../../hooks/useDashboard";
import { getPatients, validerPatient } from "../../api/patientsAPI";
import { getRendezVous }       from "../../api/rendezvousAPI";
import { useAuth }             from "../../context/AuthContext";

// ── Carte statistique ─────────────────────────────────────────────────────────
function StatCard({ label, value, icon, color = "#0f4c81", bg = "#e8f4fd", onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        ...S.statCard,
        background: bg,
        cursor: onClick ? "pointer" : "default",
      }}
    >
      {icon && <div style={{ fontSize: "1.4rem", marginBottom: "0.5rem" }}>{icon}</div>}
      <div style={{ ...S.statValue, color }}>{value ?? "—"}</div>
      <div style={S.statLabel}>{label}</div>
    </div>
  );
}

// ── Badge statut RDV ──────────────────────────────────────────────────────────
function StatutBadge({ statut }) {
  const cfg = {
    ACCEPTE: { label: "Confirmé",   bg: "#ecfdf5", color: "#059669" },
    PENDING: { label: "En attente", bg: "#fffbeb", color: "#d97706" },
    REFUSE:  { label: "Refusé",     bg: "#fef2f2", color: "#dc2626" },
    ANNULE:  { label: "Annulé",     bg: "#f3f4f6", color: "#6b7280" },
    TERMINE: { label: "Terminé",    bg: "#eff6ff", color: "#1d4ed8" },
  }[statut] || { label: statut, bg: "#f3f4f6", color: "#374151" };

  return (
    <span style={{ padding: "2px 8px", borderRadius: "12px", fontSize: "0.75rem", fontWeight: 600, background: cfg.bg, color: cfg.color }}>
      {cfg.label}
    </span>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function DashboardDentiste() {
  const navigate   = useNavigate();
  const { user }   = useAuth();
  const { patientStats, rdvStats, loading, refresh } = useDashboard();

  const [pending,     setPending]     = useState([]);
  const [rdvDuJour,   setRdvDuJour]   = useState([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [validating,  setValidating]  = useState({});

  const loadDetails = useCallback(async () => {
    setDataLoading(true);
    try {
      const [pendingData, rdvData] = await Promise.all([
        getPatients({ statut: "PENDING" }),
        getRendezVous({ aujourd_hui: "true" }),
      ]);
      setPending(pendingData.results ?? pendingData);
      setRdvDuJour(rdvData.results ?? rdvData);
    } catch {
      // silencieux
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDetails();
  }, []);

  const handleValider = async (id, decision) => {
    setValidating((v) => ({ ...v, [id]: true }));
    try {
      await validerPatient(id, decision);
      // Retirer de la liste pending
      setPending((prev) => prev.filter((p) => p.id !== id));
      // Rafraîchir les stats
      refresh();
    } catch (err) {
      alert(err.response?.data?.detail || "Erreur lors de la validation.");
    } finally {
      setValidating((v) => ({ ...v, [id]: false }));
    }
  };

  // Formater date_heure en HH:MM
  const formatHeure = (dt) => {
    if (!dt) return "—";
    try { return new Date(dt).toLocaleTimeString("fr-DZ", { hour: "2-digit", minute: "2-digit" }); }
    catch { return dt; }
  };

  if (loading && !patientStats) {
    return <div style={S.loading}>Chargement du tableau de bord...</div>;
  }

  return (
    <div style={S.page}>
      {/* Titre */}
      <div>
        <h1 style={S.pageTitle}>
          Bonjour, {user?.full_name || "Docteur"} 👋
        </h1>
        <p style={S.pageSubtitle}>Voici un résumé de votre journée</p>
      </div>

      {/* ── Stats patients ─────────────────────────────────────────── */}
      <section>
        <h2 style={S.sectionTitle}>Mes patients</h2>
        <div style={S.statsGrid}>
          <StatCard label="Total"          value={patientStats?.total}           color="#0f4c81" bg="#e8f4fd" onClick={() => navigate("/dentiste/patients")} />
          <StatCard label="Actifs"         value={patientStats?.actifs}          color="#059669" bg="#ecfdf5" onClick={() => navigate("/dentiste/patients?statut=ACCEPTE")} />
          <StatCard label="En attente"     value={patientStats?.en_attente}      color="#d97706" bg="#fffbeb" onClick={() => navigate("/dentiste/patients?statut=PENDING")} />
          <StatCard label="Nouveaux/mois"  value={patientStats?.nouveaux_ce_mois} color="#7c3aed" bg="#f5f3ff" />
          <StatCard label="Avec alertes"   value={patientStats?.avec_alertes}    color="#dc2626" bg="#fef2f2" />
          <StatCard label="Mineurs"        value={patientStats?.mineurs}         color="#0891b2" bg="#ecfeff" />
        </div>
      </section>

      {/* ── Stats RDV ──────────────────────────────────────────────── */}
      {rdvStats && (
        <section>
          <h2 style={S.sectionTitle}>Rendez-vous</h2>
          <div style={S.statsGrid}>
            <StatCard label="Aujourd'hui"    value={rdvStats.aujourd_hui}   color="#0f4c81" bg="#e8f4fd" onClick={() => navigate("/dentiste/agenda")} />
            <StatCard label="Cette semaine"  value={rdvStats.cette_semaine} color="#059669" bg="#ecfdf5" />
            <StatCard label="En attente val."value={rdvStats.en_attente}    color="#d97706" bg="#fffbeb" />
            <StatCard label="Urgents"        value={rdvStats.urgents}       color="#dc2626" bg="#fef2f2" />
          </div>
        </section>
      )}

      {/* ── Patients PENDING ───────────────────────────────────────── */}
      {!dataLoading && pending.length > 0 && (
        <section>
          <h2 style={S.sectionTitle}>
            Patients en attente de validation
            <span style={S.badge}>{pending.length}</span>
          </h2>
          <div style={S.pendingList}>
            {pending.map((p) => (
              <div key={p.id} style={S.pendingCard}>
                <div style={S.pendingInfo}>
                  <span style={S.pendingName}>{p.nom_complet}</span>
                  <span style={S.pendingMeta}>
                    {p.age ? `${p.age} ans` : ""}
                    {p.telephone ? ` · ${p.telephone}` : ""}
                  </span>
                </div>
                <div style={S.pendingActions}>
                  <button
                    onClick={() => handleValider(p.id, "ACCEPTE")}
                    disabled={validating[p.id]}
                    style={S.btnAccept}
                  >
                    {validating[p.id] ? "..." : "✓ Accepter"}
                  </button>
                  <button
                    onClick={() => handleValider(p.id, "REFUSE")}
                    disabled={validating[p.id]}
                    style={S.btnRefuse}
                  >
                    {validating[p.id] ? "..." : "✗ Refuser"}
                  </button>
                  <button
                    onClick={() => navigate(`/dentiste/patients/${p.id}`)}
                    style={S.btnView}
                  >
                    Voir
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── RDV du jour ────────────────────────────────────────────── */}
      <section>
        <h2 style={S.sectionTitle}>
          RDV d'aujourd'hui
          {rdvDuJour.length > 0 && (
            <span style={S.badge}>{rdvDuJour.length}</span>
          )}
        </h2>

        {dataLoading ? (
          <p style={S.loading}>Chargement...</p>
        ) : rdvDuJour.length === 0 ? (
          <p style={S.empty}>Aucun rendez-vous aujourd'hui.</p>
        ) : (
          <div style={S.rdvList}>
            {rdvDuJour.map((rdv) => (
              <div key={rdv.id} style={S.rdvCard}>
                <div style={S.rdvHour}>{formatHeure(rdv.date_heure)}</div>
                <div style={S.rdvBody}>
                  <span style={S.rdvPatient}>
                    {rdv.patient_nom || rdv.patient?.nom_complet || "—"}
                  </span>
                  <span style={S.rdvType}>{rdv.type_soin || "Consultation"}</span>
                  {rdv.duree_minutes && (
                    <span style={S.rdvDuree}>{rdv.duree_minutes} min</span>
                  )}
                </div>
                <StatutBadge statut={rdv.statut} />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

const S = {
  page:         { display: "flex", flexDirection: "column", gap: "2rem" },
  loading:      { padding: "2rem", color: "#6b7280" },
  pageTitle:    { fontSize: "1.6rem", fontWeight: 700, color: "#111827", margin: 0 },
  pageSubtitle: { color: "#6b7280", fontSize: "0.9rem", marginTop: "4px" },
  sectionTitle: { fontSize: "1rem", fontWeight: 600, color: "#111827", marginBottom: "0.875rem", display: "flex", alignItems: "center", gap: "0.5rem" },
  statsGrid:    { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: "0.875rem" },
  statCard:     { borderRadius: "12px", padding: "1.1rem 1rem", textAlign: "center" },
  statValue:    { fontSize: "1.75rem", fontWeight: 700, marginBottom: "0.2rem" },
  statLabel:    { fontSize: "0.78rem", color: "#6b7280", fontWeight: 500 },
  badge:        { background: "#fef3c7", color: "#92400e", borderRadius: "12px", padding: "2px 8px", fontSize: "0.78rem", fontWeight: 600 },
  pendingList:  { display: "flex", flexDirection: "column", gap: "0.6rem" },
  pendingCard:  { background: "#fff", border: "1px solid #fed7aa", borderRadius: "10px", padding: "0.875rem 1.25rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" },
  pendingInfo:  { display: "flex", flexDirection: "column", gap: "2px" },
  pendingName:  { fontWeight: 600, fontSize: "0.9rem", color: "#111827" },
  pendingMeta:  { fontSize: "0.78rem", color: "#6b7280" },
  pendingActions: { display: "flex", gap: "0.4rem", flexWrap: "wrap" },
  btnAccept:    { padding: "0.4rem 0.8rem", background: "#059669", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "0.8rem", fontWeight: 500 },
  btnRefuse:    { padding: "0.4rem 0.8rem", background: "#dc2626", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "0.8rem", fontWeight: 500 },
  btnView:      { padding: "0.4rem 0.8rem", background: "#f3f4f6", color: "#374151", border: "1px solid #d1d5db", borderRadius: "6px", cursor: "pointer", fontSize: "0.8rem" },
  rdvList:      { display: "flex", flexDirection: "column", gap: "0.5rem" },
  rdvCard:      { background: "#fff", border: "1px solid #e5e7eb", borderRadius: "10px", padding: "0.75rem 1.25rem", display: "flex", alignItems: "center", gap: "1rem" },
  rdvHour:      { fontSize: "0.9rem", fontWeight: 700, color: "#0f4c81", minWidth: "48px", flexShrink: 0 },
  rdvBody:      { flex: 1, display: "flex", flexDirection: "column", gap: "1px" },
  rdvPatient:   { fontWeight: 600, fontSize: "0.88rem", color: "#111827" },
  rdvType:      { fontSize: "0.78rem", color: "#6b7280" },
  rdvDuree:     { fontSize: "0.73rem", color: "#9ca3af" },
  empty:        { color: "#6b7280", fontSize: "0.88rem" },
};