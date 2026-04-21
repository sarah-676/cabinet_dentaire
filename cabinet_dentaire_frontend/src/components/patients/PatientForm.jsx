/**
 * src/components/patients/PatientForm.jsx
 * ─────────────────────────────────────────
 * Formulaire de création / modification d'un patient.
 *
 * Adapté à PatientCreateUpdateSerializer (backend) :
 *   nom, prenom, sexe, date_naissance, telephone, email, adresse,
 *   groupe_sanguin, allergies, antecedents, medicaments_actuels,
 *   note_generale, alerte_* (6 booléens)
 *
 * Pour la réceptionniste : affiche aussi dentiste_id (select)
 *
 * Props :
 *   initial       : objet patient (null = création)
 *   dentistes     : array [{id, full_name}] (requis si isReceptionniste)
 *   isReceptionniste : bool
 *   onSubmit      : async (payload) => void
 *   onCancel      : () => void
 *   loading       : bool
 */

const GROUPES = ["A+","A-","B+","B-","AB+","AB-","O+","O-","INCONNU"];

export default function PatientForm({
  initial = null,
  dentistes = [],
  isReceptionniste = false,
  onSubmit,
  onCancel,
  loading = false,
}) {
  const [form, setForm] = React.useState({
    nom:                initial?.nom            || "",
    prenom:             initial?.prenom         || "",
    sexe:               initial?.sexe           || "",
    date_naissance:     initial?.date_naissance || "",
    telephone:          initial?.telephone      || "",
    email:              initial?.email          || "",
    adresse:            initial?.adresse        || "",
    groupe_sanguin:     initial?.groupe_sanguin || "INCONNU",
    allergies:          initial?.allergies      || "",
    antecedents:        initial?.antecedents    || "",
    medicaments_actuels: initial?.medicaments_actuels || "",
    note_generale:      initial?.note_generale  || "",
    alerte_anticoagulants: initial?.alerte_anticoagulants || false,
    alerte_diabete:        initial?.alerte_diabete        || false,
    alerte_grossesse:      initial?.alerte_grossesse      || false,
    alerte_allergie_latex: initial?.alerte_allergie_latex || false,
    alerte_cardiopathie:   initial?.alerte_cardiopathie   || false,
    alerte_immunodeprime:  initial?.alerte_immunodeprime  || false,
    dentiste_id: initial?.dentiste_id || (dentistes[0]?.id || ""),
  });
  const [errors, setErrors] = React.useState({});

  const set = (field) => (e) => {
    const value = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: null }));
  };

  const validate = () => {
    const errs = {};
    if (!form.nom.trim())           errs.nom           = "Nom obligatoire.";
    if (!form.prenom.trim())        errs.prenom        = "Prénom obligatoire.";
    if (!form.date_naissance)       errs.date_naissance = "Date de naissance obligatoire.";
    if (!form.telephone.trim())     errs.telephone     = "Téléphone obligatoire.";
    if (isReceptionniste && !form.dentiste_id) errs.dentiste_id = "Sélectionnez un dentiste.";
    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    const payload = { ...form };
    if (!isReceptionniste) delete payload.dentiste_id;

    await onSubmit(payload);
  };

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      <div style={styles.grid2}>
        <Field label="Nom *" error={errors.nom}>
          <input style={styles.input} value={form.nom} onChange={set("nom")} placeholder="NOM" />
        </Field>
        <Field label="Prénom *" error={errors.prenom}>
          <input style={styles.input} value={form.prenom} onChange={set("prenom")} placeholder="Prénom" />
        </Field>
      </div>

      <div style={styles.grid2}>
        <Field label="Date de naissance *" error={errors.date_naissance}>
          <input type="date" style={styles.input} value={form.date_naissance} onChange={set("date_naissance")} />
        </Field>
        <Field label="Sexe">
          <select style={styles.input} value={form.sexe} onChange={set("sexe")}>
            <option value="">— Sélectionner —</option>
            <option value="M">Masculin</option>
            <option value="F">Féminin</option>
          </select>
        </Field>
      </div>

      <div style={styles.grid2}>
        <Field label="Téléphone *" error={errors.telephone}>
          <input style={styles.input} value={form.telephone} onChange={set("telephone")} placeholder="+213 555 ..." />
        </Field>
        <Field label="Email">
          <input type="email" style={styles.input} value={form.email} onChange={set("email")} placeholder="email@exemple.com" />
        </Field>
      </div>

      <Field label="Adresse">
        <input style={styles.input} value={form.adresse} onChange={set("adresse")} placeholder="Ville, Algérie" />
      </Field>

      <Field label="Groupe sanguin">
        <select style={styles.input} value={form.groupe_sanguin} onChange={set("groupe_sanguin")}>
          {GROUPES.map((g) => <option key={g} value={g}>{g === "INCONNU" ? "Non renseigné" : g}</option>)}
        </select>
      </Field>

      {isReceptionniste && (
        <Field label="Dentiste assigné *" error={errors.dentiste_id}>
          <select style={styles.input} value={form.dentiste_id} onChange={set("dentiste_id")}>
            <option value="">— Sélectionner un dentiste —</option>
            {dentistes.map((d) => (
              <option key={d.id} value={d.id}>{d.full_name || `${d.first_name} ${d.last_name}`}</option>
            ))}
          </select>
        </Field>
      )}

      {/* Section médicale */}
      <div style={styles.sectionTitle}>Informations médicales</div>
      <Field label="Allergies">
        <textarea style={styles.textarea} value={form.allergies} onChange={set("allergies")} rows={2} placeholder="Pénicilline, latex..." />
      </Field>
      <Field label="Antécédents médicaux">
        <textarea style={styles.textarea} value={form.antecedents} onChange={set("antecedents")} rows={2} />
      </Field>
      <Field label="Médicaments actuels">
        <textarea style={styles.textarea} value={form.medicaments_actuels} onChange={set("medicaments_actuels")} rows={2} />
      </Field>

      {/* Alertes */}
      <div style={styles.sectionTitle}>Alertes médicales</div>
      <div style={styles.alerteGrid}>
        {[
          ["alerte_anticoagulants", "Sous anticoagulants"],
          ["alerte_diabete",        "Diabétique"],
          ["alerte_grossesse",      "Enceinte"],
          ["alerte_allergie_latex", "Allergie au latex"],
          ["alerte_cardiopathie",   "Cardiopathie"],
          ["alerte_immunodeprime",  "Immunodéprimé"],
        ].map(([key, label]) => (
          <label key={key} style={styles.checkLabel}>
            <input
              type="checkbox"
              checked={form[key]}
              onChange={set(key)}
              style={{ marginRight: "6px", accentColor: "#dc2626" }}
            />
            {label}
          </label>
        ))}
      </div>

      <Field label="Note générale">
        <textarea style={styles.textarea} value={form.note_generale} onChange={set("note_generale")} rows={2} />
      </Field>

      {/* Boutons */}
      <div style={styles.footer}>
        <button type="button" onClick={onCancel} style={styles.btnCancel}>Annuler</button>
        <button type="submit" disabled={loading} style={styles.btnSubmit}>
          {loading ? "Enregistrement..." : (initial ? "Enregistrer" : "Créer le patient")}
        </button>
      </div>
    </form>
  );
}

