/**
 * src/components/patients/PatientForm.jsx
 * ─────────────────────────────────────────
 * Modale formulaire création / modification patient.
 * Utilisée par le dentiste ET la réceptionniste.
 *
 * Réceptionniste → doit choisir un dentiste (getDentistes)
 * Dentiste       → dentiste_id injecté côté backend depuis JWT
 */

import { useState, useEffect } from "react";
import { createPatient, updatePatient } from "../../api/patientsAPI";
import { getDentistes } from "../../api/authAPI";
import { useAuth } from "../../context/AuthContext";
import { ROLES } from "../../utils/roles";

const EMPTY_FORM = {
  nom: "", prenom: "", sexe: "", date_naissance: "",
  telephone: "", email: "", adresse: "",
  groupe_sanguin: "INCONNU",
  allergies: "", antecedents: "", medicaments_actuels: "",
  alerte_anticoagulants: false, alerte_diabete: false,
  alerte_grossesse: false, alerte_allergie_latex: false,
  alerte_cardiopathie: false, alerte_immunodeprime: false,
  dentiste_id: "",
};

export default function PatientForm({ patient, onClose, onSaved }) {
  const { user } = useAuth();
  const isReception = user?.role === ROLES.RECEPTIONNISTE;

  const [form,       setForm]      = useState(patient ? _toForm(patient) : EMPTY_FORM);
  const [dentistes,  setDentistes] = useState([]);
  const [errors,     setErrors]    = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isReception) getDentistes().then(setDentistes).catch(() => {});
  }, [isReception]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === "checkbox" ? checked : value }));
    if (errors[name]) setErrors((e) => ({ ...e, [name]: "" }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setErrors({});
    try {
      const payload = { ...form };
      if (!isReception) delete payload.dentiste_id;
      if (patient) {
        await updatePatient(patient.id, payload);
      } else {
        await createPatient(payload);
      }
      onSaved();
    } catch (err) {
      const data = err.response?.data;
      if (typeof data === "object") {
        setErrors(data);
      } else {
        setErrors({ non_field_errors: ["Erreur serveur. Veuillez réessayer."] });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={styles.modal}>

        <div style={styles.modalHeader}>
          <h2 style={styles.modalTitle}>
            {patient ? "Modifier le patient" : "Nouveau patient"}
          </h2>
          <button onClick={onClose} style={styles.closeBtn}>✕</button>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>

          {errors.non_field_errors && (
            <div style={styles.errorBanner}>{errors.non_field_errors[0]}</div>
          )}

          {/* Réceptionniste : sélection dentiste */}
          {isReception && (
            <Field label="Dentiste référent *" error={errors.dentiste_id}>
              <select name="dentiste_id" value={form.dentiste_id} onChange={handleChange} required style={styles.input}>
                <option value="">Sélectionner un dentiste</option>
                {dentistes.map((d) => (
                  <option key={d.id} value={d.id}>{d.full_name || d.email}</option>
                ))}
              </select>
            </Field>
          )}

          <div style={styles.row}>
            <Field label="Nom *" error={errors.nom}>
              <input name="nom" value={form.nom} onChange={handleChange} required placeholder="DUPONT" style={styles.input} />
            </Field>
            <Field label="Prénom *" error={errors.prenom}>
              <input name="prenom" value={form.prenom} onChange={handleChange} required placeholder="Jean" style={styles.input} />
            </Field>
          </div>

          <div style={styles.row}>
            <Field label="Date de naissance *" error={errors.date_naissance}>
              <input type="date" name="date_naissance" value={form.date_naissance} onChange={handleChange} required style={styles.input} />
            </Field>
            <Field label="Sexe" error={errors.sexe}>
              <select name="sexe" value={form.sexe} onChange={handleChange} style={styles.input}>
                <option value="">—</option>
                <option value="M">Masculin</option>
                <option value="F">Féminin</option>
              </select>
            </Field>
          </div>

          <div style={styles.row}>
            <Field label="Téléphone *" error={errors.telephone}>
              <input name="telephone" value={form.telephone} onChange={handleChange} required placeholder="0551234567" style={styles.input} />
            </Field>
            <Field label="Email" error={errors.email}>
              <input type="email" name="email" value={form.email} onChange={handleChange} placeholder="patient@email.com" style={styles.input} />
            </Field>
          </div>

          <Field label="Adresse" error={errors.adresse}>
            <input name="adresse" value={form.adresse} onChange={handleChange} placeholder="Adresse complète" style={styles.input} />
          </Field>

          {/* Médical */}
          <div style={styles.sectionSep}>Informations médicales</div>

          <div style={styles.row}>
            <Field label="Groupe sanguin" error={errors.groupe_sanguin}>
              <select name="groupe_sanguin" value={form.groupe_sanguin} onChange={handleChange} style={styles.input}>
                <option value="INCONNU">Non renseigné</option>
                {["A+","A-","B+","B-","AB+","AB-","O+","O-"].map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Allergies" error={errors.allergies}>
            <textarea name="allergies" value={form.allergies} onChange={handleChange} rows={2} placeholder="Allergies connues..." style={styles.textarea} />
          </Field>

          <Field label="Antécédents médicaux" error={errors.antecedents}>
            <textarea name="antecedents" value={form.antecedents} onChange={handleChange} rows={2} placeholder="Antécédents..." style={styles.textarea} />
          </Field>

          <Field label="Médicaments actuels" error={errors.medicaments_actuels}>
            <textarea name="medicaments_actuels" value={form.medicaments_actuels} onChange={handleChange} rows={2} placeholder="Médicaments en cours..." style={styles.textarea} />
          </Field>

          {/* Alertes */}
          <div style={styles.sectionSep}>Alertes médicales</div>
          <div style={styles.checkGrid}>
            {ALERTES.map(({ name, label }) => (
              <label key={name} style={styles.checkLabel}>
                <input type="checkbox" name={name} checked={form[name]} onChange={handleChange} />
                {label}
              </label>
            ))}
          </div>

          {/* Actions */}
          <div style={styles.formActions}>
            <button type="button" onClick={onClose} style={styles.cancelBtn}>Annuler</button>
            <button type="submit" disabled={submitting} style={styles.submitBtn}>
              {submitting ? "Enregistrement..." : patient ? "Modifier" : "Créer le patient"}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}

// ── Sous-composants ───────────────────────────────────────────────────────────

function Field({ label, error, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem", flex: 1 }}>
      <label style={{ fontSize: "0.8rem", fontWeight: 500, color: "#374151" }}>{label}</label>
      {children}
      {error && <span style={{ fontSize: "0.75rem", color: "#dc2626" }}>{Array.isArray(error) ? error[0] : error}</span>}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const ALERTES = [
  { name: "alerte_anticoagulants",  label: "Anticoagulants" },
  { name: "alerte_diabete",         label: "Diabète" },
  { name: "alerte_grossesse",       label: "Grossesse" },
  { name: "alerte_allergie_latex",  label: "Allergie latex" },
  { name: "alerte_cardiopathie",    label: "Cardiopathie" },
  { name: "alerte_immunodeprime",   label: "Immunodéprimé" },
];

function _toForm(p) {
  return {
    nom: p.nom || "", prenom: p.prenom || "",
    sexe: p.sexe || "", date_naissance: p.date_naissance || "",
    telephone: p.telephone || "", email: p.email || "", adresse: p.adresse || "",
    groupe_sanguin: p.groupe_sanguin || "INCONNU",
    allergies: p.allergies || "", antecedents: p.antecedents || "",
    medicaments_actuels: p.medicaments_actuels || "",
    alerte_anticoagulants: p.alerte_anticoagulants || false,
    alerte_diabete: p.alerte_diabete || false,
    alerte_grossesse: p.alerte_grossesse || false,
    alerte_allergie_latex: p.alerte_allergie_latex || false,
    alerte_cardiopathie: p.alerte_cardiopathie || false,
    alerte_immunodeprime: p.alerte_immunodeprime || false,
    dentiste_id: p.dentiste_id || "",
  };
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = {
  overlay:    { position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 1000, overflowY: "auto", padding: "2rem 1rem" },
  modal:      { background: "#fff", borderRadius: "16px", width: "100%", maxWidth: "600px", boxShadow: "0 8px 40px rgba(0,0,0,0.2)" },
  modalHeader:{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1.25rem 1.5rem", borderBottom: "1px solid #e5e7eb" },
  modalTitle: { margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "#111827" },
  closeBtn:   { background: "none", border: "none", cursor: "pointer", fontSize: "1.1rem", color: "#6b7280" },
  form:       { padding: "1.5rem", display: "flex", flexDirection: "column", gap: "0.875rem" },
  row:        { display: "flex", gap: "0.75rem", flexWrap: "wrap" },
  input:      { padding: "0.6rem 0.75rem", border: "1.5px solid #d1d5db", borderRadius: "8px", fontSize: "0.9rem", width: "100%", boxSizing: "border-box" },
  textarea:   { padding: "0.6rem 0.75rem", border: "1.5px solid #d1d5db", borderRadius: "8px", fontSize: "0.875rem", width: "100%", boxSizing: "border-box", resize: "vertical", fontFamily: "inherit" },
  sectionSep: { fontSize: "0.8rem", fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", paddingTop: "0.5rem", borderTop: "1px solid #e5e7eb" },
  checkGrid:  { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "0.5rem" },
  checkLabel: { display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem", cursor: "pointer" },
  errorBanner:{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", padding: "0.75rem", color: "#dc2626", fontSize: "0.875rem" },
  formActions:{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", paddingTop: "0.5rem" },
  cancelBtn:  { padding: "0.6rem 1.25rem", border: "1.5px solid #d1d5db", borderRadius: "8px", background: "#fff", cursor: "pointer", fontSize: "0.9rem" },
  submitBtn:  { padding: "0.6rem 1.5rem", background: "#0f4c81", color: "#fff", border: "none", borderRadius: "8px", fontWeight: 600, cursor: "pointer", fontSize: "0.9rem" },
};