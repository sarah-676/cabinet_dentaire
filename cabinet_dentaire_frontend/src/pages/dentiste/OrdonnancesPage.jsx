/**
 * src/pages/dentiste/OrdonnancesPage.jsx
 * ─────────────────────────────────────────
 * Gestion complète des ordonnances.
 *
 * Connexion backend :
 *   GET    /api/ordonnances/                    → liste
 *   POST   /api/ordonnances/                    → créer
 *   GET    /api/ordonnances/{id}/               → détail (avec lignes médicaments)
 *   PATCH  /api/ordonnances/{id}/               → modifier
 *   DELETE /api/ordonnances/{id}/               → soft delete
 *   GET    /api/ordonnances/stats/              → stats
 *   GET    /api/ordonnances/patient/{id}/       → par patient
 *   PATCH  /api/ordonnances/{id}/annuler/       → annuler
 *   PATCH  /api/ordonnances/{id}/archiver/      → archiver
 *
 * Structure ordonnance attendue :
 *   { id, patient_id, patient_nom, date, statut, notes,
 *     lignes: [{ medicament, dosage, duree, instructions }] }
 */

import { useEffect, useState, useCallback } from "react";
import {
  getOrdonnances, createOrdonnance, getOrdonnance,
  annulerOrdonnance, archiverOrdonnance, deleteOrdonnance,
  getOrdonnanceStats,
} from "../../api/ordonnancesAPI";
import { getPatients } from "../../api/patientsAPI";

const STATUT_CONFIG = {
  ACTIVE:   { bg: "#ecfdf5", color: "#059669", label: "Active" },
  ANNULEE:  { bg: "#fef2f2", color: "#dc2626", label: "Annulée" },
  ARCHIVEE: { bg: "#f9fafb", color: "#6b7280", label: "Archivée" },
};

const EMPTY_LIGNE = { medicament: "", dosage: "", duree: "", instructions: "" };