function Field({ label, error, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
      <label style={{ fontSize: "0.83rem", fontWeight: 500, color: "#374151" }}>{label}</label>
      {children}
      {error && <span style={{ fontSize: "0.75rem", color: "#dc2626" }}>{error}</span>}
    </div>
  );
}

import React from "react";

const styles = {
  form:         { display: "flex", flexDirection: "column", gap: "1rem" },
  grid2:        { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" },
  input:        { padding: "0.6rem 0.75rem", border: "1.5px solid #d1d5db", borderRadius: "8px", fontSize: "0.9rem", outline: "none", width: "100%", boxSizing: "border-box" },
  textarea:     { padding: "0.6rem 0.75rem", border: "1.5px solid #d1d5db", borderRadius: "8px", fontSize: "0.9rem", outline: "none", width: "100%", boxSizing: "border-box", resize: "vertical" },
  sectionTitle: { fontSize: "0.85rem", fontWeight: 600, color: "#0f4c81", borderBottom: "1px solid #e5e7eb", paddingBottom: "0.3rem", marginTop: "0.5rem" },
  alerteGrid:   { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "0.5rem" },
  checkLabel:   { display: "flex", alignItems: "center", fontSize: "0.83rem", color: "#374151", cursor: "pointer" },
  footer:       { display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.5rem" },
  btnCancel:    { padding: "0.6rem 1.25rem", background: "#f3f4f6", color: "#374151", border: "1px solid #d1d5db", borderRadius: "8px", cursor: "pointer", fontSize: "0.9rem" },
  btnSubmit:    { padding: "0.6rem 1.5rem", background: "#0f4c81", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "0.9rem", fontWeight: 600 },
};