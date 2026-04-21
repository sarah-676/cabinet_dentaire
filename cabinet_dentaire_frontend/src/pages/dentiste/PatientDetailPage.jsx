/**
 * src/pages/dentiste/PatientDetailPage.jsx
 * ─────────────────────────────────────────
 * Fiche complète d'un patient :
 *  - Informations personnelles + médicales
 *  - Alertes médicales visuelles
 *  - Note libre (auto-save)
 *  - Onglets : RDV, Ordonnances, Radios, Traitements, Schéma dentaire
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  getPatient, getDossierPatient, updateNote, archiverPatient, validerPatient,
} from "../../api/patientsAPI";
import { uploadRadio, analyserRadio } from "../../api/radiosAPI";

const NIVEAU_COLORS = {
  CRITIQUE:      { bg: "#fef2f2", color: "#dc2626", border: "#fecaca" },
  AVERTISSEMENT: { bg: "#fffbeb", color: "#d97706", border: "#fed7aa" },
  INFO:          { bg: "#eff6ff", color: "#2563eb", border: "#bfdbfe" },
};

const TABS = ["Rendez-vous", "Radios", "Ordonnances", "Traitements"];

export default function PatientDetailPage() {
  const { id }    = useParams();
  const navigate  = useNavigate();

  const [patient, setPatient]   = useState(null);
  const [dossier, setDossier]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [tab,     setTab]       = useState(0);
  const [note,    setNote]      = useState("");
  const [saving,  setSaving]    = useState(false);
  const noteTimer               = useRef();

  // Upload radio
  const [radioFile,     setRadioFile]     = useState(null);
  const [uploadingRadio, setUploadingRadio] = useState(false);
  const [analyzingId,    setAnalyzingId]   = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, d] = await Promise.all([getPatient(id), getDossierPatient(id)]);
      setPatient(p);
      setDossier(d);
      setNote(p.note_generale || "");
    } catch {
      navigate(-1);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Auto-save note avec debounce 1.5s
  const handleNoteChange = (val) => {
    setNote(val);
    clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(async () => {
      setSaving(true);
      try { await updateNote(id, val); }
      finally { setSaving(false); }
    }, 1500);
  };

  // Upload radio
  const handleUploadRadio = async () => {
    if (!radioFile) return;
    setUploadingRadio(true);
    try {
      const fd = new FormData();
      fd.append("image",      radioFile);
      fd.append("patient_id", id);
      fd.append("type_radio", "PANORAMIQUE");
      await uploadRadio(fd);
      setRadioFile(null);
      load();
    } catch (err) {
      alert(err.response?.data?.detail || "Erreur upload");
    } finally {
      setUploadingRadio(false);
    }
  };

  // Analyse IA
  const handleAnalyse = async (radioId) => {
    setAnalyzingId(radioId);
    try {
      await analyserRadio(radioId);
      load();
    } catch (err) {
      alert(err.response?.data?.detail || "Erreur analyse IA");
    } finally {
      setAnalyzingId(null);
    }
  };

  if (loading) return <div style={{ padding: "2rem", color: "#6b7280" }}>Chargement...</div>;
  if (!patient) return null;

  return (
    <div style={styles.page}>

      {/* ── En-tête ── */}
      <div style={styles.header}>
        <button onClick={() => navigate(-1)} style={styles.backBtn}>← Retour</button>
        <div style={styles.headerInfo}>
          <div style={styles.avatar}>{patient.prenom[0]}{patient.nom[0]}</div>
          <div>
            <h2 style={styles.name}>{patient.nom_complet}</h2>
            <span style={styles.meta}>
              {patient.age} ans · {patient.sexe === "M" ? "Homme" : "Femme"} · {patient.telephone}
            </span>
          </div>
        </div>
        <span style={{
          ...styles.statutPill,
          background: patient.statut === "ACCEPTE" ? "#ecfdf5" : "#fffbeb",
          color:      patient.statut === "ACCEPTE" ? "#059669" : "#d97706",
        }}>
          {patient.statut}
        </span>
      </div>

      {/* ── Alertes médicales ── */}
      {patient.alertes?.length > 0 && (
        <div style={styles.alertesGrid}>
          {patient.alertes.map((a) => (
            <div key={a.code} style={{ ...styles.alerteCard, ...NIVEAU_COLORS[a.niveau] }}>
              <strong style={{ fontSize: "0.8rem" }}>⚠ {a.label}</strong>
              <p style={{ margin: "4px 0 0", fontSize: "0.75rem" }}>{a.conseil}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Informations 2 colonnes ── */}
      <div style={styles.infoGrid}>

        {/* Colonne perso */}
        <div style={styles.infoCard}>
          <h3 style={styles.cardTitle}>Informations personnelles</h3>
          <InfoRow label="Email"    value={patient.email   || "—"} />
          <InfoRow label="Adresse"  value={patient.adresse || "—"} />
          <InfoRow label="Né(e) le" value={patient.date_naissance} />
          <InfoRow label="Mineur"   value={patient.est_mineur ? "Oui" : "Non"} />
        </div>

        {/* Colonne médicale */}
        <div style={styles.infoCard}>
          <h3 style={styles.cardTitle}>Informations médicales</h3>
          <InfoRow label="Groupe sanguin"    value={patient.groupe_sanguin} />
          <InfoRow label="Allergies"         value={patient.allergies || "—"} />
          <InfoRow label="Antécédents"       value={patient.antecedents || "—"} />
          <InfoRow label="Médicaments"       value={patient.medicaments_actuels || "—"} />
        </div>
      </div>

      {/* ── Note générale ── */}
      <div style={styles.infoCard}>
        <h3 style={styles.cardTitle}>
          Note générale
          {saving && <span style={styles.savingTag}>Enregistrement...</span>}
          {!saving && note && <span style={styles.savedTag}>✓ Sauvegardé</span>}
        </h3>
        <textarea
          value={note}
          onChange={(e) => handleNoteChange(e.target.value)}
          placeholder="Saisir une note sur ce patient..."
          style={styles.noteArea}
          rows={4}
        />
      </div>

      {/* ── Onglets dossier ── */}
      <div style={styles.infoCard}>
        <div style={styles.tabBar}>
          {TABS.map((t, i) => (
            <button
              key={t}
              onClick={() => setTab(i)}
              style={{ ...styles.tabBtn, ...(tab === i ? styles.tabBtnActive : {}) }}
            >
              {t}
              {i === 0 && ` (${dossier?.rendezvous?.length ?? 0})`}
              {i === 1 && ` (${dossier?.radios?.length ?? 0})`}
              {i === 2 && ` (${dossier?.ordonnances?.length ?? 0})`}
              {i === 3 && ` (${dossier?.treatments?.length ?? 0})`}
            </button>
          ))}
        </div>

        <div style={{ marginTop: "1rem" }}>

          {/* Rendez-vous */}
          {tab === 0 && (
            <DossierSection items={dossier?.rendezvous} emptyMsg="Aucun rendez-vous." renderItem={(r) => (
              <div key={r.id} style={styles.dossierItem}>
                <strong>{r.date_heure || r.date}</strong>
                <span style={styles.dossierMeta}>{r.motif || "Consultation"} · {r.statut}</span>
              </div>
            )} />
          )}

          {/* Radios */}
          {tab === 1 && (
            <div>
              {/* Upload */}
              <div style={styles.uploadRow}>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setRadioFile(e.target.files[0])}
                  style={{ fontSize: "0.875rem" }}
                />
                <button
                  onClick={handleUploadRadio}
                  disabled={!radioFile || uploadingRadio}
                  style={styles.uploadBtn}
                >
                  {uploadingRadio ? "Upload..." : "Ajouter radio"}
                </button>
              </div>
              <DossierSection items={dossier?.radios} emptyMsg="Aucune radio." renderItem={(r) => (
                <div key={r.id} style={styles.dossierItem}>
                  <div>
                    <strong>{r.type_radio}</strong>
                    <span style={styles.dossierMeta}> · {r.date_prise}</span>
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                    <span style={{ fontSize: "0.8rem", color: "#6b7280" }}>{r.statut_analyse}</span>
                    {r.statut_analyse !== "ANALYSE" && (
                      <button
                        onClick={() => handleAnalyse(r.id)}
                        disabled={analyzingId === r.id}
                        style={styles.iaBtn}
                      >
                        {analyzingId === r.id ? "Analyse..." : "🤖 IA"}
                      </button>
                    )}
                    {r.ia_resultat && (
                      <span style={{ fontSize: "0.75rem", color: "#059669", maxWidth: "200px" }}>
                        {r.ia_resultat.slice(0, 80)}…
                      </span>
                    )}
                  </div>
                </div>
              )} />
            </div>
          )}

          {/* Ordonnances */}
          {tab === 2 && (
            <DossierSection items={dossier?.ordonnances} emptyMsg="Aucune ordonnance." renderItem={(o) => (
              <div key={o.id} style={styles.dossierItem}>
                <strong>{o.date || o.created_at?.slice(0, 10)}</strong>
                <span style={styles.dossierMeta}>{o.medicaments?.length ?? 0} médicament(s) · {o.statut}</span>
              </div>
            )} />
          )}

          {/* Traitements */}
          {tab === 3 && (
            <DossierSection items={dossier?.treatments} emptyMsg="Aucun traitement." renderItem={(t) => (
              <div key={t.id} style={styles.dossierItem}>
                <strong>{t.type_acte || t.titre}</strong>
                <span style={styles.dossierMeta}>{t.statut} · dent n°{t.numero_dent}</span>
              </div>
            )} />
          )}

        </div>
      </div>

    </div>
  );
}

// ── Sous-composants ───────────────────────────────────────────────────────────

function InfoRow({ label, value }) {
  return (
    <div style={{ display: "flex", gap: "0.75rem", padding: "0.4rem 0", borderBottom: "1px solid #f3f4f6" }}>
      <span style={{ minWidth: "130px", fontSize: "0.8rem", color: "#6b7280", fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: "0.875rem", color: "#111827" }}>{value}</span>
    </div>
  );
}

function DossierSection({ items, emptyMsg, renderItem }) {
  if (!items || items.length === 0)
    return <p style={{ color: "#6b7280", fontSize: "0.875rem" }}>{emptyMsg}</p>;
  return <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>{items.map(renderItem)}</div>;
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = {
  page:       { display: "flex", flexDirection: "column", gap: "1.25rem" },
  header:     { display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap", background: "#fff", padding: "1.25rem", borderRadius: "12px", border: "1px solid #e5e7eb" },
  backBtn:    { background: "none", border: "none", cursor: "pointer", color: "#0f4c81", fontWeight: 600, fontSize: "0.875rem" },
  headerInfo: { display: "flex", alignItems: "center", gap: "1rem", flex: 1 },
  avatar:     { width: "48px", height: "48px", background: "#dbeafe", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: "#1d4ed8", fontSize: "1rem", flexShrink: 0 },
  name:       { margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "#111827" },
  meta:       { fontSize: "0.85rem", color: "#6b7280" },
  statutPill: { padding: "4px 12px", borderRadius: "12px", fontSize: "0.8rem", fontWeight: 600 },
  alertesGrid:{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "0.75rem" },
  alerteCard: { padding: "0.75rem", borderRadius: "8px", border: "1px solid" },
  infoGrid:   { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" },
  infoCard:   { background: "#fff", borderRadius: "12px", border: "1px solid #e5e7eb", padding: "1.25rem" },
  cardTitle:  { fontSize: "0.95rem", fontWeight: 600, color: "#111827", marginBottom: "0.75rem", display: "flex", alignItems: "center", gap: "0.5rem" },
  savingTag:  { fontSize: "0.75rem", color: "#d97706", fontWeight: 400 },
  savedTag:   { fontSize: "0.75rem", color: "#059669", fontWeight: 400 },
  noteArea:   { width: "100%", padding: "0.75rem", border: "1.5px solid #d1d5db", borderRadius: "8px", fontSize: "0.9rem", resize: "vertical", boxSizing: "border-box", fontFamily: "inherit" },
  tabBar:     { display: "flex", gap: "0.5rem", flexWrap: "wrap", borderBottom: "1px solid #e5e7eb", paddingBottom: "0.75rem" },
  tabBtn:     { padding: "0.4rem 1rem", border: "1px solid #d1d5db", borderRadius: "20px", background: "#f9fafb", cursor: "pointer", fontSize: "0.85rem", color: "#374151" },
  tabBtnActive:{ background: "#0f4c81", color: "#fff", border: "1px solid #0f4c81" },
  dossierItem:{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.6rem 0.75rem", background: "#f9fafb", borderRadius: "8px", gap: "1rem", flexWrap: "wrap" },
  dossierMeta:{ fontSize: "0.8rem", color: "#6b7280", marginLeft: "0.5rem" },
  uploadRow:  { display: "flex", gap: "0.75rem", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap" },
  uploadBtn:  { padding: "0.4rem 1rem", background: "#0f4c81", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "0.85rem" },
  iaBtn:      { padding: "0.3rem 0.7rem", background: "#7c3aed", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "0.8rem" },
};