/**
 * src/pages/dentiste/MonAgendaPage.jsx
 * ✅ Utilise useDentisteRendezVous
 */

import { useEffect, useState } from "react";
import { useDentisteRendezVous } from "../../hooks/useRendezVous";
import { getPatients } from "../../api/patientsAPI";
import PageToolbar from "../../components/ui/PageToolbar";
import EntityForm from "../../components/ui/EntityForm";
import PageState from "../../components/ui/PageState";
import InlineError from "../../components/ui/InlineError";
import { useToast } from "../../context/ToastContext";
import { extractErrorMessage } from "../../utils/errorHandler";

const STATUT_COLORS = {
  PENDING: { bg: "#fffbeb", color: "#d97706" },
  ACCEPTE: { bg: "#ecfdf5", color: "#059669" },
  REFUSE:  { bg: "#fef2f2", color: "#dc2626" },
  ANNULE:  { bg: "#f9fafb", color: "#6b7280" },
  TERMINE: { bg: "#eff6ff", color: "#2563eb" },
};

const STATUT_LABELS = {
  PENDING: "En attente",
  ACCEPTE: "Accepté",
  REFUSE:  "Refusé",
  ANNULE:  "Annulé",
  TERMINE: "Terminé",
};

export default function MonAgendaPage() {
  const { showSuccess, showError } = useToast();

  const {
    rdvs, loading, error,
    creerRDV, valider, annuler, terminer,
  } = useDentisteRendezVous({ ordering: "date_heure" });

  const [patients,   setPatients]   = useState([]);
  const [showForm,   setShowForm]   = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [filterDate, setFilterDate] = useState("");

  const [refusModal,      setRefusModal]      = useState(false);
  const [refusRdv,        setRefusRdv]        = useState(null);
  const [refusRaison,     setRefusRaison]     = useState("");
  const [refusSubmitting, setRefusSubmitting] = useState(false);

  useEffect(() => {
    // ✅ Dentiste voit uniquement ses patients acceptés
    getPatients({ ordering: "nom", statut: "ACCEPTE" })
      .then((d) => setPatients(d?.results || d || []))
      .catch(() => {});
  }, []);

  const rdvsFiltres = filterDate
    ? rdvs.filter((r) => r.date_heure?.startsWith(filterDate))
    : rdvs;

  const handleAccepter = async (id, nom) => {
    try {
      await valider(id, "ACCEPTE");
      showSuccess(`RDV de ${nom} accepté. Notification envoyée.`);
    } catch (err) {
      showError(extractErrorMessage(err));
    }
  };

  const ouvrirRefus = (rdv) => {
    setRefusRdv(rdv);
    setRefusRaison("");
    setRefusModal(true);
  };

  const confirmerRefus = async () => {
    if (!refusRaison.trim()) {
      showError("La raison du refus est obligatoire.");
      return;
    }
    setRefusSubmitting(true);
    try {
      await valider(refusRdv.id, "REFUSE", refusRaison);
      showSuccess(`RDV de ${refusRdv.patient_nom} refusé.`);
      setRefusModal(false);
    } catch (err) {
      showError(extractErrorMessage(err));
    } finally {
      setRefusSubmitting(false);
    }
  };

  const handleAnnuler = async (rdv) => {
    const raison = window.prompt(`Raison d'annulation pour ${rdv.patient_nom} :`);
    if (raison === null) return;
    try {
      await annuler(rdv.id, raison);
      showSuccess("Rendez-vous annulé.");
    } catch (err) {
      showError(extractErrorMessage(err));
    }
  };

  const handleTerminer = async (rdv) => {
    try {
      await terminer(rdv.id);
      showSuccess(`RDV de ${rdv.patient_nom} terminé.`);
    } catch (err) {
      showError(extractErrorMessage(err));
    }
  };

  const handleCreate = async (values) => {
    setSubmitting(true);
    setFormErrors({});
    try {
      await creerRDV(values);
      showSuccess("Rendez-vous créé.");
      setShowForm(false);
    } catch (err) {
      setFormErrors(err?.response?.data || {});
      showError(extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={styles.page}>
      <PageToolbar
        title="Agenda des rendez-vous"
        filters={[
          <input
            key="date"
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            style={styles.dateInput}
          />,
          filterDate && (
            <button key="clear" onClick={() => setFilterDate("")} style={styles.clearBtn}>
              Tout voir
            </button>
          ),
        ].filter(Boolean)}
        addLabel="+ Nouveau RDV"
        onAdd={() => setShowForm(true)}
      />

      <InlineError message={error} />

      {loading ? (
        <PageState type="loading" />
      ) : rdvsFiltres.length === 0 ? (
        <PageState type="empty" message={`Aucun rendez-vous${filterDate ? " ce jour" : ""}.`} />
      ) : (
        <div style={styles.list}>
          {rdvsFiltres.map((r) => {
            const sc = STATUT_COLORS[r.statut] || STATUT_COLORS.ACCEPTE;
            return (
              <div key={r.id} style={styles.card}>
                <div style={styles.cardLeft}>
                  <div style={styles.hour}>
                    {r.date_heure
                      ? new Date(r.date_heure).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
                      : "—"}
                  </div>
                  <div style={styles.dateText}>
                    {r.date_heure ? new Date(r.date_heure).toLocaleDateString("fr-FR") : ""}
                  </div>
                </div>
                <div style={styles.cardBody}>
                  <strong style={styles.patientName}>{r.patient_nom || "—"}</strong>
                  <span style={styles.motif}>{r.motif || r.type_soin || "Consultation"}</span>
                </div>
                <div style={styles.cardRight}>
                  <span style={{ ...styles.statPill, ...sc }}>
                    {STATUT_LABELS[r.statut] || r.statut}
                  </span>
                  <div style={styles.actions}>
                    {r.statut === "PENDING" && (
                      <>
                        <button onClick={() => handleAccepter(r.id, r.patient_nom)} style={styles.btnGreen}>✓ Accepter</button>
                        <button onClick={() => ouvrirRefus(r)} style={styles.btnRed}>✗ Refuser</button>
                      </>
                    )}
                    {r.statut === "ACCEPTE" && (
                      <>
                        <button onClick={() => handleTerminer(r)} style={styles.btnBlue}>Terminé</button>
                        <button onClick={() => handleAnnuler(r)} style={styles.btnGray}>Annuler</button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <EntityForm
          title="Nouveau rendez-vous"
          initialValues={{
            patient: "", date_heure: "",
            duree_minutes: 30, type_soin: "CONSULTATION",
            priorite: "NORMALE", motif: "",
          }}
          errors={formErrors}
          submitting={submitting}
          submitLabel="Créer le RDV"
          onCancel={() => setShowForm(false)}
          onSubmit={handleCreate}
          validate={(v) => ({
            patient:    !v.patient    ? "Patient requis." : "",
            date_heure: !v.date_heure ? "Date requise." : "",
          })}
          fields={[
            {
              name: "patient", label: "Patient *", type: "select", required: true,
              options: [
                { value: "", label: "Sélectionner un patient" },
                ...patients.map((p) => ({ value: p.id, label: p.nom_complet })),
              ],
            },
            { name: "date_heure",    label: "Date et heure *", type: "datetime-local", required: true },
            { name: "duree_minutes", label: "Durée (min)",     type: "number" },
            {
              name: "type_soin", label: "Type de soin", type: "select",
              options: [
                { value: "CONSULTATION", label: "Consultation" },
                { value: "DETARTRAGE",   label: "Détartrage" },
                { value: "EXTRACTION",   label: "Extraction" },
                { value: "OBTURATION",   label: "Obturation" },
                { value: "COURONNE",     label: "Couronne" },
                { value: "IMPLANT",      label: "Implant" },
                { value: "URGENCE",      label: "Urgence" },
                { value: "CONTROLE",     label: "Contrôle" },
                { value: "AUTRE",        label: "Autre" },
              ],
            },
            {
              name: "priorite", label: "Priorité", type: "select",
              options: [
                { value: "NORMALE", label: "Normale" },
                { value: "HAUTE",   label: "Haute" },
                { value: "URGENTE", label: "Urgente" },
              ],
            },
            { name: "motif", label: "Motif", type: "text", placeholder: "Motif..." },
          ]}
        />
      )}

      {refusModal && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <h3 style={{ margin: "0 0 1rem" }}>Refuser — {refusRdv?.patient_nom}</h3>
            <label style={styles.label}>Raison <span style={{ color: "#dc2626" }}>*</span></label>
            <textarea
              value={refusRaison}
              onChange={(e) => setRefusRaison(e.target.value)}
              rows={3}
              style={styles.textarea}
              autoFocus
            />
            <div style={styles.modalActions}>
              <button onClick={() => setRefusModal(false)} style={styles.btnGray} disabled={refusSubmitting}>Annuler</button>
              <button
                onClick={confirmerRefus}
                disabled={refusSubmitting || !refusRaison.trim()}
                style={{ ...styles.btnRed, opacity: refusRaison.trim() ? 1 : 0.5 }}
              >
                {refusSubmitting ? "Envoi…" : "Confirmer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  page:         { display: "flex", flexDirection: "column", gap: "1rem" },
  dateInput:    { padding: "0.6rem 0.875rem", border: "1.5px solid #d1d5db", borderRadius: "8px", fontSize: "0.9rem" },
  clearBtn:     { padding: "0.6rem 0.875rem", border: "1px solid #d1d5db", borderRadius: "8px", background: "#f9fafb", cursor: "pointer", fontSize: "0.875rem" },
  list:         { display: "flex", flexDirection: "column", gap: "0.6rem" },
  card:         { background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "1rem 1.25rem", display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" },
  cardLeft:     { textAlign: "center", minWidth: "60px" },
  hour:         { fontSize: "1.05rem", fontWeight: 700, color: "#0f4c81" },
  dateText:     { fontSize: "0.75rem", color: "#6b7280" },
  cardBody:     { flex: 1, display: "flex", flexDirection: "column", gap: "2px" },
  patientName:  { fontSize: "0.95rem", color: "#111827" },
  motif:        { fontSize: "0.8rem", color: "#6b7280" },
  cardRight:    { display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" },
  statPill:     { padding: "3px 10px", borderRadius: "12px", fontSize: "0.75rem", fontWeight: 600 },
  actions:      { display: "flex", gap: "0.4rem", flexWrap: "wrap" },
  btnGreen:     { padding: "0.3rem 0.7rem", background: "#059669", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "0.8rem" },
  btnRed:       { padding: "0.3rem 0.7rem", background: "#dc2626", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "0.8rem" },
  btnBlue:      { padding: "0.3rem 0.7rem", background: "#2563eb", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "0.8rem" },
  btnGray:      { padding: "0.3rem 0.7rem", background: "#f3f4f6", color: "#374151", border: "1px solid #d1d5db", borderRadius: "6px", cursor: "pointer", fontSize: "0.8rem" },
  overlay:      { position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 },
  modal:        { background: "#fff", borderRadius: "12px", padding: "1.5rem", width: "100%", maxWidth: "420px", boxShadow: "0 8px 32px rgba(0,0,0,0.18)" },
  label:        { display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.4rem", color: "#374151" },
  textarea:     { width: "100%", padding: "0.6rem", border: "1.5px solid #d1d5db", borderRadius: "8px", fontSize: "0.9rem", resize: "vertical", boxSizing: "border-box" },
  modalActions: { display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "1rem" },
};