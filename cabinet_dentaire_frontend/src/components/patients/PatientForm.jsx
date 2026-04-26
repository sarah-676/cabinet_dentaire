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
import EntityForm from "../ui/EntityForm";

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

  const [form] = useState(patient ? _toForm(patient) : EMPTY_FORM);
  const [dentistes,  setDentistes] = useState([]);
  const [errors,     setErrors]    = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isReception) getDentistes().then(setDentistes).catch(() => {});
  }, [isReception]);

  const handleSubmit = async (values) => {
    setSubmitting(true);
    setErrors({});
    try {
      const payload = { ...values };
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

  const fields = [
    ...(isReception
      ? [{
          name: "dentiste_id",
          label: "Dentiste référent *",
          type: "select",
          required: true,
          options: [
            { value: "", label: "Sélectionner un dentiste" },
            ...dentistes.map((d) => ({ value: d.id, label: d.full_name || d.email })),
          ],
        }]
      : []),
    { name: "nom", label: "Nom *", type: "text", required: true, placeholder: "DUPONT" },
    { name: "prenom", label: "Prénom *", type: "text", required: true, placeholder: "Jean" },
    { name: "date_naissance", label: "Date de naissance *", type: "date", required: true },
    {
      name: "sexe",
      label: "Sexe",
      type: "select",
      options: [
        { value: "", label: "—" },
        { value: "M", label: "Masculin" },
        { value: "F", label: "Féminin" },
      ],
    },
    { name: "telephone", label: "Téléphone *", type: "text", required: true, placeholder: "0551234567" },
    { name: "email", label: "Email", type: "email", placeholder: "patient@email.com" },
    { name: "adresse", label: "Adresse", type: "text", placeholder: "Adresse complète" },
    {
      name: "groupe_sanguin",
      label: "Groupe sanguin",
      type: "select",
      options: [
        { value: "INCONNU", label: "Non renseigné" },
        ...["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((g) => ({ value: g, label: g })),
      ],
    },
    { name: "allergies", label: "Allergies", type: "textarea", rows: 2, placeholder: "Allergies connues..." },
    { name: "antecedents", label: "Antécédents médicaux", type: "textarea", rows: 2, placeholder: "Antécédents..." },
    {
      name: "medicaments_actuels",
      label: "Médicaments actuels",
      type: "textarea",
      rows: 2,
      placeholder: "Médicaments en cours...",
    },
    ...ALERTES.map(({ name, label }) => ({
      name,
      label: "Alertes médicales",
      type: "checkbox",
      checkboxLabel: label,
    })),
  ];

  return (
    <EntityForm
      title={patient ? "Modifier le patient" : "Nouveau patient"}
      fields={fields}
      initialValues={form}
      errors={errors}
      submitting={submitting}
      submitLabel={patient ? "Modifier" : "Créer le patient"}
      onCancel={onClose}
      onSubmit={handleSubmit}
      validate={(values) => ({
        nom: !values.nom ? "Nom requis." : "",
        prenom: !values.prenom ? "Prénom requis." : "",
        date_naissance: !values.date_naissance ? "Date de naissance requise." : "",
        telephone: !values.telephone ? "Téléphone requis." : "",
        dentiste_id: isReception && !values.dentiste_id ? "Dentiste requis." : "",
      })}
    />
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
