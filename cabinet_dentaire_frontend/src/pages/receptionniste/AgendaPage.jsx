/**
 * src/pages/receptionniste/AgendaPage.jsx
 * ✅ Utilise useReceptionnisteRendezVous
 */

import { useEffect, useState, useRef } from "react";
import { useReceptionnisteRendezVous } from "../../hooks/useRendezVous";
import { useNotificationContext } from "../../context/NotificationContext";
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
  PENDING: "En attente…",
  ACCEPTE: "Accepté ✓",
  REFUSE:  "Refusé ✗",
  ANNULE:  "Annulé",
  TERMINE: "Terminé",
};

export default function AgendaPage() {
  const { showSuccess, showError } = useToast();

  const {
    rdvs, loading, error,
    creerRDV, mettreAJourStatut,
  } = useReceptionnisteRendezVous({ ordering: "date_heure" });

  const { notifications } = useNotificationContext();
  const derniereNotifRef  = useRef(null);

  const [patients,   setPatients]   = useState([]);
  const [showForm,   setShowForm]   = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [filterDate, setFilterDate] = useState("");

  useEffect(() => {
    getPatients({ ordering: "nom", statut: "ACCEPTE" })
      .then((d) => setPatients(d?.results || d || []))
      .catch(() => {});
  }, []);

  // ✅ Mise à jour statut RDV en temps réel via WebSocket
  useEffect(() => {
    if (!notifications.length) return;
    const derniere = notifications[0];
    if (derniere.id === derniereNotifRef.current) return;
    derniereNotifRef.current = derniere.id;

    const rdvId = derniere.rdv_id;
    if (!rdvId) return;

    if (derniere.type === "RDV_VALIDE") {
      mettreAJourStatut(rdvId, "ACCEPTE");
      showSuccess(`✓ RDV de ${derniere.patient_nom || ""} accepté.`);
    } else if (derniere.type === "RDV_REFUSE") {
      mettreAJourStatut(rdvId, "REFUSE");
      showError(`✗ RDV de ${derniere.patient_nom || ""} refusé.`);
    }
  }, [notifications, mettreAJourStatut, showSuccess, showError]);

  const rdvsFiltres = filterDate
    ? rdvs.filter((r) => r.date_heure?.startsWith(filterDate))
    : rdvs;

  const handleCreate = async (values) => {
    setSubmitting(true);
    setFormErrors({});
    try {
      await creerRDV(values);
      showSuccess("RDV créé. En attente de validation par le dentiste.");
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
            const sc = STATUT_COLORS[r.statut] || STATUT_COLORS.PENDING;
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
                  {r.statut === "PENDING" && (
                    <span style={styles.waitingHint}>En attente du dentiste</span>
                  )}
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
    </div>
  );
}

const styles = {
  page:        { display: "flex", flexDirection: "column", gap: "1rem" },
  dateInput:   { padding: "0.6rem 0.875rem", border: "1.5px solid #d1d5db", borderRadius: "8px", fontSize: "0.9rem" },
  clearBtn:    { padding: "0.6rem 0.875rem", border: "1px solid #d1d5db", borderRadius: "8px", background: "#f9fafb", cursor: "pointer", fontSize: "0.875rem" },
  list:        { display: "flex", flexDirection: "column", gap: "0.6rem" },
  card:        { background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "1rem 1.25rem", display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" },
  cardLeft:    { textAlign: "center", minWidth: "60px" },
  hour:        { fontSize: "1.05rem", fontWeight: 700, color: "#0f4c81" },
  dateText:    { fontSize: "0.75rem", color: "#6b7280" },
  cardBody:    { flex: 1, display: "flex", flexDirection: "column", gap: "2px" },
  patientName: { fontSize: "0.95rem", color: "#111827" },
  motif:       { fontSize: "0.8rem", color: "#6b7280" },
  cardRight:   { display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" },
  statPill:    { padding: "3px 10px", borderRadius: "12px", fontSize: "0.75rem", fontWeight: 600 },
  waitingHint: { fontSize: "0.75rem", color: "#9ca3af", fontStyle: "italic" },
};