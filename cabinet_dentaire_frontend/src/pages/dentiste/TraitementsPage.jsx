/**
 * src/pages/dentiste/TraitementsPage.jsx
 * ──────────────────────────────────────────
 * Gestion complète des traitements dentaires.
 *
 * Connexion backend :
 *   GET    /api/treatments/                        → liste
 *   POST   /api/treatments/                        → créer
 *   GET    /api/treatments/{id}/                   → détail + séances
 *   PATCH  /api/treatments/{id}/                   → modifier
 *   DELETE /api/treatments/{id}/                   → soft delete
 *   GET    /api/treatments/stats/                  → stats
 *   GET    /api/treatments/par-patient/{id}/       → par patient
 *   POST   /api/treatments/{id}/seances/           → ajouter séance
 *   GET    /api/treatments/{id}/seances/           → liste séances
 *   PATCH  /api/treatments/{id}/demarrer/          → PLANIFIE→EN_COURS
 *   PATCH  /api/treatments/{id}/terminer/          → TERMINE
 *   PATCH  /api/treatments/{id}/abandonner/        → ABANDONNE
 *
 * Types d'actes backend (TypeActe) :
 *   DETARTRAGE, OBTURATION, EXTRACTION, COURONNE, BRIDGE,
 *   IMPLANT, BLANCHIMENT, ORTHODONTIE, TRAITEMENT_CANAL, AUTRE
 */

import { useEffect, useState, useCallback } from "react";
import {
  getTraitements, createTraitement, getTraitement,
  demarrerTraitement, terminerTraitement, abandonnerTraitement,
  ajouterSeance, getSeances, deleteTraitement, getTraitementStats,
} from "../../api/traitementsAPI";
import { getPatients } from "../../api/patientsAPI";

const STATUT_CONFIG = {
  PLANIFIE:  { bg: "#eff6ff", color: "#2563eb",  label: "Planifié" },
  EN_COURS:  { bg: "#fffbeb", color: "#d97706",  label: "En cours" },
  TERMINE:   { bg: "#ecfdf5", color: "#059669",  label: "Terminé" },
  ABANDONNE: { bg: "#fef2f2", color: "#dc2626",  label: "Abandonné" },
};

const TYPES_ACTE = [
  "DETARTRAGE", "OBTURATION", "EXTRACTION", "COURONNE",
  "BRIDGE", "IMPLANT", "BLANCHIMENT", "ORTHODONTIE",
  "TRAITEMENT_CANAL", "AUTRE",
];

const DENTS = Array.from({ length: 32 }, (_, i) => i + 1);

