/**
 * components/patients/PatientForm.jsx
 * ======================================
 * Formulaire création / modification d'un patient.
 *
 * Props :
 *   mode        "create" | "edit"
 *   initial     {Object|null}   patient existant (mode edit)
 *   dentistes   {Array}         liste dentistes actifs (pour réceptionniste)
 *   isRecep     {boolean}       true si l'appelant est réceptionniste
 *   onSubmit    {Function}      (formData) => Promise
 *   onCancel    {Function}
 *
 * Champs (PatientCreateUpdateSerializer) :
 *   nom, prenom, sexe, date_naissance, telephone, email, adresse,
 *   groupe_sanguin, allergies, antecedents, medicaments_actuels, note_generale,
 *   alerte_anticoagulants, alerte_diabete, alerte_grossesse,
 *   alerte_allergie_latex, alerte_cardiopathie, alerte_immunodeprime
 *
 *   + dentiste_id (réceptionniste uniquement — injecté dans le body)
 */

import React, { useState } from "react";

// ── Constantes ────────────────────────────────────────────────────────────────

const GROUPES_SANGUINS = [
  { value: "INCONNU", label: "Non renseigné" },
  { value: "A+",  label: "A+" },  { value: "A-",  label: "A-" },
  { value: "B+",  label: "B+" },  { value: "B-",  label: "B-" },
  { value: "AB+", label: "AB+" }, { value: "AB-", label: "AB-" },
  { value: "O+",  label: "O+" },  { value: "O-",  label: "O-" },
];

const ALERTES = [
  { key: "alerte_anticoagulants",  label: "Sous anticoagulants",  icon: "💊", niveau: "CRITIQUE" },
  { key: "alerte_diabete",         label: "Diabétique",           icon: "🩸", niveau: "AVERTISSEMENT" },
  { key: "alerte_grossesse",       label: "Enceinte",             icon: "🤰", niveau: "CRITIQUE" },
  { key: "alerte_allergie_latex",  label: "Allergie au latex",    icon: "🧤", niveau: "CRITIQUE" },
  { key: "alerte_cardiopathie",    label: "Cardiopathie",         icon: "❤️", niveau: "AVERTISSEMENT" },
  { key: "alerte_immunodeprime",   label: "Immunodéprimé",        icon: "🛡", niveau: "AVERTISSEMENT" },
];

const EMPTY = {
  nom: "", prenom: "", sexe: "", date_naissance: "",
  telephone: "", email: "", adresse: "",
  groupe_sanguin: "INCONNU", allergies: "", antecedents: "",
  medicaments_actuels: "", note_generale: "",
  alerte_anticoagulants: false, alerte_diabete: false,
  alerte_grossesse: false,      alerte_allergie_latex: false,
  alerte_cardiopathie: false,   alerte_immunodeprime: false,
  dentiste_id: "",
};

// ── Styles ────────────────────────────────────────────────────────────────────

