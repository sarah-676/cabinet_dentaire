/**
 * src/pages/dentiste/RadiosPage.jsx
 * ────────────────────────────────────
 * Gestion complète des radiographies.
 *
 * Connexion backend :
 *   GET    /api/radios/                  → liste (filtrée par dentiste depuis JWT)
 *   POST   /api/radios/                  → upload multipart/form-data
 *                                           champs : image, patient_id, type_radio, description
 *   GET    /api/radios/{id}/             → détail + résultat IA (ia_resultat, ia_anomalies, ia_confidence)
 *   PATCH  /api/radios/{id}/             → modifier description / type
 *   DELETE /api/radios/{id}/             → soft delete
 *   POST   /api/radios/{id}/analyser/    → déclenche analyse IA (ia_service)
 *   GET    /api/radios/stats/            → { total, analysees, en_attente, avec_anomalies, par_type }
 *
 * Filtres query params supportés :
 *   ?patient_id=<uuid>
 *   ?statut_analyse=EN_ATTENTE|EN_COURS|ANALYSE|ERREUR
 *   ?type_radio=PANORAMIQUE|RETRO_ALVEOLAIRE|CONE_BEAM|...
 */

import { useEffect, useState, useCallback } from "react";
import {
  getRadios, uploadRadio, analyserRadio, deleteRadio, getRadioStats,
} from "../../api/radiosAPI";
import { getPatients } from "../../api/patientsAPI";

const STATUT_CONFIG = {
  EN_ATTENTE: { bg: "#fffbeb", color: "#d97706", label: "En attente" },
  EN_COURS:   { bg: "#eff6ff", color: "#2563eb", label: "En cours" },
  ANALYSE:    { bg: "#ecfdf5", color: "#059669", label: "Analysée" },
  ERREUR:     { bg: "#fef2f2", color: "#dc2626", label: "Erreur" },
};

const TYPES_RADIO = [
  "PANORAMIQUE", "RETRO_ALVEOLAIRE", "CONE_BEAM", "CEPHALOMETRIQUE", "AUTRE",
];

