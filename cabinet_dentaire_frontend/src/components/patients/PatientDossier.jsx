/**
 * components/patients/PatientDossier.jsx
 * =========================================
 * Dossier complet d'un patient.
 * Affiche la réponse de GET /api/patients/{id}/dossier/
 *
 * Structure du dossier (PatientDetailSerializer + sections agrégées) :
 *   dossier.patient      → PatientDetailSerializer
 *   dossier.rendezvous   → RendezVousListSerializer[]
 *   dossier.ordonnances  → OrdonnanceListSerializer[]
 *   dossier.radios       → RadioListSerializer[]
 *   dossier.dental_chart → ToothSerializer[]
 *   dossier.treatments   → TreatmentListSerializer[]
 *
 * Props :
 *   dossier   {Object}   - réponse complète de /dossier/
 *   onClose   {Function}
 *   onEdit    {Function} - ouvre PatientForm en mode edit
 *   canEdit   {boolean}
 */

import React, { useState } from "react";

// ── Constantes ────────────────────────────────────────────────────────────────

const NIVEAU_CONFIG = {
  CRITIQUE:      { bg: "#fef2f2", color: "#dc2626", border: "#fecaca", icon: "🔴" },
  AVERTISSEMENT: { bg: "#fffbeb", color: "#d97706", border: "#fde68a", icon: "🟡" },
  INFO:          { bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe", icon: "🔵" },
};

const STATUT_RDV = {
  ACCEPTE: { label: "Accepté",   color: "#166534" },
  PENDING: { label: "En attente", color: "#92400e" },
  REFUSE:  { label: "Refusé",    color: "#991b1b" },
  ANNULE:  { label: "Annulé",    color: "#6b7280" },
  TERMINE: { label: "Terminé",   color: "#1d4ed8" },
};

const TABS = [
  { id: "info",        label: "📋 Infos" },
  { id: "medical",     label: "🩺 Médical" },
  { id: "rdv",         label: "📅 RDV" },
  { id: "traitements", label: "💉 Traitements" },
  { id: "ordonnances", label: "📝 Ordonnances" },
  { id: "radios",      label: "🔬 Radios" },
];

// ── Styles ────────────────────────────────────────────────────────────────────

const S = {
  overlay:   { position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "1rem" },
  modal:     { backgroundColor: "#fff", borderRadius: "16px", width: "100%", maxWidth: "780px", maxHeight: "92vh", display: "flex", flexDirection: "column", boxShadow: "0 24px 64px rgba(0,0,0,0.22)", fontFamily: "system-ui, sans-serif", overflow: "hidden" },
  topBar:    { padding: "1.25rem 1.5rem", borderBottom: "1.5px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 },
  patientName: { fontSize: "1.125rem", fontWeight: "700", color: "#0f172a", margin: 0 },
  patientMeta: { fontSize: "0.8125rem", color: "#64748b", marginTop: "0.15rem" },
  closeBtn:  { background: "none", border: "none", fontSize: "1.25rem", cursor: "pointer", color: "#94a3b8", padding: "0.25rem" },
  tabs:      { display: "flex", gap: 0, borderBottom: "1.5px solid #f1f5f9", overflowX: "auto", flexShrink: 0 },
  tab:       (active) => ({ padding: "0.7rem 1rem", fontSize: "0.8125rem", fontWeight: active ? "600" : "400", color: active ? "#2563eb" : "#64748b", borderBottom: active ? "2.5px solid #2563eb" : "2.5px solid transparent", background: "none", border: "none", borderBottom: active ? "2.5px solid #2563eb" : "2.5px solid transparent", cursor: "pointer", whiteSpace: "nowrap", marginBottom: "-1.5px" }),
  body:      { padding: "1.5rem", overflowY: "auto", flex: 1 },
  section:   { marginBottom: "1.5rem" },
  sTitle:    { fontSize: "0.8rem", fontWeight: "600", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.75rem" },
  grid2:     { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" },
  infoItem:  { backgroundColor: "#f8fafc", borderRadius: "8px", padding: "0.65rem 0.875rem" },
  infoLabel: { fontSize: "0.72rem", color: "#94a3b8", fontWeight: "500", marginBottom: "0.2rem" },
  infoValue: { fontSize: "0.875rem", color: "#1e293b", fontWeight: "500" },
  alerteBadge: (niveau) => ({
    display: "flex", alignItems: "flex-start", gap: "0.5rem",
    padding: "0.65rem 0.875rem", borderRadius: "8px", marginBottom: "0.5rem",
    backgroundColor: NIVEAU_CONFIG[niveau]?.bg     ?? "#f8fafc",
    border:          `1px solid ${NIVEAU_CONFIG[niveau]?.border ?? "#e2e8f0"}`,
    color:           NIVEAU_CONFIG[niveau]?.color  ?? "#475569",
  }),
  alerteTitle: { fontSize: "0.8125rem", fontWeight: "600", margin: 0 },
  alerteConseil: { fontSize: "0.77rem", color: "#64748b", marginTop: "0.2rem" },
  rdvItem:   { padding: "0.75rem 1rem", borderRadius: "8px", backgroundColor: "#f8fafc", marginBottom: "0.5rem", display: "flex", justifyContent: "space-between", alignItems: "center" },
  emptyMsg:  { textAlign: "center", color: "#94a3b8", fontSize: "0.875rem", padding: "2rem" },
  editBtn:   { padding: "0.45rem 1rem", backgroundColor: "#2563eb", color: "#fff", border: "none", borderRadius: "6px", fontSize: "0.8rem", fontWeight: "500", cursor: "pointer" },
  noteBox:   { backgroundColor: "#fffbeb", border: "1px solid #fde68a", borderRadius: "8px", padding: "0.875rem 1rem", fontSize: "0.875rem", color: "#78350f", lineHeight: 1.6, whiteSpace: "pre-wrap" },
};

// ── Sous-composants ───────────────────────────────────────────────────────────

function InfoItem({ label, value }) {
  return (
    <div style={S.infoItem}>
      <p style={S.infoLabel}>{label}</p>
      <p style={S.infoValue}>{value || "—"}</p>
    </div>
  );
}

function TabInfo({ patient, onEdit, canEdit }) {
  return (
    <div>
      {canEdit && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "1rem" }}>
          <button style={S.editBtn} onClick={onEdit}>✏️ Modifier</button>
        </div>
      )}
      <div style={S.section}>
        <p style={S.sTitle}>Identité</p>
        <div style={S.grid2}>
          <InfoItem label="Nom complet"  value={patient.nom_complet} />
          <InfoItem label="Âge"          value={`${patient.age} ans${patient.est_mineur ? " (mineur)" : ""}`} />
          <InfoItem label="Date naissance" value={patient.date_naissance ? new Date(patient.date_naissance).toLocaleDateString("fr-FR") : "—"} />
          <InfoItem label="Sexe"          value={patient.sexe === "M" ? "Masculin" : patient.sexe === "F" ? "Féminin" : "Non précisé"} />
          <InfoItem label="Téléphone"     value={patient.telephone} />
          <InfoItem label="Email"         value={patient.email} />
          <InfoItem label="Groupe sanguin" value={patient.groupe_sanguin !== "INCONNU" ? patient.groupe_sanguin : "Non renseigné"} />
          <InfoItem label="Statut"        value={patient.statut} />
        </div>
        {patient.adresse && (
          <div style={{ ...S.infoItem, marginTop: "0.75rem" }}>
            <p style={S.infoLabel}>Adresse</p>
            <p style={S.infoValue}>{patient.adresse}</p>
          </div>
        )}
      </div>
      {patient.note_generale && (
        <div style={S.section}>
          <p style={S.sTitle}>Note interne</p>
          <div style={S.noteBox}>{patient.note_generale}</div>
        </div>
      )}
    </div>
  );
}

function TabMedical({ patient }) {
  return (
    <div>
      {/* Alertes actives */}
      {patient.alertes?.length > 0 && (
        <div style={S.section}>
          <p style={S.sTitle}>Alertes médicales actives</p>
          {patient.alertes.map((a) => (
            <div key={a.code} style={S.alerteBadge(a.niveau)}>
              <span style={{ fontSize: "1rem" }}>{NIVEAU_CONFIG[a.niveau]?.icon}</span>
              <div>
                <p style={S.alerteTitle}>{a.label}</p>
                <p style={S.alerteConseil}>{a.conseil}</p>
              </div>
            </div>
          ))}
        </div>
      )}
      <div style={S.section}>
        <p style={S.sTitle}>Informations médicales</p>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          {[
            { label: "Allergies",           value: patient.allergies },
            { label: "Antécédents",         value: patient.antecedents },
            { label: "Médicaments actuels", value: patient.medicaments_actuels },
          ].map(({ label, value }) => value ? (
            <div key={label} style={S.infoItem}>
              <p style={S.infoLabel}>{label}</p>
              <p style={{ ...S.infoValue, fontWeight: "400", whiteSpace: "pre-wrap" }}>{value}</p>
            </div>
          ) : null)}
        </div>
      </div>
    </div>
  );
}

function TabRDV({ rendezvous }) {
  if (!rendezvous?.length) return <p style={S.emptyMsg}>Aucun rendez-vous enregistré.</p>;
  return (
    <div>
      {rendezvous.map((rdv) => {
        const cfg = STATUT_RDV[rdv.statut] ?? { label: rdv.statut, color: "#475569" };
        return (
          <div key={rdv.id} style={S.rdvItem}>
            <div>
              <p style={{ margin: 0, fontWeight: "600", fontSize: "0.875rem", color: "#1e293b" }}>
                {new Date(rdv.date_heure).toLocaleDateString("fr-FR", {
                  weekday: "short", day: "2-digit", month: "short", year: "numeric",
                })} — {new Date(rdv.date_heure).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
              </p>
              <p style={{ margin: 0, fontSize: "0.8rem", color: "#64748b", marginTop: "0.2rem" }}>
                {rdv.type_soin ?? "Consultation"} · {rdv.duree_minutes} min
              </p>
              {rdv.motif && <p style={{ margin: 0, fontSize: "0.77rem", color: "#94a3b8" }}>{rdv.motif}</p>}
            </div>
            <span style={{ fontSize: "0.77rem", fontWeight: "600", color: cfg.color }}>
              {cfg.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function TabSimple({ items, renderItem, emptyMsg }) {
  if (!items?.length) return <p style={S.emptyMsg}>{emptyMsg}</p>;
  return <div>{items.map(renderItem)}</div>;
}

// ── Composant principal ───────────────────────────────────────────────────────

export default function PatientDossier({ dossier, onClose, onEdit, canEdit = false }) {
  const [tab, setTab] = useState("info");

  if (!dossier) return null;
  const { patient, rendezvous = [], ordonnances = [], radios = [], treatments = [] } = dossier;

  return (
    <div style={S.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={S.modal}>

        {/* Barre du haut */}
        <div style={S.topBar}>
          <div>
            <h2 style={S.patientName}>{patient.nom_complet}</h2>
            <p style={S.patientMeta}>
              {patient.age} ans · {patient.telephone}
              {patient.alertes?.length > 0 && (
                <span style={{ color: "#dc2626", fontWeight: "600", marginLeft: "0.5rem" }}>
                  ⚠ {patient.alertes.length} alerte(s)
                </span>
              )}
            </p>
          </div>
          <button style={S.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* Onglets */}
        <div style={S.tabs}>
          {TABS.map(({ id, label }) => (
            <button key={id} style={S.tab(tab === id)} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </div>

        {/* Corps */}
        <div style={S.body}>
          {tab === "info"        && <TabInfo     patient={patient} onEdit={onEdit} canEdit={canEdit} />}
          {tab === "medical"     && <TabMedical  patient={patient} />}
          {tab === "rdv"         && <TabRDV      rendezvous={rendezvous} />}
          {tab === "traitements" && (
            <TabSimple
              items={treatments}
              emptyMsg="Aucun traitement enregistré."
              renderItem={(t) => (
                <div key={t.id} style={S.rdvItem}>
                  <div>
                    <p style={{ margin: 0, fontWeight: "600", fontSize: "0.875rem", color: "#1e293b" }}>
                      {t.type_traitement ?? t.titre ?? "Traitement"}
                    </p>
                    <p style={{ margin: 0, fontSize: "0.8rem", color: "#64748b" }}>{t.statut}</p>
                  </div>
                  <span style={{ fontSize: "0.77rem", color: "#94a3b8" }}>
                    {t.date ? new Date(t.date).toLocaleDateString("fr-FR") : ""}
                  </span>
                </div>
              )}
            />
          )}
          {tab === "ordonnances" && (
            <TabSimple
              items={ordonnances}
              emptyMsg="Aucune ordonnance enregistrée."
              renderItem={(o) => (
                <div key={o.id} style={S.rdvItem}>
                  <div>
                    <p style={{ margin: 0, fontWeight: "600", fontSize: "0.875rem", color: "#1e293b" }}>
                      Ordonnance du {o.created_at ? new Date(o.created_at).toLocaleDateString("fr-FR") : "—"}
                    </p>
                    {o.medicaments && <p style={{ margin: 0, fontSize: "0.8rem", color: "#64748b" }}>{o.medicaments}</p>}
                  </div>
                </div>
              )}
            />
          )}
          {tab === "radios" && (
            <TabSimple
              items={radios}
              emptyMsg="Aucune radiographie enregistrée."
              renderItem={(r) => (
                <div key={r.id} style={{ ...S.rdvItem, flexDirection: "column", alignItems: "flex-start" }}>
                  <p style={{ margin: 0, fontWeight: "600", fontSize: "0.875rem", color: "#1e293b" }}>
                    {r.type_radio ?? "Radiographie"} — {r.created_at ? new Date(r.created_at).toLocaleDateString("fr-FR") : "—"}
                  </p>
                  {r.statut_analyse && (
                    <p style={{ margin: 0, fontSize: "0.8rem", color: "#64748b", marginTop: "0.25rem" }}>
                      Analyse : {r.statut_analyse}
                    </p>
                  )}
                  {r.image && (
                    <img
                      src={r.image}
                      alt="Radio"
                      style={{ marginTop: "0.5rem", maxWidth: "100%", maxHeight: "180px", borderRadius: "6px", objectFit: "contain" }}
                    />
                  )}
                </div>
              )}
            />
          )}
        </div>

      </div>
    </div>
  );
}