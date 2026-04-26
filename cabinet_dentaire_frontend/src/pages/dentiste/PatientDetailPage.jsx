/**
 * src/pages/dentiste/PatientDetailPage.jsx
 * ✅ CORRIGÉ :
 *   - FormData : "patient" au lieu de "patient_id"
 *   - URL images depuis VITE_MEDIA_BASE_URL
 *   - Preview image avant upload
 *   - Affichage radios avec miniature + modal
 *   - dossier.traitements (pas treatments)
 *   - Analyse IA avec résultat affiché
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  getPatient, getDossierPatient, updateNote,
} from "../../api/patientsAPI";
import {
  uploadRadio, analyserRadio, deleteRadio,
} from "../../api/radiosAPI";

// ✅ Base URL pour les médias Django
const MEDIA_BASE = (
  import.meta.env.VITE_API_BASE_URL || "/api"
).replace("/api", "");

function getMediaUrl(path) {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `${MEDIA_BASE}${path}`;
}

const NIVEAU_COLORS = {
  CRITIQUE:      { bg: "#fef2f2", color: "#dc2626", border: "#fecaca" },
  AVERTISSEMENT: { bg: "#fffbeb", color: "#d97706", border: "#fed7aa" },
  INFO:          { bg: "#eff6ff", color: "#2563eb", border: "#bfdbfe" },
};

const STATUT_ANALYSE_COLORS = {
  EN_ATTENTE: { bg: "#f9fafb", color: "#6b7280" },
  EN_COURS:   { bg: "#eff6ff", color: "#2563eb" },
  ANALYSE:    { bg: "#ecfdf5", color: "#059669" },
  ERREUR:     { bg: "#fef2f2", color: "#dc2626" },
};

const TABS = ["Rendez-vous", "Radios", "Ordonnances", "Traitements"];

export default function PatientDetailPage() {
  const { id }   = useParams();
  const navigate = useNavigate();

  const [patient,  setPatient]  = useState(null);
  const [dossier,  setDossier]  = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [tab,      setTab]      = useState(0);
  const [note,     setNote]     = useState("");
  const [saving,   setSaving]   = useState(false);
  const noteTimer               = useRef();

  // ── Upload radio ──────────────────────────────────────────────────
  const [radioFile,       setRadioFile]       = useState(null);
  const [radioPreview,    setRadioPreview]    = useState(null);
  const [radioType,       setRadioType]       = useState("PANORAMIQUE");
  const [uploadingRadio,  setUploadingRadio]  = useState(false);
  const [uploadError,     setUploadError]     = useState("");

  // ── Modal radio ───────────────────────────────────────────────────
  const [selectedRadio, setSelectedRadio] = useState(null);

  // ── Analyse IA ────────────────────────────────────────────────────
  const [analyzingId, setAnalyzingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, d] = await Promise.all([
        getPatient(id),
        getDossierPatient(id),
      ]);
      setPatient(p);
      setDossier(d);
      setNote(p.note_generale || "");
    } catch {
      navigate(-1);
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => { load(); }, [load]);

  // Auto-save note
  const handleNoteChange = (val) => {
    setNote(val);
    clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(async () => {
      setSaving(true);
      try { await updateNote(id, val); }
      finally { setSaving(false); }
    }, 1500);
  };

  // ── Sélection fichier radio ───────────────────────────────────────
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setRadioFile(file);
    setUploadError("");
    // ✅ Preview locale avant upload
    const reader = new FileReader();
    reader.onload = (ev) => setRadioPreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  // ── Upload radio ──────────────────────────────────────────────────
  const handleUploadRadio = async () => {
    if (!radioFile) return;
    setUploadingRadio(true);
    setUploadError("");
    try {
      // ✅ CORRIGÉ : "patient" (UUID) au lieu de "patient_id"
      const fd = new FormData();
      fd.append("patient",    id);
      fd.append("image",      radioFile);
      fd.append("type_radio", radioType);
      await uploadRadio(fd);
      // Reset
      setRadioFile(null);
      setRadioPreview(null);
      load();
    } catch (err) {
      const msg =
        err.response?.data?.image?.[0] ||
        err.response?.data?.patient?.[0] ||
        err.response?.data?.detail ||
        "Erreur lors de l'upload.";
      setUploadError(msg);
    } finally {
      setUploadingRadio(false);
    }
  };

  const handleCancelUpload = () => {
    setRadioFile(null);
    setRadioPreview(null);
    setUploadError("");
  };

  // ── Suppression radio ─────────────────────────────────────────────
  const handleDeleteRadio = async (radioId) => {
    if (!window.confirm("Supprimer cette radiographie ?")) return;
    try {
      await deleteRadio(radioId);
      if (selectedRadio?.id === radioId) setSelectedRadio(null);
      load();
    } catch (err) {
      alert(err.response?.data?.detail || "Erreur suppression.");
    }
  };

  // ── Analyse IA ────────────────────────────────────────────────────
  const handleAnalyse = async (radioId) => {
    setAnalyzingId(radioId);
    try {
      const result = await analyserRadio(radioId);
      // Mettre à jour la radio sélectionnée si c'est elle
      if (selectedRadio?.id === radioId) {
        setSelectedRadio((prev) => ({ ...prev, ...result }));
      }
      load();
    } catch (err) {
      alert(err.response?.data?.detail || "Erreur analyse IA.");
    } finally {
      setAnalyzingId(null);
    }
  };

  if (loading) return (
    <div style={styles.loadingState}>
      <div style={styles.spinner} />
      <span>Chargement du dossier...</span>
    </div>
  );
  if (!patient) return null;

  const radios = dossier?.radios ?? [];

  return (
    <div style={styles.page}>

      {/* ── En-tête ── */}
      <div style={styles.header}>
        <button onClick={() => navigate(-1)} style={styles.backBtn}>← Retour</button>
        <div style={styles.headerInfo}>
          <div style={styles.avatar}>
            {patient.prenom?.[0]}{patient.nom?.[0]}
          </div>
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
          {patient.statut === "ACCEPTE" ? "✓ Accepté" : "⏳ En attente"}
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

      {/* ── Informations ── */}
      <div style={styles.infoGrid}>
        <div style={styles.infoCard}>
          <h3 style={styles.cardTitle}>Informations personnelles</h3>
          <InfoRow label="Email"    value={patient.email        || "—"} />
          <InfoRow label="Adresse"  value={patient.adresse      || "—"} />
          <InfoRow label="Né(e) le" value={patient.date_naissance} />
          <InfoRow label="Mineur"   value={patient.est_mineur ? "Oui" : "Non"} />
        </div>
        <div style={styles.infoCard}>
          <h3 style={styles.cardTitle}>Informations médicales</h3>
          <InfoRow label="Groupe sanguin" value={patient.groupe_sanguin} />
          <InfoRow label="Allergies"      value={patient.allergies      || "—"} />
          <InfoRow label="Antécédents"    value={patient.antecedents    || "—"} />
          <InfoRow label="Médicaments"    value={patient.medicaments_actuels || "—"} />
        </div>
      </div>

      {/* ── Note générale ── */}
      <div style={styles.infoCard}>
        <h3 style={styles.cardTitle}>
          Note générale
          {saving  && <span style={styles.savingTag}>Enregistrement…</span>}
          {!saving && note && <span style={styles.savedTag}>✓ Sauvegardé</span>}
        </h3>
        <textarea
          value={note}
          onChange={(e) => handleNoteChange(e.target.value)}
          placeholder="Saisir une note sur ce patient…"
          style={styles.noteArea}
          rows={4}
        />
      </div>

      {/* ── Onglets dossier ── */}
      <div style={styles.infoCard}>
        <div style={styles.tabBar}>
          {TABS.map((t, i) => {
            const counts = [
              dossier?.rendezvous?.length ?? 0,
              radios.length,
              dossier?.ordonnances?.length ?? 0,
              // ✅ CORRIGÉ : traitements (pas treatments)
              dossier?.traitements?.length ?? dossier?.treatments?.length ?? 0,
            ];
            return (
              <button
                key={t}
                onClick={() => setTab(i)}
                style={{ ...styles.tabBtn, ...(tab === i ? styles.tabBtnActive : {}) }}
              >
                {t} ({counts[i]})
              </button>
            );
          })}
        </div>

        <div style={{ marginTop: "1rem" }}>

          {/* ── Tab 0 : Rendez-vous ── */}
          {tab === 0 && (
            <DossierSection
              items={dossier?.rendezvous}
              emptyMsg="Aucun rendez-vous."
              renderItem={(r) => (
                <div key={r.id} style={styles.dossierItem}>
                  <div>
                    <strong>
                      {r.date_heure
                        ? new Date(r.date_heure).toLocaleDateString("fr-FR")
                        : "—"}
                    </strong>
                    {r.date_heure && (
                      <span style={styles.dossierMeta}>
                        {" "}à {new Date(r.date_heure).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    )}
                  </div>
                  <span style={styles.dossierMeta}>
                    {r.motif || r.type_soin || "Consultation"} · {r.statut}
                  </span>
                </div>
              )}
            />
          )}

          {/* ── Tab 1 : Radios ── */}
          {tab === 1 && (
            <div>
              {/* Zone upload */}
              <div style={styles.uploadZone}>
                <h4 style={{ margin: "0 0 0.75rem", fontSize: "0.9rem", fontWeight: 600 }}>
                  Ajouter une radiographie
                </h4>

                {/* Preview */}
                {radioPreview && (
                  <div style={styles.previewWrap}>
                    <img
                      src={radioPreview}
                      alt="Prévisualisation"
                      style={styles.previewImg}
                    />
                    <button onClick={handleCancelUpload} style={styles.cancelPreviewBtn}>
                      ✕
                    </button>
                  </div>
                )}

                <div style={styles.uploadControls}>
                  <label style={styles.fileLabel}>
                    📁 {radioFile ? radioFile.name : "Choisir une image"}
                    <input
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/webp"
                      onChange={handleFileSelect}
                      style={{ display: "none" }}
                    />
                  </label>

                  <select
                    value={radioType}
                    onChange={(e) => setRadioType(e.target.value)}
                    style={styles.typeSelect}
                  >
                    <option value="PANORAMIQUE">Panoramique</option>
                    <option value="PERIAPICALE">Périapicale</option>
                    <option value="BITEWING">Bitewing</option>
                    <option value="OCCLUSAL">Occlusal</option>
                    <option value="CEPHALOMETRIQUE">Céphalométrique</option>
                    <option value="CONE_BEAM">Cone Beam (3D)</option>
                    <option value="AUTRE">Autre</option>
                  </select>

                  <button
                    onClick={handleUploadRadio}
                    disabled={!radioFile || uploadingRadio}
                    style={{
                      ...styles.uploadBtn,
                      opacity: !radioFile || uploadingRadio ? 0.5 : 1,
                    }}
                  >
                    {uploadingRadio ? "Upload…" : "⬆ Uploader"}
                  </button>
                </div>

                {uploadError && (
                  <p style={{ color: "#dc2626", fontSize: "0.8rem", margin: "0.5rem 0 0" }}>
                    {uploadError}
                  </p>
                )}
              </div>

              {/* Grille radios */}
              {radios.length === 0 ? (
                <p style={{ color: "#6b7280", fontSize: "0.875rem", marginTop: "1rem" }}>
                  Aucune radiographie.
                </p>
              ) : (
                <div style={styles.radiosGrid}>
                  {radios.map((r) => {
                    const sc = STATUT_ANALYSE_COLORS[r.statut_analyse] || STATUT_ANALYSE_COLORS.EN_ATTENTE;
                    const imgUrl = getMediaUrl(r.image);
                    return (
                      <div
                        key={r.id}
                        style={styles.radioCard}
                        onClick={() => setSelectedRadio(r)}
                      >
                        {/* Miniature */}
                        <div style={styles.radioThumbWrap}>
                          {imgUrl ? (
                            <img
                              src={imgUrl}
                              alt={r.type_radio}
                              style={styles.radioThumb}
                              onError={(e) => { e.target.style.display = "none"; }}
                            />
                          ) : (
                            <div style={styles.radioThumbPlaceholder}>🦷</div>
                          )}
                          {/* Badge statut analyse */}
                          <span style={{ ...styles.analyseBadge, ...sc }}>
                            {r.statut_analyse === "ANALYSE"    ? "✓ Analysée" :
                             r.statut_analyse === "EN_COURS"   ? "⏳ En cours" :
                             r.statut_analyse === "ERREUR"     ? "✗ Erreur" :
                                                                  "📋 En attente"}
                          </span>
                        </div>

                        {/* Infos */}
                        <div style={styles.radioCardBody}>
                          <span style={styles.radioType}>{r.type_radio}</span>
                          <span style={styles.radioDate}>
                            {r.date_prise
                              ? new Date(r.date_prise).toLocaleDateString("fr-FR")
                              : "—"}
                          </span>
                          {r.ia_anomalies_detectees && (
                            <span style={styles.anomalieBadge}>
                              ⚠ {r.nb_anomalies} anomalie{r.nb_anomalies > 1 ? "s" : ""}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── Tab 2 : Ordonnances ── */}
          {tab === 2 && (
            <DossierSection
              items={dossier?.ordonnances}
              emptyMsg="Aucune ordonnance."
              renderItem={(o) => (
                <div key={o.id} style={styles.dossierItem}>
                  <strong>
                    {o.date_prescription
                      ? new Date(o.date_prescription).toLocaleDateString("fr-FR")
                      : o.created_at?.slice(0, 10) || "—"}
                  </strong>
                  <span style={styles.dossierMeta}>
                    {o.diagnostic || "Ordonnance"} · {o.statut}
                  </span>
                </div>
              )}
            />
          )}

          {/* ── Tab 3 : Traitements ── */}
          {tab === 3 && (
            <DossierSection
              // ✅ CORRIGÉ : traitements (clé retournée par dossiers/views.py)
              items={dossier?.traitements ?? dossier?.treatments}
              emptyMsg="Aucun traitement."
              renderItem={(t) => (
                <div key={t.id} style={styles.dossierItem}>
                  <strong>{t.type_acte || t.titre || "Traitement"}</strong>
                  <span style={styles.dossierMeta}>
                    {t.statut} {t.numero_dent ? `· dent n°${t.numero_dent}` : ""}
                  </span>
                </div>
              )}
            />
          )}

        </div>
      </div>

      {/* ── Modal radio ── */}
      {selectedRadio && (
        <RadioModal
          radio={selectedRadio}
          onClose={() => setSelectedRadio(null)}
          onAnalyse={handleAnalyse}
          onDelete={handleDeleteRadio}
          analyzingId={analyzingId}
          getMediaUrl={getMediaUrl}
        />
      )}

    </div>
  );
}

// ── Modal détail radio ─────────────────────────────────────────────────────

function RadioModal({ radio, onClose, onAnalyse, onDelete, analyzingId, getMediaUrl }) {
  const imgUrl = getMediaUrl(radio.image);
  const sc     = STATUT_ANALYSE_COLORS[radio.statut_analyse] || STATUT_ANALYSE_COLORS.EN_ATTENTE;
  const isAnalyzing = analyzingId === radio.id;

  return (
    <div style={modalStyles.overlay} onClick={onClose}>
      <div style={modalStyles.modal} onClick={(e) => e.stopPropagation()}>

        <div style={modalStyles.header}>
          <div>
            <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700 }}>
              {radio.type_radio}
            </h3>
            <span style={{ fontSize: "0.8rem", color: "#6b7280" }}>
              {radio.date_prise
                ? new Date(radio.date_prise).toLocaleDateString("fr-FR")
                : "—"}
            </span>
          </div>
          <button onClick={onClose} style={modalStyles.closeBtn}>✕</button>
        </div>

        {/* Image */}
        <div style={modalStyles.imgWrap}>
          {imgUrl ? (
            <img
              src={imgUrl}
              alt={radio.type_radio}
              style={modalStyles.img}
            />
          ) : (
            <div style={modalStyles.imgPlaceholder}>🦷 Image non disponible</div>
          )}
        </div>

        {/* Statut analyse */}
        <div style={modalStyles.analyseSection}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
            <span style={{ ...modalStyles.statutBadge, ...sc }}>
              {radio.statut_analyse === "ANALYSE"    ? "✓ Analysée"        :
               radio.statut_analyse === "EN_COURS"   ? "⏳ Analyse en cours" :
               radio.statut_analyse === "ERREUR"     ? "✗ Erreur"          :
                                                        "📋 En attente d'analyse"}
            </span>

            {/* Bouton IA */}
            {radio.statut_analyse !== "ANALYSE" && (
              <button
                onClick={() => onAnalyse(radio.id)}
                disabled={isAnalyzing || radio.statut_analyse === "EN_COURS"}
                style={{
                  ...modalStyles.iaBtn,
                  opacity: isAnalyzing || radio.statut_analyse === "EN_COURS" ? 0.6 : 1,
                }}
              >
                {isAnalyzing ? "⏳ Analyse en cours…" : "🤖 Lancer l'analyse IA"}
              </button>
            )}
          </div>

          {/* Résultat IA */}
          {radio.ia_resultat && (
            <div style={modalStyles.iaResult}>
              <strong style={{ fontSize: "0.85rem", color: "#374151" }}>
                Résultat de l'analyse IA
              </strong>
              {radio.ia_confidence && (
                <div style={modalStyles.confidence}>
                  Confiance : {Math.round(radio.ia_confidence * 100)}%
                  <div style={modalStyles.confidenceBar}>
                    <div style={{
                      ...modalStyles.confidenceFill,
                      width: `${radio.ia_confidence * 100}%`,
                      background: radio.ia_confidence > 0.8 ? "#059669" : radio.ia_confidence > 0.6 ? "#d97706" : "#dc2626",
                    }} />
                  </div>
                </div>
              )}
              <p style={{ margin: "0.5rem 0 0", fontSize: "0.85rem", color: "#374151" }}>
                {radio.ia_resultat}
              </p>

              {/* Anomalies détectées */}
              {radio.ia_anomalies?.length > 0 && (
                <div style={{ marginTop: "0.75rem" }}>
                  <strong style={{ fontSize: "0.8rem", color: "#dc2626" }}>
                    ⚠ {radio.ia_anomalies.length} anomalie{radio.ia_anomalies.length > 1 ? "s" : ""} détectée{radio.ia_anomalies.length > 1 ? "s" : ""}
                  </strong>
                  <div style={{ marginTop: "0.4rem", display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                    {radio.ia_anomalies.map((a, i) => (
                      <div key={i} style={modalStyles.anomalieRow}>
                        <span style={{ fontWeight: 600 }}>{a.type}</span>
                        {a.dent && <span>dent {a.dent}</span>}
                        <span style={{ color: "#6b7280" }}>
                          {Math.round((a.confidence || 0) * 100)}%
                        </span>
                        {a.description && (
                          <span style={{ color: "#6b7280", fontSize: "0.78rem" }}>
                            — {a.description}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Erreur IA */}
          {radio.ia_erreur && (
            <p style={{ color: "#dc2626", fontSize: "0.85rem", marginTop: "0.5rem" }}>
              ✗ {radio.ia_erreur}
            </p>
          )}
        </div>

        {/* Actions */}
        <div style={modalStyles.actions}>
          {imgUrl && (
            <a
              href={imgUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={modalStyles.downloadBtn}
            >
              ⬇ Télécharger
            </a>
          )}
          <button
            onClick={() => onDelete(radio.id)}
            style={modalStyles.deleteBtn}
          >
            🗑 Supprimer
          </button>
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
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      {items.map(renderItem)}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = {
  page:           { display: "flex", flexDirection: "column", gap: "1.25rem" },
  loadingState:   { display: "flex", alignItems: "center", gap: "0.75rem", padding: "2rem", color: "#6b7280" },
  spinner:        { width: "20px", height: "20px", border: "2px solid #e5e7eb", borderTop: "2px solid #0f4c81", borderRadius: "50%", animation: "spin 0.8s linear infinite" },
  header:         { display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap", background: "#fff", padding: "1.25rem", borderRadius: "12px", border: "1px solid #e5e7eb" },
  backBtn:        { background: "none", border: "none", cursor: "pointer", color: "#0f4c81", fontWeight: 600, fontSize: "0.875rem" },
  headerInfo:     { display: "flex", alignItems: "center", gap: "1rem", flex: 1 },
  avatar:         { width: "48px", height: "48px", background: "linear-gradient(135deg, #2563eb, #1d4ed8)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: "#fff", fontSize: "1rem", flexShrink: 0 },
  name:           { margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "#111827" },
  meta:           { fontSize: "0.85rem", color: "#6b7280" },
  statutPill:     { padding: "4px 12px", borderRadius: "12px", fontSize: "0.8rem", fontWeight: 600 },
  alertesGrid:    { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "0.75rem" },
  alerteCard:     { padding: "0.75rem", borderRadius: "8px", border: "1px solid" },
  infoGrid:       { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" },
  infoCard:       { background: "#fff", borderRadius: "12px", border: "1px solid #e5e7eb", padding: "1.25rem" },
  cardTitle:      { fontSize: "0.95rem", fontWeight: 600, color: "#111827", marginBottom: "0.75rem", display: "flex", alignItems: "center", gap: "0.5rem", margin: "0 0 0.75rem" },
  savingTag:      { fontSize: "0.75rem", color: "#d97706", fontWeight: 400 },
  savedTag:       { fontSize: "0.75rem", color: "#059669", fontWeight: 400 },
  noteArea:       { width: "100%", padding: "0.75rem", border: "1.5px solid #d1d5db", borderRadius: "8px", fontSize: "0.9rem", resize: "vertical", boxSizing: "border-box", fontFamily: "inherit" },
  tabBar:         { display: "flex", gap: "0.5rem", flexWrap: "wrap", borderBottom: "1px solid #e5e7eb", paddingBottom: "0.75rem" },
  tabBtn:         { padding: "0.4rem 1rem", border: "1px solid #d1d5db", borderRadius: "20px", background: "#f9fafb", cursor: "pointer", fontSize: "0.85rem", color: "#374151" },
  tabBtnActive:   { background: "#0f4c81", color: "#fff", border: "1px solid #0f4c81" },
  dossierItem:    { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.6rem 0.75rem", background: "#f9fafb", borderRadius: "8px", gap: "1rem", flexWrap: "wrap" },
  dossierMeta:    { fontSize: "0.8rem", color: "#6b7280" },
  // Upload
  uploadZone:     { background: "#f9fafb", border: "1.5px dashed #d1d5db", borderRadius: "10px", padding: "1rem", marginBottom: "1.25rem" },
  previewWrap:    { position: "relative", display: "inline-block", marginBottom: "0.75rem" },
  previewImg:     { width: "180px", height: "120px", objectFit: "cover", borderRadius: "8px", border: "1px solid #e5e7eb" },
  cancelPreviewBtn: { position: "absolute", top: "-6px", right: "-6px", background: "#dc2626", color: "#fff", border: "none", borderRadius: "50%", width: "20px", height: "20px", cursor: "pointer", fontSize: "0.7rem", display: "flex", alignItems: "center", justifyContent: "center" },
  uploadControls: { display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" },
  fileLabel:      { padding: "0.4rem 0.75rem", border: "1.5px solid #d1d5db", borderRadius: "8px", background: "#fff", cursor: "pointer", fontSize: "0.85rem", color: "#374151" },
  typeSelect:     { padding: "0.4rem 0.5rem", border: "1.5px solid #d1d5db", borderRadius: "8px", fontSize: "0.85rem", background: "#fff" },
  uploadBtn:      { padding: "0.4rem 0.875rem", background: "#0f4c81", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "0.85rem", fontWeight: 500 },
  // Grille radios
  radiosGrid:     { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "0.75rem", marginTop: "0.5rem" },
  radioCard:      { border: "1px solid #e5e7eb", borderRadius: "10px", overflow: "hidden", cursor: "pointer", transition: "all 0.15s", background: "#fff" },
  radioThumbWrap: { position: "relative", height: "110px", background: "#f3f4f6" },
  radioThumb:     { width: "100%", height: "100%", objectFit: "cover" },
  radioThumbPlaceholder: { width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2rem" },
  analyseBadge:   { position: "absolute", bottom: "4px", left: "4px", padding: "2px 6px", borderRadius: "6px", fontSize: "0.68rem", fontWeight: 600 },
  radioCardBody:  { padding: "0.5rem", display: "flex", flexDirection: "column", gap: "2px" },
  radioType:      { fontSize: "0.78rem", fontWeight: 600, color: "#374151" },
  radioDate:      { fontSize: "0.72rem", color: "#9ca3af" },
  anomalieBadge:  { fontSize: "0.7rem", color: "#dc2626", fontWeight: 600 },
};

const modalStyles = {
  overlay:        { position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "1rem" },
  modal:          { background: "#fff", borderRadius: "16px", width: "100%", maxWidth: "580px", maxHeight: "90vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.25)" },
  header:         { display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "1.25rem 1.25rem 0" },
  closeBtn:       { background: "none", border: "none", cursor: "pointer", fontSize: "1.1rem", color: "#6b7280", padding: "0.25rem" },
  imgWrap:        { padding: "1rem 1.25rem", background: "#000", margin: "0.75rem 1.25rem", borderRadius: "10px", display: "flex", justifyContent: "center" },
  img:            { maxWidth: "100%", maxHeight: "300px", objectFit: "contain" },
  imgPlaceholder: { color: "#9ca3af", padding: "3rem", fontSize: "0.9rem" },
  analyseSection: { padding: "0 1.25rem 1rem" },
  statutBadge:    { padding: "4px 10px", borderRadius: "20px", fontSize: "0.8rem", fontWeight: 600 },
  iaBtn:          { padding: "0.45rem 1rem", background: "linear-gradient(135deg, #7c3aed, #6d28d9)", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "0.85rem", fontWeight: 600 },
  iaResult:       { background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "8px", padding: "0.875rem", marginTop: "0.75rem" },
  confidence:     { fontSize: "0.8rem", color: "#6b7280", marginTop: "0.4rem" },
  confidenceBar:  { height: "4px", background: "#e5e7eb", borderRadius: "2px", marginTop: "4px", overflow: "hidden" },
  confidenceFill: { height: "100%", borderRadius: "2px", transition: "width 0.3s" },
  anomalieRow:    { display: "flex", gap: "0.5rem", alignItems: "center", fontSize: "0.82rem", background: "#fff", padding: "0.3rem 0.5rem", borderRadius: "6px", border: "1px solid #fee2e2", flexWrap: "wrap" },
  actions:        { display: "flex", gap: "0.5rem", padding: "0.75rem 1.25rem 1.25rem", borderTop: "1px solid #f3f4f6" },
  downloadBtn:    { padding: "0.4rem 0.875rem", background: "#f3f4f6", color: "#374151", border: "1px solid #e5e7eb", borderRadius: "8px", textDecoration: "none", fontSize: "0.85rem", cursor: "pointer" },
  deleteBtn:      { padding: "0.4rem 0.875rem", background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: "8px", cursor: "pointer", fontSize: "0.85rem" },
};