export default function OrdonnancesPage() {
  const [ordonnances, setOrdonnances] = useState([]);
  const [stats,       setStats]       = useState(null);
  const [patients,    setPatients]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [selected,    setSelected]    = useState(null);
  const [showForm,    setShowForm]    = useState(false);

  // Form
  const [form, setForm] = useState({
    patient_id: "", notes: "",
    lignes: [{ ...EMPTY_LIGNE }],
  });
  const [formErrors,  setFormErrors]  = useState({});
  const [submitting,  setSubmitting]  = useState(false);

  // Filtres
  const [filterPatient, setFilterPatient] = useState("");
  const [filterStatut,  setFilterStatut]  = useState("");

  const [actionId, setActionId] = useState(null);

  // ── Chargement ────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterPatient) params.patient_id = filterPatient;
      if (filterStatut)  params.statut     = filterStatut;

      const [oData, sData] = await Promise.all([
        getOrdonnances(params),
        getOrdonnanceStats(),
      ]);
      setOrdonnances(oData.results || oData);
      setStats(sData);
    } finally { setLoading(false); }
  }, [filterPatient, filterStatut]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    getPatients({ ordering: "nom" }).then(d => setPatients(d.results || d)).catch(() => {});
  }, []);

  const handleSelect = async (o) => {
    try {
      const detail = await getOrdonnance(o.id);
      setSelected(detail);
    } catch { setSelected(o); }
  };

  // ── Créer ordonnance ──────────────────────────────────────────────

  const handleCreate = async (e) => {
    e.preventDefault();
    // Valider que toutes les lignes ont un médicament
    const validLignes = form.lignes.filter(l => l.medicament.trim());
    if (validLignes.length === 0) {
      setFormErrors({ lignes: ["Ajoutez au moins un médicament."] });
      return;
    }
    setSubmitting(true); setFormErrors({});
    try {
      const payload = { ...form, lignes: validLignes };
      const created = await createOrdonnance(payload);
      setShowForm(false);
      setForm({ patient_id: "", notes: "", lignes: [{ ...EMPTY_LIGNE }] });
      load();
      handleSelect(created);
    } catch (err) {
      setFormErrors(err.response?.data || {});
    } finally { setSubmitting(false); }
  };

  // ── Actions ───────────────────────────────────────────────────────

  const handleAction = async (action, id) => {
    setActionId(id);
    try {
      if (action === "annuler")  await annulerOrdonnance(id);
      if (action === "archiver") await archiverOrdonnance(id);
      if (action === "delete")   await deleteOrdonnance(id);
      load();
      if (selected?.id === id) setSelected(null);
    } catch (err) {
      alert(err.response?.data?.detail || "Erreur");
    } finally { setActionId(null); }
  };

  // ── Gestion lignes ────────────────────────────────────────────────

  const addLigne = () =>
    setForm(f => ({ ...f, lignes: [...f.lignes, { ...EMPTY_LIGNE }] }));

  const removeLigne = (i) =>
    setForm(f => ({ ...f, lignes: f.lignes.filter((_, idx) => idx !== i) }));

  const updateLigne = (i, field, val) =>
    setForm(f => ({
      ...f,
      lignes: f.lignes.map((l, idx) => idx === i ? { ...l, [field]: val } : l),
    }));

  // ── Rendu ──────────────────────────────────────────────────────────

  return (
    <div style={styles.page}>

      {/* Stats */}
      {stats && (
        <div style={styles.statsRow}>
          {[
            { label: "Total",    value: stats.total,    color: "#0f4c81", bg: "#e8f4fd" },
            { label: "Actives",  value: stats.actives,  color: "#059669", bg: "#ecfdf5" },
            { label: "Annulées", value: stats.annulees, color: "#dc2626", bg: "#fef2f2" },
          ].map(c => (
            <div key={c.label} style={{ background: c.bg, borderRadius: "10px", padding: "0.875rem 1rem", textAlign: "center", minWidth: "100px" }}>
              <div style={{ fontSize: "1.5rem", fontWeight: 700, color: c.color }}>{c.value ?? "—"}</div>
              <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>{c.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Toolbar */}
      <div style={styles.toolbar}>
        <select value={filterPatient} onChange={e => setFilterPatient(e.target.value)} style={styles.select}>
          <option value="">Tous les patients</option>
          {patients.map(p => <option key={p.id} value={p.id}>{p.nom_complet}</option>)}
        </select>
        <select value={filterStatut} onChange={e => setFilterStatut(e.target.value)} style={styles.select}>
          <option value="">Tous les statuts</option>
          {Object.entries(STATUT_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <button onClick={() => setShowForm(true)} style={styles.addBtn}>+ Nouvelle ordonnance</button>
      </div>

      {/* Split */}
      <div style={styles.split}>

        {/* Liste */}
        <div style={styles.listPanel}>
          {loading ? (
            <p style={{ color: "#6b7280", padding: "1rem" }}>Chargement...</p>
          ) : ordonnances.length === 0 ? (
            <p style={{ color: "#6b7280", padding: "2rem", textAlign: "center" }}>Aucune ordonnance.</p>
          ) : (
            ordonnances.map(o => {
              const sc = STATUT_CONFIG[o.statut] || STATUT_CONFIG.ACTIVE;
              return (
                <div
                  key={o.id}
                  onClick={() => handleSelect(o)}
                  style={{ ...styles.card, ...(selected?.id === o.id ? styles.cardSelected : {}) }}
                >
                  <div style={styles.cardBody}>
                    <div style={styles.cardTitle}>{o.patient_nom || "—"}</div>
                    <div style={styles.cardDate}>{o.date || o.created_at?.slice(0, 10)}</div>
                    <div style={styles.cardMeta}>{o.nb_lignes ?? (o.lignes?.length ?? 0)} médicament(s)</div>
                  </div>
                  <span style={{ ...styles.pill, background: sc.bg, color: sc.color }}>{sc.label}</span>
                </div>
              );
            })
          )}
        </div>

        {/* Détail */}
        <div style={styles.detailPanel}>
          {!selected ? (
            <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af" }}>
              Sélectionnez une ordonnance
            </div>
          ) : (
            <div style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "1rem" }}>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h3 style={{ margin: "0 0 4px", fontSize: "1rem", fontWeight: 700 }}>
                    Ordonnance — {selected.patient_nom}
                  </h3>
                  <div style={{ fontSize: "0.8rem", color: "#6b7280" }}>
                    {selected.date || selected.created_at?.slice(0, 10)}
                  </div>
                </div>
                <span style={{ ...styles.pill, ...(STATUT_CONFIG[selected.statut] || STATUT_CONFIG.ACTIVE) }}>
                  {STATUT_CONFIG[selected.statut]?.label}
                </span>
              </div>

              {/* Médicaments */}
              <div>
                <h4 style={{ margin: "0 0 0.75rem", fontSize: "0.875rem", fontWeight: 600 }}>Médicaments</h4>
                {(selected.lignes || []).length === 0 ? (
                  <p style={{ color: "#6b7280", fontSize: "0.875rem" }}>Aucun médicament.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    {(selected.lignes || []).map((l, i) => (
                      <div key={i} style={styles.ligneCard}>
                        <div style={{ fontWeight: 600, fontSize: "0.875rem" }}>{l.medicament}</div>
                        <div style={{ fontSize: "0.8rem", color: "#374151" }}>
                          {l.dosage && <span>Dosage : <strong>{l.dosage}</strong> · </span>}
                          {l.duree  && <span>Durée : <strong>{l.duree}</strong></span>}
                        </div>
                        {l.instructions && (
                          <div style={{ fontSize: "0.78rem", color: "#6b7280", marginTop: "2px" }}>
                            {l.instructions}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {selected.notes && (
                <div style={{ background: "#f9fafb", padding: "0.75rem", borderRadius: "8px", fontSize: "0.875rem", color: "#374151" }}>
                  <strong>Notes :</strong> {selected.notes}
                </div>
              )}

              {/* Actions */}
              {selected.statut === "ACTIVE" && (
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  <button onClick={() => handleAction("annuler", selected.id)} disabled={actionId === selected.id} style={styles.btnOrange}>
                    Annuler
                  </button>
                  <button onClick={() => handleAction("archiver", selected.id)} disabled={actionId === selected.id} style={styles.btnGray}>
                    Archiver
                  </button>
                  <button onClick={() => handleAction("delete", selected.id)} disabled={actionId === selected.id} style={styles.btnDanger}>
                    Supprimer
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modale nouvelle ordonnance */}
      {showForm && (
        <div style={modalOverlay} onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div style={{ ...modalBox, maxWidth: "620px" }}>
            <div style={modalHead}>
              <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700 }}>Nouvelle ordonnance</h2>
              <button onClick={() => setShowForm(false)} style={closeBtnSt}>✕</button>
            </div>
            <form onSubmit={handleCreate} style={modalFormSt}>
              {formErrors.non_field_errors && (
                <div style={errSt}>{formErrors.non_field_errors[0]}</div>
              )}

              <FField label="Patient *" error={formErrors.patient_id}>
                <select value={form.patient_id} onChange={e => setForm(f => ({ ...f, patient_id: e.target.value }))} required style={inputSt}>
                  <option value="">Sélectionner</option>
                  {patients.map(p => <option key={p.id} value={p.id}>{p.nom_complet}</option>)}
                </select>
              </FField>

              <FField label="Notes" error={formErrors.notes}>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Notes générales..." style={{ ...inputSt, resize: "vertical", fontFamily: "inherit" }} />
              </FField>

              {/* Lignes médicaments */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                  <label style={{ fontSize: "0.85rem", fontWeight: 600 }}>
                    Médicaments * {formErrors.lignes && <span style={{ color: "#dc2626", fontSize: "0.75rem" }}>{formErrors.lignes}</span>}
                  </label>
                  <button type="button" onClick={addLigne} style={{ ...styles.btnBlue, padding: "0.25rem 0.7rem", fontSize: "0.8rem" }}>
                    + Ajouter
                  </button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {form.lignes.map((l, i) => (
                    <div key={i} style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "8px", padding: "0.75rem" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginBottom: "0.4rem" }}>
                        <input placeholder="Médicament *" value={l.medicament} onChange={e => updateLigne(i, "medicament", e.target.value)} style={inputSt} />
                        <input placeholder="Dosage (ex : 500mg 2x/j)" value={l.dosage} onChange={e => updateLigne(i, "dosage", e.target.value)} style={inputSt} />
                        <input placeholder="Durée (ex : 7 jours)" value={l.duree} onChange={e => updateLigne(i, "duree", e.target.value)} style={inputSt} />
                        <input placeholder="Instructions" value={l.instructions} onChange={e => updateLigne(i, "instructions", e.target.value)} style={inputSt} />
                      </div>
                      {form.lignes.length > 1 && (
                        <button type="button" onClick={() => removeLigne(i)} style={{ fontSize: "0.75rem", color: "#dc2626", background: "none", border: "none", cursor: "pointer" }}>
                          Supprimer cette ligne
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
                <button type="button" onClick={() => setShowForm(false)} style={styles.btnCancel}>Annuler</button>
                <button type="submit" disabled={submitting} style={{ padding: "0.6rem 1.5rem", background: "#0f4c81", color: "#fff", border: "none", borderRadius: "8px", fontWeight: 600, cursor: "pointer" }}>
                  {submitting ? "..." : "Créer l'ordonnance"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function FField({ label, error, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
      <label style={{ fontSize: "0.8rem", fontWeight: 500, color: "#374151" }}>{label}</label>
      {children}
      {error && <span style={{ fontSize: "0.75rem", color: "#dc2626" }}>{Array.isArray(error) ? error[0] : error}</span>}
    </div>
  );
}

const styles = {
  page:        { display: "flex", flexDirection: "column", gap: "1rem" },
  statsRow:    { display: "flex", gap: "1rem", flexWrap: "wrap" },
  toolbar:     { display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" },
  select:      { padding: "0.6rem 0.875rem", border: "1.5px solid #d1d5db", borderRadius: "8px", fontSize: "0.875rem", background: "#fff" },
  addBtn:      { padding: "0.6rem 1.25rem", background: "#0f4c81", color: "#fff", border: "none", borderRadius: "8px", fontWeight: 600, cursor: "pointer", marginLeft: "auto" },
  split:       { display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: "1.25rem", minHeight: "450px" },
  listPanel:   { display: "flex", flexDirection: "column", gap: "0.5rem", overflowY: "auto", maxHeight: "560px" },
  card:        { display: "flex", gap: "0.75rem", padding: "0.875rem", background: "#fff", border: "1.5px solid #e5e7eb", borderRadius: "10px", cursor: "pointer", alignItems: "center" },
  cardSelected:{ borderColor: "#0f4c81", background: "#f0f7ff" },
  cardBody:    { flex: 1 },
  cardTitle:   { fontSize: "0.875rem", fontWeight: 600, color: "#111827" },
  cardDate:    { fontSize: "0.8rem", color: "#6b7280" },
  cardMeta:    { fontSize: "0.75rem", color: "#9ca3af" },
  pill:        { padding: "3px 10px", borderRadius: "12px", fontSize: "0.75rem", fontWeight: 600, whiteSpace: "nowrap" },
  detailPanel: { background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", overflow: "auto" },
  ligneCard:   { background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "8px", padding: "0.75rem" },
  btnOrange:   { padding: "0.4rem 0.875rem", background: "#fffbeb", color: "#d97706", border: "1px solid #fed7aa", borderRadius: "6px", cursor: "pointer", fontSize: "0.85rem" },
  btnGray:     { padding: "0.4rem 0.875rem", background: "#f9fafb", color: "#374151", border: "1px solid #d1d5db", borderRadius: "6px", cursor: "pointer", fontSize: "0.85rem" },
  btnDanger:   { padding: "0.4rem 0.875rem", background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: "6px", cursor: "pointer", fontSize: "0.85rem" },
  btnBlue:     { padding: "0.4rem 0.875rem", background: "#eff6ff", color: "#2563eb", border: "1px solid #bfdbfe", borderRadius: "6px", cursor: "pointer", fontSize: "0.85rem" },
  btnCancel:   { padding: "0.4rem 0.875rem", background: "#f9fafb", color: "#374151", border: "1px solid #d1d5db", borderRadius: "6px", cursor: "pointer" },
};

const modalOverlay = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 1000, overflowY: "auto", padding: "2rem 1rem" };
const modalBox     = { background: "#fff", borderRadius: "16px", width: "100%" };
const modalHead    = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1.25rem 1.5rem", borderBottom: "1px solid #e5e7eb" };
const modalFormSt  = { padding: "1.5rem", display: "flex", flexDirection: "column", gap: "0.875rem" };
const closeBtnSt   = { background: "none", border: "none", cursor: "pointer", fontSize: "1.1rem", color: "#6b7280" };
const inputSt      = { padding: "0.6rem 0.75rem", border: "1.5px solid #d1d5db", borderRadius: "8px", fontSize: "0.875rem", width: "100%", boxSizing: "border-box" };
const errSt        = { background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", padding: "0.6rem", color: "#dc2626", fontSize: "0.85rem" };