const S = {
  overlay:     { position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "1rem" },
  modal:       { backgroundColor: "#fff", borderRadius: "14px", padding: "2rem", width: "100%", maxWidth: "620px", maxHeight: "92vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)", fontFamily: "system-ui, sans-serif" },
  title:       { fontSize: "1.125rem", fontWeight: "700", color: "#0f172a", margin: "0 0 1.5rem" },
  section:     { marginBottom: "1.5rem" },
  sectionTitle:{ fontSize: "0.8125rem", fontWeight: "600", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.75rem", paddingBottom: "0.4rem", borderBottom: "1px solid #f1f5f9" },
  row:         { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" },
  row3:        { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem" },
  formGroup:   { marginBottom: "0.85rem" },
  label:       { display: "block", fontSize: "0.8375rem", fontWeight: "500", color: "#374151", marginBottom: "0.3rem" },
  required:    { color: "#ef4444", marginLeft: "2px" },
  input:       { width: "100%", padding: "0.575rem 0.825rem", border: "1.5px solid #d1d5db", borderRadius: "8px", fontSize: "0.875rem", color: "#1e293b", boxSizing: "border-box", outline: "none", backgroundColor: "#fff" },
  inputErr:    { borderColor: "#ef4444" },
  select:      { width: "100%", padding: "0.575rem 0.825rem", border: "1.5px solid #d1d5db", borderRadius: "8px", fontSize: "0.875rem", backgroundColor: "#fff", color: "#1e293b", cursor: "pointer", boxSizing: "border-box" },
  textarea:    { width: "100%", padding: "0.575rem 0.825rem", border: "1.5px solid #d1d5db", borderRadius: "8px", fontSize: "0.875rem", color: "#1e293b", boxSizing: "border-box", minHeight: "76px", resize: "vertical", fontFamily: "inherit" },
  fieldErr:    { fontSize: "0.76rem", color: "#dc2626", marginTop: "0.2rem" },
  alerteGrid:  { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" },
  alerteItem:  (checked, niveau) => ({
    display:         "flex",
    alignItems:      "center",
    gap:             "0.5rem",
    padding:         "0.6rem 0.75rem",
    borderRadius:    "8px",
    cursor:          "pointer",
    border:          `1.5px solid ${checked ? (niveau === "CRITIQUE" ? "#fecaca" : "#fde68a") : "#e2e8f0"}`,
    backgroundColor: checked ? (niveau === "CRITIQUE" ? "#fef2f2" : "#fffbeb") : "#f8fafc",
    transition:      "all 0.1s",
    userSelect:      "none",
  }),
  alerteLabel: (checked, niveau) => ({
    fontSize:   "0.8125rem",
    fontWeight: checked ? "600" : "400",
    color:      checked ? (niveau === "CRITIQUE" ? "#dc2626" : "#d97706") : "#475569",
  }),
  footer:      { display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1.75rem", paddingTop: "1.25rem", borderTop: "1px solid #f1f5f9" },
  btnCancel:   { padding: "0.6rem 1.25rem", backgroundColor: "#f1f5f9", color: "#475569", border: "1.5px solid #e2e8f0", borderRadius: "8px", fontSize: "0.875rem", fontWeight: "500", cursor: "pointer" },
  btnSubmit:   { padding: "0.6rem 1.5rem", backgroundColor: "#2563eb", color: "#fff", border: "none", borderRadius: "8px", fontSize: "0.875rem", fontWeight: "600", cursor: "pointer" },
  errorBox:    { backgroundColor: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", padding: "0.75rem 1rem", color: "#dc2626", fontSize: "0.875rem", marginBottom: "1.25rem" },
};

// ── Composant ─────────────────────────────────────────────────────────────────

export default function PatientForm({
  mode      = "create",
  initial   = null,
  dentistes = [],
  isRecep   = false,
  onSubmit,
  onCancel,
}) {
  const [form,   setForm]   = useState(() => ({
    ...EMPTY,
    ...(initial ?? {}),
    // Convertir date_naissance en string YYYY-MM-DD pour l'input date
    date_naissance: initial?.date_naissance
      ? initial.date_naissance.slice(0, 10)
      : "",
  }));
  const [errors,  setErrors]  = useState({});
  const [saving,  setSaving]  = useState(false);
  const [globalErr, setGlobalErr] = useState(null);

  const set = (field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
    setGlobalErr(null);
  };

  const toggleAlerte = (key) => set(key, !form[key]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    setGlobalErr(null);

    // Construire le payload
    const payload = { ...form };
    // Supprimer dentiste_id si dentiste (injecté par le backend via token)
    if (!isRecep) delete payload.dentiste_id;
    // Nettoyer les champs vides optionnels
    if (!payload.email) delete payload.email;

    try {
      await onSubmit(payload);
    } catch (err) {
      const d = err?.response?.data ?? {};
      if (d.detail) {
        setGlobalErr(d.detail);
      } else if (typeof d === "object") {
        // Erreurs de champs
        const mapped = {};
        Object.entries(d).forEach(([k, v]) => {
          mapped[k] = Array.isArray(v) ? v[0] : String(v);
        });
        setErrors(mapped);
        // Afficher aussi le premier message globalement
        const first = Object.values(mapped)[0];
        if (first) setGlobalErr(first);
      } else {
        setGlobalErr("Une erreur est survenue. Veuillez réessayer.");
      }
    } finally {
      setSaving(false);
    }
  };

  const field = (name, required = false) => ({
    value:    form[name],
    onChange: (e) => set(name, e.target.value),
    style:    { ...S.input, ...(errors[name] ? S.inputErr : {}) },
    ...(required ? { required: true } : {}),
  });

  return (
    <div style={S.overlay} onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div style={S.modal}>
        <h2 style={S.title}>
          {mode === "create" ? "➕ Nouveau patient" : "✏️ Modifier le patient"}
        </h2>

        {globalErr && <div style={S.errorBox}>⚠ {globalErr}</div>}

        <form onSubmit={handleSubmit}>

          {/* ── Dentiste (réceptionniste uniquement) ─── */}
          {isRecep && mode === "create" && (
            <div style={{ ...S.section }}>
              <p style={S.sectionTitle}>Dentiste référent</p>
              <div style={S.formGroup}>
                <label style={S.label}>
                  Dentiste <span style={S.required}>*</span>
                </label>
                <select
                  value={form.dentiste_id}
                  onChange={(e) => set("dentiste_id", e.target.value)}
                  required
                  style={{ ...S.select, ...(errors.dentiste_id ? S.inputErr : {}) }}
                >
                  <option value="">— Sélectionner un dentiste —</option>
                  {dentistes.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.full_name}
                      {d.specialite ? ` — ${d.specialite}` : ""}
                    </option>
                  ))}
                </select>
                {errors.dentiste_id && <p style={S.fieldErr}>{errors.dentiste_id}</p>}
              </div>
            </div>
          )}

          {/* ── Identité ─── */}
          <div style={S.section}>
            <p style={S.sectionTitle}>Identité</p>
            <div style={S.row}>
              <div style={S.formGroup}>
                <label style={S.label}>Nom <span style={S.required}>*</span></label>
                <input type="text" {...field("nom", true)} placeholder="DUPONT" />
                {errors.nom && <p style={S.fieldErr}>{errors.nom}</p>}
              </div>
              <div style={S.formGroup}>
                <label style={S.label}>Prénom <span style={S.required}>*</span></label>
                <input type="text" {...field("prenom", true)} placeholder="Jean" />
                {errors.prenom && <p style={S.fieldErr}>{errors.prenom}</p>}
              </div>
            </div>

            <div style={S.row3}>
              <div style={S.formGroup}>
                <label style={S.label}>Date de naissance <span style={S.required}>*</span></label>
                <input type="date" {...field("date_naissance", true)} max={new Date().toISOString().split("T")[0]} />
                {errors.date_naissance && <p style={S.fieldErr}>{errors.date_naissance}</p>}
              </div>
              <div style={S.formGroup}>
                <label style={S.label}>Sexe</label>
                <select value={form.sexe} onChange={(e) => set("sexe", e.target.value)} style={S.select}>
                  <option value="">— Non précisé —</option>
                  <option value="M">Masculin</option>
                  <option value="F">Féminin</option>
                </select>
              </div>
              <div style={S.formGroup}>
                <label style={S.label}>Groupe sanguin</label>
                <select value={form.groupe_sanguin} onChange={(e) => set("groupe_sanguin", e.target.value)} style={S.select}>
                  {GROUPES_SANGUINS.map((g) => (
                    <option key={g.value} value={g.value}>{g.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={S.row}>
              <div style={S.formGroup}>
                <label style={S.label}>Téléphone <span style={S.required}>*</span></label>
                <input type="tel" {...field("telephone", true)} placeholder="0551234567" />
                {errors.telephone && <p style={S.fieldErr}>{errors.telephone}</p>}
              </div>
              <div style={S.formGroup}>
                <label style={S.label}>Email</label>
                <input type="email" {...field("email")} placeholder="patient@email.com" />
                {errors.email && <p style={S.fieldErr}>{errors.email}</p>}
              </div>
            </div>

            <div style={S.formGroup}>
              <label style={S.label}>Adresse</label>
              <textarea
                value={form.adresse}
                onChange={(e) => set("adresse", e.target.value)}
                style={S.textarea}
                placeholder="Rue, quartier, ville..."
                rows={2}
              />
            </div>
          </div>

          {/* ── Médical ─── */}
          <div style={S.section}>
            <p style={S.sectionTitle}>Informations médicales</p>

            <div style={S.formGroup}>
              <label style={S.label}>Allergies connues</label>
              <textarea value={form.allergies} onChange={(e) => set("allergies", e.target.value)} style={S.textarea} placeholder="Pénicilline, aspirine..." rows={2} />
            </div>
            <div style={S.formGroup}>
              <label style={S.label}>Antécédents médicaux</label>
              <textarea value={form.antecedents} onChange={(e) => set("antecedents", e.target.value)} style={S.textarea} placeholder="Maladies, opérations passées..." rows={2} />
            </div>
            <div style={S.formGroup}>
              <label style={S.label}>Médicaments actuels</label>
              <textarea value={form.medicaments_actuels} onChange={(e) => set("medicaments_actuels", e.target.value)} style={S.textarea} placeholder="Médicaments en cours..." rows={2} />
            </div>
          </div>

          {/* ── Alertes médicales ─── */}
          <div style={S.section}>
            <p style={S.sectionTitle}>⚠ Alertes médicales</p>
            <div style={S.alerteGrid}>
              {ALERTES.map(({ key, label, icon, niveau }) => (
                <label
                  key={key}
                  style={S.alerteItem(form[key], niveau)}
                  onClick={() => toggleAlerte(key)}
                >
                  <input
                    type="checkbox"
                    checked={form[key]}
                    onChange={() => toggleAlerte(key)}
                    style={{ display: "none" }}
                  />
                  <span style={{ fontSize: "1rem" }}>{icon}</span>
                  <span style={S.alerteLabel(form[key], niveau)}>{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* ── Note ─── */}
          <div style={S.section}>
            <p style={S.sectionTitle}>Note interne</p>
            <textarea
              value={form.note_generale}
              onChange={(e) => set("note_generale", e.target.value)}
              style={S.textarea}
              placeholder="Note visible uniquement par le dentiste..."
              rows={3}
            />
          </div>

          {/* Footer */}
          <div style={S.footer}>
            <button type="button" onClick={onCancel} style={S.btnCancel} disabled={saving}>
              Annuler
            </button>
            <button type="submit" style={{ ...S.btnSubmit, opacity: saving ? 0.65 : 1 }} disabled={saving}>
              {saving
                ? "Enregistrement…"
                : mode === "create" ? "Créer le patient" : "Enregistrer"}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}