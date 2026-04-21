/**
 * src/pages/dentiste/MonAgendaPage.jsx
 * ──────────────────────────────────────
 * Agenda des rendez-vous du dentiste.
 * - Vue liste filtrée par date
 * - Actions : créer, valider, annuler, terminer
 */

import { useEffect, useState, useCallback } from "react";
import {
  getRendezVous, createRendezVous, updateRendezVous,
  annulerRendezVous, terminerRendezVous, validerRendezVous,
} from "../../api/rendezvousAPI";
import { getPatients } from "../../api/patientsAPI";

const STATUT_COLORS = {
  PREVU:    { bg: "#eff6ff", color: "#2563eb" },
  CONFIRME: { bg: "#ecfdf5", color: "#059669" },
  ANNULE:   { bg: "#fef2f2", color: "#dc2626" },
  TERMINE:  { bg: "#f9fafb", color: "#6b7280" },
  PENDING:  { bg: "#fffbeb", color: "#d97706" },
};

export default function MonAgendaPage() {
  const [rdvs,     setRdvs]     = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [patients, setPatients] = useState([]);
  const [form,     setForm]     = useState({ patient_id: "", date_heure: "", motif: "", notes: "" });
  const [submitting, setSubmitting] = useState(false);
  const [errors,   setErrors]   = useState({});

  const [filterDate, setFilterDate] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { ordering: "date_heure" };
      if (filterDate) params.date = filterDate;
      const data = await getRendezVous(params);
      setRdvs(data.results || data);
    } finally {
      setLoading(false);
    }
  }, [filterDate]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    getPatients({ ordering: "nom" }).then((d) => setPatients(d.results || d)).catch(() => {});
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setErrors({});
    try {
      await createRendezVous(form);
      setShowForm(false);
      setForm({ patient_id: "", date_heure: "", motif: "", notes: "" });
      load();
    } catch (err) {
      setErrors(err.response?.data || {});
    } finally {
      setSubmitting(false);
    }
  };

  const handleAction = async (action, id, extra = {}) => {
    try {
      if (action === "annuler")  await annulerRendezVous(id, extra.raison || "");
      if (action === "terminer") await terminerRendezVous(id);
      if (action === "valider")  await validerRendezVous(id, extra);
      load();
    } catch (err) {
      alert(err.response?.data?.detail || "Erreur");
    }
  };

  return (
    <div style={styles.page}>

      {/* Barre */}
      <div style={styles.toolbar}>
        <input
          type="date"
          value={filterDate}
          onChange={(e) => setFilterDate(e.target.value)}
          style={styles.dateInput}
        />
        {filterDate && (
          <button onClick={() => setFilterDate("")} style={styles.clearBtn}>Tout voir</button>
        )}
        <button onClick={() => setShowForm(true)} style={styles.addBtn}>
          + Nouveau RDV
        </button>
      </div>

      {/* Liste */}
      {loading ? (
        <p style={{ color: "#6b7280" }}>Chargement...</p>
      ) : rdvs.length === 0 ? (
        <p style={{ color: "#6b7280", textAlign: "center", padding: "2rem" }}>
          Aucun rendez-vous {filterDate ? "ce jour" : ""}.
        </p>
      ) : (
        <div style={styles.list}>
          {rdvs.map((r) => {
            const sc = STATUT_COLORS[r.statut] || STATUT_COLORS.PREVU;
            return (
              <div key={r.id} style={styles.card}>
                <div style={styles.cardLeft}>
                  <div style={styles.hour}>
                    {r.date_heure ? new Date(r.date_heure).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "—"}
                  </div>
                  <div style={styles.date}>
                    {r.date_heure ? new Date(r.date_heure).toLocaleDateString("fr-FR") : ""}
                  </div>
                </div>
                <div style={styles.cardBody}>
                  <strong style={styles.patientName}>{r.patient_nom || "—"}</strong>
                  <span style={styles.motif}>{r.motif || "Consultation"}</span>
                </div>
                <div style={styles.cardRight}>
                  <span style={{ ...styles.statPill, ...sc }}>{r.statut}</span>
                  <div style={styles.actions}>
                    {r.statut === "PENDING" && (
                      <>
                        <button onClick={() => handleAction("valider", r.id, { decision: "ACCEPTE" })} style={styles.btnGreen}>✓</button>
                        <button onClick={() => handleAction("valider", r.id, { decision: "REFUSE" })} style={styles.btnRed}>✗</button>
                      </>
                    )}
                    {(r.statut === "PREVU" || r.statut === "CONFIRME") && (
                      <>
                        <button onClick={() => handleAction("terminer", r.id)} style={styles.btnBlue}>Terminé</button>
                        <button onClick={() => {
                          const raison = window.prompt("Raison d'annulation :");
                          if (raison !== null) handleAction("annuler", r.id, { raison });
                        }} style={styles.btnGray}>Annuler</button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Formulaire nouveau RDV */}
      {showForm && (
        <div style={styles.overlay} onClick={(e) => e.target === e.currentTarget && setShowForm(false)}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700 }}>Nouveau rendez-vous</h2>
              <button onClick={() => setShowForm(false)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.1rem" }}>✕</button>
            </div>
            <form onSubmit={handleCreate} style={styles.formBody}>
              {errors.non_field_errors && <div style={styles.err}>{errors.non_field_errors[0]}</div>}
              <label style={styles.label}>Patient *</label>
              <select value={form.patient_id} onChange={(e) => setForm(f => ({ ...f, patient_id: e.target.value }))} required style={styles.input}>
                <option value="">Sélectionner un patient</option>
                {patients.map(p => <option key={p.id} value={p.id}>{p.nom_complet}</option>)}
              </select>
              {errors.patient_id && <span style={styles.fieldErr}>{errors.patient_id}</span>}

              <label style={styles.label}>Date et heure *</label>
              <input type="datetime-local" value={form.date_heure} onChange={(e) => setForm(f => ({ ...f, date_heure: e.target.value }))} required style={styles.input} />

              <label style={styles.label}>Motif</label>
              <input value={form.motif} onChange={(e) => setForm(f => ({ ...f, motif: e.target.value }))} placeholder="Consultation, détartrage..." style={styles.input} />

              <label style={styles.label}>Notes</label>
              <textarea value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} style={styles.textarea} />

              <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", marginTop: "0.5rem" }}>
                <button type="button" onClick={() => setShowForm(false)} style={styles.cancelBtn}>Annuler</button>
                <button type="submit" disabled={submitting} style={styles.submitBtn}>
                  {submitting ? "..." : "Créer le RDV"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  page:       { display: "flex", flexDirection: "column", gap: "1rem" },
  toolbar:    { display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" },
  dateInput:  { padding: "0.6rem 0.875rem", border: "1.5px solid #d1d5db", borderRadius: "8px", fontSize: "0.9rem" },
  clearBtn:   { padding: "0.6rem 0.875rem", border: "1px solid #d1d5db", borderRadius: "8px", background: "#f9fafb", cursor: "pointer", fontSize: "0.875rem" },
  addBtn:     { padding: "0.6rem 1.25rem", background: "#0f4c81", color: "#fff", border: "none", borderRadius: "8px", fontWeight: 600, cursor: "pointer", marginLeft: "auto" },
  list:       { display: "flex", flexDirection: "column", gap: "0.6rem" },
  card:       { background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "1rem 1.25rem", display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" },
  cardLeft:   { textAlign: "center", minWidth: "56px" },
  hour:       { fontSize: "1rem", fontWeight: 700, color: "#0f4c81" },
  date:       { fontSize: "0.75rem", color: "#6b7280" },
  cardBody:   { flex: 1, display: "flex", flexDirection: "column", gap: "2px" },
  patientName:{ fontSize: "0.95rem", color: "#111827" },
  motif:      { fontSize: "0.8rem", color: "#6b7280" },
  cardRight:  { display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" },
  statPill:   { padding: "3px 10px", borderRadius: "12px", fontSize: "0.75rem", fontWeight: 600 },
  actions:    { display: "flex", gap: "0.4rem" },
  btnGreen:   { padding: "0.3rem 0.6rem", background: "#059669", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "0.8rem" },
  btnRed:     { padding: "0.3rem 0.6rem", background: "#dc2626", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "0.8rem" },
  btnBlue:    { padding: "0.3rem 0.7rem", background: "#2563eb", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "0.8rem" },
  btnGray:    { padding: "0.3rem 0.7rem", background: "#f3f4f6", color: "#374151", border: "1px solid #d1d5db", borderRadius: "6px", cursor: "pointer", fontSize: "0.8rem" },
  overlay:    { position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 1000, overflowY: "auto", padding: "2rem 1rem" },
  modal:      { background: "#fff", borderRadius: "16px", width: "100%", maxWidth: "480px" },
  modalHeader:{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1.25rem 1.5rem", borderBottom: "1px solid #e5e7eb" },
  formBody:   { padding: "1.5rem", display: "flex", flexDirection: "column", gap: "0.75rem" },
  label:      { fontSize: "0.8rem", fontWeight: 500, color: "#374151" },
  input:      { padding: "0.6rem 0.75rem", border: "1.5px solid #d1d5db", borderRadius: "8px", fontSize: "0.9rem" },
  textarea:   { padding: "0.6rem 0.75rem", border: "1.5px solid #d1d5db", borderRadius: "8px", fontSize: "0.875rem", resize: "vertical", fontFamily: "inherit" },
  err:        { background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", padding: "0.6rem", color: "#dc2626", fontSize: "0.85rem" },
  fieldErr:   { fontSize: "0.75rem", color: "#dc2626" },
  cancelBtn:  { padding: "0.6rem 1.25rem", border: "1.5px solid #d1d5db", borderRadius: "8px", background: "#fff", cursor: "pointer" },
  submitBtn:  { padding: "0.6rem 1.5rem", background: "#0f4c81", color: "#fff", border: "none", borderRadius: "8px", fontWeight: 600, cursor: "pointer" },
};