export default function RadiosPage() {
  const [radios,    setRadios]    = useState([]);
  const [stats,     setStats]     = useState(null);
  const [patients,  setPatients]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [showUpload,setShowUpload]= useState(false);
  const [selected,  setSelected]  = useState(null); // détail radio

  // Filtres
  const [filterPatient, setFilterPatient] = useState("");
  const [filterStatut,  setFilterStatut]  = useState("");
  const [filterType,    setFilterType]    = useState("");

  // Upload form
  const [uploadForm, setUploadForm] = useState({
    patient_id: "", type_radio: "PANORAMIQUE", description: "",
  });
  const [uploadFile,     setUploadFile]     = useState(null);
  const [uploadLoading,  setUploadLoading]  = useState(false);
  const [uploadErrors,   setUploadErrors]   = useState({});

  // Analyse IA
  const [analyzingId, setAnalyzingId] = useState(null);
  const [deletingId,  setDeletingId]  = useState(null);

  // ── Chargement ────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterPatient) params.patient_id     = filterPatient;
      if (filterStatut)  params.statut_analyse = filterStatut;
      if (filterType)    params.type_radio      = filterType;

      const [rData, sData] = await Promise.all([
        getRadios(params),
        getRadioStats(),
      ]);
      setRadios(rData.results || rData);
      setStats(sData);
    } finally { setLoading(false); }
  }, [filterPatient, filterStatut, filterType]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    getPatients({ ordering: "nom" })
      .then(d => setPatients(d.results || d))
      .catch(() => {});
  }, []);

  // ── Upload ─────────────────────────────────────────────────────────

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!uploadFile) { setUploadErrors({ image: ["Veuillez choisir une image."] }); return; }
    setUploadLoading(true);
    setUploadErrors({});
    try {
      const fd = new FormData();
      fd.append("image",      uploadFile);
      fd.append("patient_id", uploadForm.patient_id);
      fd.append("type_radio", uploadForm.type_radio);
      if (uploadForm.description) fd.append("description", uploadForm.description);

      await uploadRadio(fd);
      setShowUpload(false);
      setUploadForm({ patient_id: "", type_radio: "PANORAMIQUE", description: "" });
      setUploadFile(null);
      load();
    } catch (err) {
      setUploadErrors(err.response?.data || { detail: ["Erreur upload."] });
    } finally { setUploadLoading(false); }
  };

  // ── Analyse IA ─────────────────────────────────────────────────────

  const handleAnalyse = async (id) => {
    setAnalyzingId(id);
    try {
      const result = await analyserRadio(id);
      // Mettre à jour la radio dans la liste localement
      setRadios(prev =>
        prev.map(r => r.id === id ? { ...r, statut_analyse: "ANALYSE", ...result } : r)
      );
      // Si c'est la radio sélectionnée, mettre à jour le détail
      if (selected?.id === id) setSelected(result);
    } catch (err) {
      const msg = err.response?.data?.detail || "Erreur analyse IA.";
      alert(msg);
      // Rafraîchir pour obtenir le statut ERREUR
      load();
    } finally { setAnalyzingId(null); }
  };

  // ── Suppression ────────────────────────────────────────────────────

  const handleDelete = async (id, nom) => {
    if (!window.confirm(`Supprimer cette radiographie ?`)) return;
    setDeletingId(id);
    try {
      await deleteRadio(id);
      setRadios(prev => prev.filter(r => r.id !== id));
      if (selected?.id === id) setSelected(null);
      load(); // rafraîchir les stats
    } finally { setDeletingId(null); }
  };

  // ── Rendu ──────────────────────────────────────────────────────────

  return (
    <div style={styles.page}>

      {/* ── Stats ── */}
      {stats && (
        <div style={styles.statsRow}>
          <StatChip label="Total"          value={stats.total}          color="#0f4c81" bg="#e8f4fd" />
          <StatChip label="Analysées"      value={stats.analysees}      color="#059669" bg="#ecfdf5" />
          <StatChip label="En attente"     value={stats.en_attente}     color="#d97706" bg="#fffbeb" />
          <StatChip label="Avec anomalies" value={stats.avec_anomalies} color="#dc2626" bg="#fef2f2" />
        </div>
      )}

      {/* ── Barre outils ── */}
      <div style={styles.toolbar}>
        <select value={filterPatient} onChange={e => setFilterPatient(e.target.value)} style={styles.select}>
          <option value="">Tous les patients</option>
          {patients.map(p => <option key={p.id} value={p.id}>{p.nom_complet}</option>)}
        </select>

        <select value={filterStatut} onChange={e => setFilterStatut(e.target.value)} style={styles.select}>
          <option value="">Tous les statuts</option>
          {Object.entries(STATUT_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>

        <select value={filterType} onChange={e => setFilterType(e.target.value)} style={styles.select}>
          <option value="">Tous les types</option>
          {TYPES_RADIO.map(t => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
        </select>

        <button onClick={() => setShowUpload(true)} style={styles.addBtn}>
          + Upload radio
        </button>
      </div>

      {/* ── Layout 2 colonnes : liste + détail ── */}
      <div style={styles.splitLayout}>

        {/* Liste */}
        <div style={styles.listPanel}>
          {loading ? (
            <p style={{ color: "#6b7280", padding: "1rem" }}>Chargement...</p>
          ) : radios.length === 0 ? (
            <div style={styles.emptyState}>
              <p>Aucune radiographie trouvée.</p>
            </div>
          ) : (
            radios.map(radio => {
              const sc = STATUT_CONFIG[radio.statut_analyse] || STATUT_CONFIG.EN_ATTENTE;
              const isSelected = selected?.id === radio.id;
              return (
                <div
                  key={radio.id}
                  onClick={() => setSelected(radio)}
                  style={{
                    ...styles.radioCard,
                    ...(isSelected ? styles.radioCardSelected : {}),
                  }}
                >
                  {/* Miniature */}
                  <div style={styles.thumbnail}>
                    {radio.image_url ? (
                      <img
                        src={radio.image_url}
                        alt="radio"
                        style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "6px" }}
                      />
                    ) : (
                      <div style={styles.thumbnailPlaceholder}>🩻</div>
                    )}
                  </div>

                  {/* Info */}
                  <div style={styles.radioInfo}>
                    <div style={styles.radioTop}>
                      <span style={styles.radioType}>{radio.type_radio?.replace(/_/g, " ")}</span>
                      <span style={{ ...styles.statutPill, background: sc.bg, color: sc.color }}>
                        {sc.label}
                      </span>
                    </div>
                    <div style={styles.radioPatient}>{radio.patient_nom || "—"}</div>
                    <div style={styles.radioDate}>{radio.date_prise || radio.created_at?.slice(0, 10)}</div>
                    {radio.ia_anomalies_detectees && (
                      <span style={styles.anomalieBadge}>⚠ Anomalie détectée</span>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={styles.radioActions} onClick={e => e.stopPropagation()}>
                    {radio.statut_analyse !== "ANALYSE" && radio.statut_analyse !== "EN_COURS" && (
                      <button
                        onClick={() => handleAnalyse(radio.id)}
                        disabled={analyzingId === radio.id}
                        style={styles.iaBtn}
                        title="Analyser avec IA"
                      >
                        {analyzingId === radio.id ? "…" : "🤖"}
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(radio.id)}
                      disabled={deletingId === radio.id}
                      style={styles.delBtn}
                      title="Supprimer"
                    >
                      {deletingId === radio.id ? "…" : "✕"}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Détail */}
        <div style={styles.detailPanel}>
          {!selected ? (
            <div style={styles.detailEmpty}>
              <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🩻</div>
              <p style={{ color: "#9ca3af" }}>Sélectionnez une radio pour voir le détail</p>
            </div>
          ) : (
            <RadioDetail
              radio={selected}
              onAnalyse={() => handleAnalyse(selected.id)}
              analyzing={analyzingId === selected.id}
            />
          )}
        </div>

      </div>

      {/* ── Modale upload ── */}
      {showUpload && (
        <div style={modalStyles.overlay} onClick={e => e.target === e.currentTarget && setShowUpload(false)}>
          <div style={modalStyles.modal}>
            <div style={modalStyles.header}>
              <h2 style={modalStyles.title}>Uploader une radiographie</h2>
              <button onClick={() => setShowUpload(false)} style={modalStyles.closeBtn}>✕</button>
            </div>
            <form onSubmit={handleUpload} style={modalStyles.form}>
              {uploadErrors.detail && (
                <div style={modalStyles.errBanner}>{uploadErrors.detail[0] || uploadErrors.detail}</div>
              )}

              <FField label="Patient *" error={uploadErrors.patient_id}>
                <select
                  value={uploadForm.patient_id}
                  onChange={e => setUploadForm(f => ({ ...f, patient_id: e.target.value }))}
                  required style={modalStyles.input}
                >
                  <option value="">Sélectionner un patient</option>
                  {patients.map(p => <option key={p.id} value={p.id}>{p.nom_complet}</option>)}
                </select>
              </FField>

              <FField label="Type de radio *" error={uploadErrors.type_radio}>
                <select
                  value={uploadForm.type_radio}
                  onChange={e => setUploadForm(f => ({ ...f, type_radio: e.target.value }))}
                  style={modalStyles.input}
                >
                  {TYPES_RADIO.map(t => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
                </select>
              </FField>

              <FField label="Image * (JPG, PNG)" error={uploadErrors.image}>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={e => setUploadFile(e.target.files[0])}
                  required
                  style={{ fontSize: "0.875rem" }}
                />
                {uploadFile && (
                  <span style={{ fontSize: "0.75rem", color: "#059669" }}>
                    ✓ {uploadFile.name} ({(uploadFile.size / 1024).toFixed(0)} Ko)
                  </span>
                )}
              </FField>

              <FField label="Description" error={uploadErrors.description}>
                <textarea
                  value={uploadForm.description}
                  onChange={e => setUploadForm(f => ({ ...f, description: e.target.value }))}
                  rows={3}
                  placeholder="Observations, contexte..."
                  style={modalStyles.textarea}
                />
              </FField>

              <div style={modalStyles.actions}>
                <button type="button" onClick={() => setShowUpload(false)} style={modalStyles.cancelBtn}>
                  Annuler
                </button>
                <button type="submit" disabled={uploadLoading} style={modalStyles.submitBtn}>
                  {uploadLoading ? "Upload en cours..." : "Uploader"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Composant détail radio ────────────────────────────────────────────────────

function RadioDetail({ radio, onAnalyse, analyzing }) {
  const sc = STATUT_CONFIG[radio.statut_analyse] || STATUT_CONFIG.EN_ATTENTE;

  return (
    <div style={detailStyles.container}>
      <div style={detailStyles.imageWrap}>
        {radio.image_url ? (
          <img src={radio.image_url} alt="radiographie" style={detailStyles.image} />
        ) : (
          <div style={detailStyles.noImage}>🩻 Image non disponible</div>
        )}
      </div>

      <div style={detailStyles.infoBlock}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={detailStyles.radioTitle}>{radio.type_radio?.replace(/_/g, " ")}</h3>
          <span style={{ ...detailStyles.statPill, background: sc.bg, color: sc.color }}>
            {sc.label}
          </span>
        </div>
        <InfoRow label="Patient"    value={radio.patient_nom || "—"} />
        <InfoRow label="Date"       value={radio.date_prise || radio.created_at?.slice(0, 10)} />
        <InfoRow label="Description"value={radio.description || "—"} />
      </div>

      {/* Résultat IA */}
      {radio.statut_analyse === "ANALYSE" && radio.ia_resultat ? (
        <div style={detailStyles.iaBlock}>
          <h4 style={detailStyles.iaTitle}>
            🤖 Résultat IA
            {radio.ia_confidence && (
              <span style={detailStyles.confidence}>
                Confiance : {(radio.ia_confidence * 100).toFixed(0)}%
              </span>
            )}
          </h4>
          <p style={detailStyles.iaResultat}>{radio.ia_resultat}</p>

          {radio.ia_anomalies && radio.ia_anomalies.length > 0 && (
            <div style={detailStyles.anomaliesList}>
              <strong style={{ fontSize: "0.8rem", color: "#374151" }}>
                Anomalies détectées ({radio.ia_anomalies.length}) :
              </strong>
              {radio.ia_anomalies.map((a, i) => (
                <div key={i} style={detailStyles.anomalieItem}>
                  <span style={detailStyles.anomalieType}>{a.type}</span>
                  <span style={detailStyles.anomalieDent}>Dent {a.dent}</span>
                  <span style={detailStyles.anomalieConf}>
                    {(a.confidence * 100).toFixed(0)}%
                  </span>
                  <span style={detailStyles.anomalieDesc}>{a.description}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : radio.statut_analyse === "ERREUR" ? (
        <div style={detailStyles.erreurBlock}>
          <strong>Erreur lors de l'analyse IA.</strong>
          <button onClick={onAnalyse} disabled={analyzing} style={detailStyles.retryBtn}>
            {analyzing ? "Analyse en cours..." : "🔄 Réessayer"}
          </button>
        </div>
      ) : radio.statut_analyse !== "EN_COURS" ? (
        <div style={detailStyles.analyseBlock}>
          <p style={{ color: "#6b7280", fontSize: "0.875rem", margin: "0 0 0.75rem" }}>
            Cette radio n'a pas encore été analysée par l'IA.
          </p>
          <button onClick={onAnalyse} disabled={analyzing} style={detailStyles.analyseBtn}>
            {analyzing ? "⏳ Analyse en cours..." : "🤖 Lancer l'analyse IA"}
          </button>
        </div>
      ) : (
        <div style={detailStyles.analyseBlock}>
          <p style={{ color: "#2563eb", fontSize: "0.875rem" }}>⏳ Analyse IA en cours...</p>
        </div>
      )}
    </div>
  );
}

// ── Petits helpers ────────────────────────────────────────────────────────────

function StatChip({ label, value, color, bg }) {
  return (
    <div style={{ background: bg, borderRadius: "10px", padding: "0.875rem 1rem", textAlign: "center", minWidth: "100px" }}>
      <div style={{ fontSize: "1.5rem", fontWeight: 700, color }}>{value ?? "—"}</div>
      <div style={{ fontSize: "0.75rem", color: "#6b7280", fontWeight: 500 }}>{label}</div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div style={{ display: "flex", gap: "0.75rem", padding: "0.35rem 0", borderBottom: "1px solid #f3f4f6" }}>
      <span style={{ minWidth: "100px", fontSize: "0.78rem", color: "#6b7280", fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: "0.85rem", color: "#111827" }}>{value}</span>
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

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = {
  page:        { display: "flex", flexDirection: "column", gap: "1rem" },
  statsRow:    { display: "flex", gap: "1rem", flexWrap: "wrap" },
  toolbar:     { display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" },
  select:      { padding: "0.6rem 0.875rem", border: "1.5px solid #d1d5db", borderRadius: "8px", fontSize: "0.875rem", background: "#fff" },
  addBtn:      { padding: "0.6rem 1.25rem", background: "#0f4c81", color: "#fff", border: "none", borderRadius: "8px", fontWeight: 600, cursor: "pointer", marginLeft: "auto" },
  splitLayout: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem", minHeight: "500px" },
  listPanel:   { display: "flex", flexDirection: "column", gap: "0.5rem", overflowY: "auto", maxHeight: "600px" },
  emptyState:  { textAlign: "center", padding: "3rem 1rem", color: "#6b7280" },
  radioCard:   { display: "flex", gap: "0.875rem", padding: "0.875rem", background: "#fff", border: "1.5px solid #e5e7eb", borderRadius: "10px", cursor: "pointer", transition: "border-color 0.15s", alignItems: "flex-start" },
  radioCardSelected: { borderColor: "#0f4c81", background: "#f0f7ff" },
  thumbnail:   { width: "56px", height: "56px", flexShrink: 0, borderRadius: "6px", overflow: "hidden", background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center" },
  thumbnailPlaceholder: { fontSize: "1.5rem" },
  radioInfo:   { flex: 1, minWidth: 0 },
  radioTop:    { display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "4px", flexWrap: "wrap" },
  radioType:   { fontSize: "0.85rem", fontWeight: 600, color: "#111827" },
  statutPill:  { padding: "2px 8px", borderRadius: "10px", fontSize: "0.72rem", fontWeight: 600 },
  radioPatient:{ fontSize: "0.8rem", color: "#6b7280" },
  radioDate:   { fontSize: "0.75rem", color: "#9ca3af" },
  anomalieBadge:{ display: "inline-block", marginTop: "4px", background: "#fef2f2", color: "#dc2626", padding: "2px 7px", borderRadius: "10px", fontSize: "0.72rem", fontWeight: 600 },
  radioActions:{ display: "flex", flexDirection: "column", gap: "4px" },
  iaBtn:       { width: "28px", height: "28px", background: "#f5f3ff", color: "#7c3aed", border: "1px solid #ddd6fe", borderRadius: "6px", cursor: "pointer", fontSize: "0.85rem", display: "flex", alignItems: "center", justifyContent: "center" },
  delBtn:      { width: "28px", height: "28px", background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: "6px", cursor: "pointer", fontSize: "0.8rem", display: "flex", alignItems: "center", justifyContent: "center" },
  detailPanel: { background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", overflow: "hidden" },
  detailEmpty: { height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#9ca3af" },
};

const detailStyles = {
  container:    { display: "flex", flexDirection: "column", height: "100%" },
  imageWrap:    { background: "#111827", minHeight: "220px", display: "flex", alignItems: "center", justifyContent: "center" },
  image:        { maxWidth: "100%", maxHeight: "260px", objectFit: "contain" },
  noImage:      { color: "#6b7280", fontSize: "1.1rem" },
  infoBlock:    { padding: "1rem 1.25rem", borderBottom: "1px solid #f3f4f6" },
  radioTitle:   { margin: "0 0 0.75rem", fontSize: "1rem", fontWeight: 600 },
  statPill:     { padding: "3px 10px", borderRadius: "12px", fontSize: "0.75rem", fontWeight: 600 },
  iaBlock:      { padding: "1rem 1.25rem", background: "#f0fdf4", borderTop: "1px solid #bbf7d0", flex: 1 },
  iaTitle:      { margin: "0 0 0.5rem", fontSize: "0.9rem", fontWeight: 600, color: "#065f46", display: "flex", justifyContent: "space-between", alignItems: "center" },
  confidence:   { fontSize: "0.78rem", color: "#059669", fontWeight: 500 },
  iaResultat:   { fontSize: "0.875rem", color: "#064e3b", margin: "0 0 0.75rem", lineHeight: 1.5 },
  anomaliesList:{ display: "flex", flexDirection: "column", gap: "0.4rem", marginTop: "0.5rem" },
  anomalieItem: { display: "flex", gap: "0.5rem", alignItems: "center", background: "#fff", padding: "0.4rem 0.6rem", borderRadius: "6px", flexWrap: "wrap" },
  anomalieType: { background: "#fef3c7", color: "#92400e", padding: "1px 7px", borderRadius: "10px", fontSize: "0.75rem", fontWeight: 600 },
  anomalieDent: { fontSize: "0.78rem", color: "#374151", fontWeight: 500 },
  anomalieConf: { fontSize: "0.75rem", color: "#6b7280" },
  anomalieDesc: { fontSize: "0.78rem", color: "#4b5563", flex: 1 },
  erreurBlock:  { padding: "1rem 1.25rem", background: "#fef2f2", display: "flex", alignItems: "center", gap: "1rem" },
  retryBtn:     { padding: "0.4rem 0.9rem", background: "#0f4c81", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "0.85rem" },
  analyseBlock: { padding: "1.25rem", flex: 1 },
  analyseBtn:   { padding: "0.65rem 1.25rem", background: "#7c3aed", color: "#fff", border: "none", borderRadius: "8px", fontWeight: 600, cursor: "pointer", fontSize: "0.9rem" },
};

const modalStyles = {
  overlay:   { position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 1000, overflowY: "auto", padding: "2rem 1rem" },
  modal:     { background: "#fff", borderRadius: "16px", width: "100%", maxWidth: "500px" },
  header:    { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1.25rem 1.5rem", borderBottom: "1px solid #e5e7eb" },
  title:     { margin: 0, fontSize: "1.1rem", fontWeight: 700 },
  closeBtn:  { background: "none", border: "none", cursor: "pointer", fontSize: "1.1rem", color: "#6b7280" },
  form:      { padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" },
  input:     { padding: "0.6rem 0.75rem", border: "1.5px solid #d1d5db", borderRadius: "8px", fontSize: "0.9rem" },
  textarea:  { padding: "0.6rem 0.75rem", border: "1.5px solid #d1d5db", borderRadius: "8px", fontSize: "0.875rem", resize: "vertical", fontFamily: "inherit" },
  errBanner: { background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", padding: "0.6rem", color: "#dc2626", fontSize: "0.85rem" },
  actions:   { display: "flex", justifyContent: "flex-end", gap: "0.75rem" },
  cancelBtn: { padding: "0.6rem 1.25rem", border: "1.5px solid #d1d5db", borderRadius: "8px", background: "#fff", cursor: "pointer" },
  submitBtn: { padding: "0.6rem 1.5rem", background: "#0f4c81", color: "#fff", border: "none", borderRadius: "8px", fontWeight: 600, cursor: "pointer" },
};