export default function TraitementsPage() {
  const [traitements, setTraitements] = useState([]);
  const [stats,       setStats]       = useState(null);
  const [patients,    setPatients]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [selected,    setSelected]    = useState(null);
  const [seances,     setSeances]     = useState([]);
  const [seancesLoading, setSeancesLoading] = useState(false);

  // Formulaire création traitement
  const [showForm, setShowForm] = useState(false);
  const [form,     setForm]     = useState({
    patient_id: "", type_acte: "DETARTRAGE", numero_dent: "",
    description: "", notes: "", montant: "",
  });
  const [formErrors,   setFormErrors]   = useState({});
  const [submitting,   setSubmitting]   = useState(false);

  // Formulaire séance
  const [showSeanceForm, setShowSeanceForm] = useState(false);
  const [seanceForm,     setSeanceForm]     = useState({ notes: "", duree_minutes: "30", montant_seance: "" });
  const [seanceSubmitting, setSeanceSubmitting] = useState(false);

  // Filtres
  const [filterPatient, setFilterPatient] = useState("");
  const [filterStatut,  setFilterStatut]  = useState("");

  // Actions en cours
  const [actionId, setActionId] = useState(null);

  // ── Chargement ────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterPatient) params.patient_id = filterPatient;
      if (filterStatut)  params.statut     = filterStatut;

      const [tData, sData] = await Promise.all([
        getTraitements(params),
        getTraitementStats(),
      ]);
      setTraitements(tData.results || tData);
      setStats(sData);
    } finally { setLoading(false); }
  }, [filterPatient, filterStatut]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    getPatients({ ordering: "nom" })
      .then(d => setPatients(d.results || d))
      .catch(() => {});
  }, []);

  // ── Sélection : charger séances ───────────────────────────────────

  const handleSelect = async (t) => {
    setSelected(t);
    setSeancesLoading(true);
    try {
      const data = await getSeances(t.id);
      setSeances(data.results || data);
    } catch { setSeances([]); }
    finally { setSeancesLoading(false); }
  };

  // ── Créer traitement ──────────────────────────────────────────────

  const handleCreate = async (e) => {
    e.preventDefault();
    setSubmitting(true); setFormErrors({});
    try {
      const payload = { ...form };
      if (!payload.montant)     delete payload.montant;
      if (!payload.numero_dent) delete payload.numero_dent;
      const created = await createTraitement(payload);
      setShowForm(false);
      setForm({ patient_id: "", type_acte: "DETARTRAGE", numero_dent: "", description: "", notes: "", montant: "" });
      load();
      handleSelect(created);
    } catch (err) {
      setFormErrors(err.response?.data || {});
    } finally { setSubmitting(false); }
  };

  // ── Actions statut ────────────────────────────────────────────────

  const handleAction = async (action, id) => {
    setActionId(id);
    try {
      if (action === "demarrer")  await demarrerTraitement(id);
      if (action === "terminer")  await terminerTraitement(id);
      if (action === "abandonner") {
        const raison = window.prompt("Raison de l'abandon :");
        if (!raison) { setActionId(null); return; }
        await abandonnerTraitement(id, raison);
      }
      load();
      // Rafraîchir le selected
      if (selected?.id === id) {
        const updated = await getTraitement(id);
        setSelected(updated);
      }
    } catch (err) {
      alert(err.response?.data?.detail || "Erreur");
    } finally { setActionId(null); }
  };

  // ── Ajouter séance ────────────────────────────────────────────────

  const handleAddSeance = async (e) => {
    e.preventDefault();
    if (!selected) return;
    setSeanceSubmitting(true);
    try {
      const payload = { ...seanceForm };
      if (!payload.montant_seance) delete payload.montant_seance;
      payload.duree_minutes = parseInt(payload.duree_minutes);
      await ajouterSeance(selected.id, payload);
      setShowSeanceForm(false);
      setSeanceForm({ notes: "", duree_minutes: "30", montant_seance: "" });
      // Rafraîchir séances
      const data = await getSeances(selected.id);
      setSeances(data.results || data);
    } catch (err) {
      alert(err.response?.data?.detail || "Erreur ajout séance");
    } finally { setSeanceSubmitting(false); }
  };

  // ── Supprimer ─────────────────────────────────────────────────────

  const handleDelete = async (id) => {
    if (!window.confirm("Supprimer ce traitement ?")) return;
    try {
      await deleteTraitement(id);
      if (selected?.id === id) setSelected(null);
      load();
    } catch (err) {
      alert(err.response?.data?.detail || "Erreur suppression");
    }
  };

  // ── Rendu ──────────────────────────────────────────────────────────

  return (
    <div style={styles.page}>

      {/* Stats */}
      {stats && (
        <div style={styles.statsRow}>
          {[
            { label: "Total",      value: stats.total,     color: "#0f4c81", bg: "#e8f4fd" },
            { label: "En cours",   value: stats.en_cours,  color: "#d97706", bg: "#fffbeb" },
            { label: "Terminés",   value: stats.termines,  color: "#059669", bg: "#ecfdf5" },
            { label: "Planifiés",  value: stats.planifies, color: "#2563eb", bg: "#eff6ff" },
          ].map(c => (
            <div key={c.label} style={{ background: c.bg, borderRadius: "10px", padding: "0.875rem 1rem", textAlign: "center", minWidth: "100px" }}>
              <div style={{ fontSize: "1.5rem", fontWeight: 700, color: c.color }}>{c.value ?? "—"}</div>
              <div style={{ fontSize: "0.75rem", color: "#6b7280", fontWeight: 500 }}>{c.label}</div>
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
        <button onClick={() => setShowForm(true)} style={styles.addBtn}>+ Nouveau traitement</button>
      </div>

      {/* Layout liste + détail */}
      <div style={styles.split}>

        {/* Liste */}
        <div style={styles.listPanel}>
          {loading ? (
            <p style={{ color: "#6b7280", padding: "1rem" }}>Chargement...</p>
          ) : traitements.length === 0 ? (
            <p style={{ color: "#6b7280", padding: "2rem", textAlign: "center" }}>Aucun traitement.</p>
          ) : (
            traitements.map(t => {
              const sc = STATUT_CONFIG[t.statut] || STATUT_CONFIG.PLANIFIE;
              const isSelected = selected?.id === t.id;
              return (
                <div
                  key={t.id}
                  onClick={() => handleSelect(t)}
                  style={{ ...styles.card, ...(isSelected ? styles.cardSelected : {}) }}
                >
                  <div style={styles.cardLeft}>
                    <div style={{ ...styles.statutDot, background: sc.color }} />
                  </div>
                  <div style={styles.cardBody}>
                    <div style={styles.cardTitle}>
                      {t.type_acte?.replace(/_/g, " ")}
                      {t.numero_dent && <span style={styles.dentBadge}>Dent {t.numero_dent}</span>}
                    </div>
                    <div style={styles.cardMeta}>{t.patient_nom || "—"}</div>
                    <div style={styles.cardMeta2}>{t.nb_seances ?? 0} séance(s)</div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px" }}>
                    <span style={{ ...styles.statutPill, background: sc.bg, color: sc.color }}>
                      {sc.label}
                    </span>
                    {t.montant_total && (
                      <span style={{ fontSize: "0.78rem", color: "#6b7280" }}>{t.montant_total} DA</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Détail */}
        <div style={styles.detailPanel}>
          {!selected ? (
            <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af" }}>
              Sélectionnez un traitement
            </div>
          ) : (
            <div style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "1rem" }}>

              {/* En-tête */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <h3 style={{ margin: "0 0 4px", fontSize: "1rem", fontWeight: 700 }}>
                    {selected.type_acte?.replace(/_/g, " ")}
                    {selected.numero_dent && (
                      <span style={{ marginLeft: "8px", background: "#dbeafe", color: "#1e40af", padding: "2px 8px", borderRadius: "10px", fontSize: "0.8rem" }}>
                        Dent {selected.numero_dent}
                      </span>
                    )}
                  </h3>
                  <div style={{ fontSize: "0.85rem", color: "#6b7280" }}>{selected.patient_nom}</div>
                </div>
                <span style={{ ...styles.statutPill, background: STATUT_CONFIG[selected.statut]?.bg, color: STATUT_CONFIG[selected.statut]?.color }}>
                  {STATUT_CONFIG[selected.statut]?.label}
                </span>
              </div>

              {/* Infos */}
              {selected.description && (
                <p style={{ margin: 0, fontSize: "0.875rem", color: "#374151", background: "#f9fafb", padding: "0.75rem", borderRadius: "8px" }}>
                  {selected.description}
                </p>
              )}

              {/* Boutons actions statut */}
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                {selected.statut === "PLANIFIE" && (
                  <button onClick={() => handleAction("demarrer", selected.id)} disabled={actionId === selected.id} style={styles.btnBlue}>
                    ▶ Démarrer
                  </button>
                )}
                {selected.statut === "EN_COURS" && (
                  <>
                    <button onClick={() => handleAction("terminer", selected.id)} disabled={actionId === selected.id} style={styles.btnGreen}>
                      ✓ Terminer
                    </button>
                    <button onClick={() => handleAction("abandonner", selected.id)} disabled={actionId === selected.id} style={styles.btnOrange}>
                      ✗ Abandonner
                    </button>
                  </>
                )}
                {selected.statut !== "TERMINE" && selected.statut !== "ABANDONNE" && (
                  <button onClick={() => setShowSeanceForm(true)} style={styles.btnPurple}>
                    + Séance
                  </button>
                )}
                <button onClick={() => handleDelete(selected.id)} style={styles.btnDanger}>
                  Supprimer
                </button>
              </div>

              {/* Séances */}
              <div>
                <h4 style={{ margin: "0 0 0.75rem", fontSize: "0.9rem", fontWeight: 600, color: "#374151" }}>
                  Séances ({seances.length})
                </h4>
                {seancesLoading ? (
                  <p style={{ color: "#6b7280", fontSize: "0.875rem" }}>Chargement...</p>
                ) : seances.length === 0 ? (
                  <p style={{ color: "#6b7280", fontSize: "0.875rem" }}>Aucune séance enregistrée.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    {seances.map((s, i) => (
                      <div key={s.id || i} style={styles.seanceCard}>
                        <div>
                          <div style={{ fontSize: "0.85rem", fontWeight: 500 }}>
                            Séance {i + 1} — {s.date?.slice(0, 10) || s.created_at?.slice(0, 10)}
                          </div>
                          {s.notes && <div style={{ fontSize: "0.8rem", color: "#4b5563", marginTop: "2px" }}>{s.notes}</div>}
                        </div>
                        <div style={{ textAlign: "right" }}>
                          {s.duree_minutes && <div style={{ fontSize: "0.78rem", color: "#6b7280" }}>{s.duree_minutes} min</div>}
                          {s.montant_seance && <div style={{ fontSize: "0.78rem", color: "#059669" }}>{s.montant_seance} DA</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Formulaire nouvelle séance inline */}
              {showSeanceForm && (
                <form onSubmit={handleAddSeance} style={styles.seanceForm}>
                  <strong style={{ fontSize: "0.85rem" }}>Nouvelle séance</strong>
                  <textarea
                    placeholder="Notes..."
                    value={seanceForm.notes}
                    onChange={e => setSeanceForm(f => ({ ...f, notes: e.target.value }))}
                    rows={2}
                    style={styles.seanceInput}
                  />
                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    <input
                      type="number" min="1" placeholder="Durée (min)"
                      value={seanceForm.duree_minutes}
                      onChange={e => setSeanceForm(f => ({ ...f, duree_minutes: e.target.value }))}
                      style={{ ...styles.seanceInput, flex: 1 }}
                    />
                    <input
                      type="number" min="0" step="0.01" placeholder="Montant (DA)"
                      value={seanceForm.montant_seance}
                      onChange={e => setSeanceForm(f => ({ ...f, montant_seance: e.target.value }))}
                      style={{ ...styles.seanceInput, flex: 1 }}
                    />
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button type="button" onClick={() => setShowSeanceForm(false)} style={styles.btnCancel}>Annuler</button>
                    <button type="submit" disabled={seanceSubmitting} style={styles.btnGreen}>
                      {seanceSubmitting ? "..." : "Enregistrer séance"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modale création traitement */}
      {showForm && (
        <div style={modalOverlay} onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div style={modalBox}>
            <div style={modalHead}>
              <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700 }}>Nouveau traitement</h2>
              <button onClick={() => setShowForm(false)} style={closeBtnStyle}>✕</button>
            </div>
            <form onSubmit={handleCreate} style={modalForm}>
              {formErrors.non_field_errors && (
                <div style={errStyle}>{formErrors.non_field_errors[0]}</div>
              )}
              <FField label="Patient *" error={formErrors.patient_id}>
                <select value={form.patient_id} onChange={e => setForm(f => ({ ...f, patient_id: e.target.value }))} required style={inputSt}>
                  <option value="">Sélectionner</option>
                  {patients.map(p => <option key={p.id} value={p.id}>{p.nom_complet}</option>)}
                </select>
              </FField>
              <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                <FField label="Type d'acte *" error={formErrors.type_acte}>
                  <select value={form.type_acte} onChange={e => setForm(f => ({ ...f, type_acte: e.target.value }))} style={inputSt}>
                    {TYPES_ACTE.map(t => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
                  </select>
                </FField>
                <FField label="Numéro de dent" error={formErrors.numero_dent}>
                  <select value={form.numero_dent} onChange={e => setForm(f => ({ ...f, numero_dent: e.target.value }))} style={inputSt}>
                    <option value="">—</option>
                    {DENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </FField>
              </div>
              <FField label="Description" error={formErrors.description}>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} placeholder="Détails du traitement..." style={{ ...inputSt, resize: "vertical", fontFamily: "inherit" }} />
              </FField>
              <FField label="Montant estimé (DA)" error={formErrors.montant}>
                <input type="number" min="0" step="0.01" value={form.montant} onChange={e => setForm(f => ({ ...f, montant: e.target.value }))} style={inputSt} />
              </FField>
              <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
                <button type="button" onClick={() => setShowForm(false)} style={styles.btnCancel}>Annuler</button>
                <button type="submit" disabled={submitting} style={{ padding: "0.6rem 1.5rem", background: "#0f4c81", color: "#fff", border: "none", borderRadius: "8px", fontWeight: 600, cursor: "pointer" }}>
                  {submitting ? "..." : "Créer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function FField({ label, error, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem", flex: 1 }}>
      <label style={{ fontSize: "0.8rem", fontWeight: 500, color: "#374151" }}>{label}</label>
      {children}
      {error && <span style={{ fontSize: "0.75rem", color: "#dc2626" }}>{Array.isArray(error) ? error[0] : error}</span>}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = {
  page:        { display: "flex", flexDirection: "column", gap: "1rem" },
  statsRow:    { display: "flex", gap: "1rem", flexWrap: "wrap" },
  toolbar:     { display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" },
  select:      { padding: "0.6rem 0.875rem", border: "1.5px solid #d1d5db", borderRadius: "8px", fontSize: "0.875rem", background: "#fff" },
  addBtn:      { padding: "0.6rem 1.25rem", background: "#0f4c81", color: "#fff", border: "none", borderRadius: "8px", fontWeight: 600, cursor: "pointer", marginLeft: "auto" },
  split:       { display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: "1.25rem", minHeight: "500px" },
  listPanel:   { display: "flex", flexDirection: "column", gap: "0.5rem", overflowY: "auto", maxHeight: "600px" },
  card:        { display: "flex", gap: "0.75rem", padding: "0.875rem", background: "#fff", border: "1.5px solid #e5e7eb", borderRadius: "10px", cursor: "pointer", alignItems: "center" },
  cardSelected:{ borderColor: "#0f4c81", background: "#f0f7ff" },
  cardLeft:    { flexShrink: 0 },
  statutDot:   { width: "10px", height: "10px", borderRadius: "50%" },
  cardBody:    { flex: 1, minWidth: 0 },
  cardTitle:   { fontSize: "0.875rem", fontWeight: 600, color: "#111827", display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" },
  dentBadge:   { background: "#dbeafe", color: "#1e40af", padding: "1px 7px", borderRadius: "10px", fontSize: "0.72rem" },
  cardMeta:    { fontSize: "0.8rem", color: "#6b7280" },
  cardMeta2:   { fontSize: "0.75rem", color: "#9ca3af" },
  statutPill:  { padding: "3px 10px", borderRadius: "12px", fontSize: "0.75rem", fontWeight: 600, whiteSpace: "nowrap" },
  detailPanel: { background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", overflow: "auto" },
  seanceCard:  { display: "flex", justifyContent: "space-between", padding: "0.6rem 0.875rem", background: "#f9fafb", borderRadius: "8px", gap: "1rem" },
  seanceForm:  { background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "10px", padding: "0.875rem", display: "flex", flexDirection: "column", gap: "0.6rem" },
  seanceInput: { padding: "0.5rem 0.75rem", border: "1.5px solid #d1d5db", borderRadius: "8px", fontSize: "0.875rem", width: "100%", boxSizing: "border-box", fontFamily: "inherit" },
  btnBlue:   { padding: "0.4rem 0.875rem", background: "#eff6ff", color: "#2563eb", border: "1px solid #bfdbfe", borderRadius: "6px", cursor: "pointer", fontSize: "0.85rem", fontWeight: 500 },
  btnGreen:  { padding: "0.4rem 0.875rem", background: "#ecfdf5", color: "#059669", border: "1px solid #a7f3d0", borderRadius: "6px", cursor: "pointer", fontSize: "0.85rem", fontWeight: 500 },
  btnOrange: { padding: "0.4rem 0.875rem", background: "#fffbeb", color: "#d97706", border: "1px solid #fed7aa", borderRadius: "6px", cursor: "pointer", fontSize: "0.85rem", fontWeight: 500 },
  btnPurple: { padding: "0.4rem 0.875rem", background: "#f5f3ff", color: "#7c3aed", border: "1px solid #ddd6fe", borderRadius: "6px", cursor: "pointer", fontSize: "0.85rem", fontWeight: 500 },
  btnDanger: { padding: "0.4rem 0.875rem", background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: "6px", cursor: "pointer", fontSize: "0.85rem" },
  btnCancel: { padding: "0.4rem 0.875rem", background: "#f9fafb", color: "#374151", border: "1px solid #d1d5db", borderRadius: "6px", cursor: "pointer", fontSize: "0.85rem" },
};

const modalOverlay = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 1000, overflowY: "auto", padding: "2rem 1rem" };
const modalBox     = { background: "#fff", borderRadius: "16px", width: "100%", maxWidth: "520px" };
const modalHead    = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1.25rem 1.5rem", borderBottom: "1px solid #e5e7eb" };
const modalForm    = { padding: "1.5rem", display: "flex", flexDirection: "column", gap: "0.875rem" };
const closeBtnStyle= { background: "none", border: "none", cursor: "pointer", fontSize: "1.1rem", color: "#6b7280" };
const inputSt      = { padding: "0.6rem 0.75rem", border: "1.5px solid #d1d5db", borderRadius: "8px", fontSize: "0.9rem", width: "100%", boxSizing: "border-box" };
const errStyle     = { background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", padding: "0.6rem", color: "#dc2626", fontSize: "0.85rem" };