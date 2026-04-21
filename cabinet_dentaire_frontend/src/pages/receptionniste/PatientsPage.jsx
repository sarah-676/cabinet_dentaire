/**
 * src/pages/receptionniste/PatientsPage.jsx
 * ────────────────────────────────────────────
 * Page patients pour la réceptionniste.
 *
 * Différences avec le dentiste :
 *   - Peut CRÉER des patients mais doit sélectionner un dentiste
 *   - La création envoie statut PENDING (workflow validation)
 *   - NE PEUT PAS valider / refuser (boutons onValider absents)
 *   - NE PEUT PAS archiver / modifier (lecture + création seulement)
 *   - Voit TOUS les patients actifs (pas seulement les siens)
 *
 * Workflow backend :
 *   POST /api/patients/ avec dentiste_id → statut PENDING
 *   Le dentiste reçoit une notification RabbitMQ
 */

import { useState, useRef, useEffect } from "react";
import { usePatients }    from "../../hooks/usePatients";
import PatientCard        from "../../components/patients/PatientCard";
import PatientForm        from "../../components/patients/PatientForm";
import Modal              from "../../components/ui/Modal";
import { getDentistes }   from "../../api/authAPI";

export default function PatientsReceptionniste() {
  const searchRef = useRef(null);

  const {
    patients,
    pagination,
    loading,
    error,
    setFilters,
    createPatient,
  } = usePatients();

  const [showForm,    setShowForm]    = useState(false);
  const [dentistes,   setDentistes]   = useState([]);
  const [formLoading, setFormLoading] = useState(false);
  const [formError,   setFormError]   = useState(null);
  const [successMsg,  setSuccessMsg]  = useState(null);

  // Charger la liste des dentistes pour le select
  useEffect(() => {
    getDentistes()
      .then((data) => setDentistes(Array.isArray(data) ? data : data.results || []))
      .catch(() => {});
  }, []);

  const debounceRef = useRef(null);
  const handleSearch = (e) => {
    const q = e.target.value;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setFilters((prev) => ({ ...prev, search: q || undefined }));
    }, 350);
  };

  const handleCreate = async (payload) => {
    setFormLoading(true);
    setFormError(null);
    try {
      await createPatient(payload);
      setShowForm(false);
      setSuccessMsg("Demande envoyée au dentiste pour validation.");
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      setFormError(
        err.response?.data
          ? JSON.stringify(err.response.data)
          : "Erreur lors de l'envoi."
      );
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      {/* En-tête */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Patients</h1>
          <p style={styles.subtitle}>{pagination.count} patient(s) trouvé(s)</p>
        </div>
        <button onClick={() => setShowForm(true)} style={styles.btnAdd}>
          + Nouveau patient
        </button>
      </div>

      {/* Message succès */}
      {successMsg && (
        <div style={styles.success}>{successMsg}</div>
      )}

      {/* Recherche */}
      <input
        ref={searchRef}
        onChange={handleSearch}
        placeholder="Rechercher par nom, téléphone ou email..."
        style={styles.searchInput}
      />

      {error && <div style={styles.error}>{error}</div>}

      {/* Liste — lecture seule pour la réceptionniste */}
      {loading ? (
        <div style={styles.loading}>Chargement...</div>
      ) : patients.length === 0 ? (
        <div style={styles.empty}>Aucun patient trouvé.</div>
      ) : (
        <div style={styles.grid}>
          {patients.map((p) => (
            <PatientCard
              key={p.id}
              patient={p}
              showActions={false}  // ← pas d'actions pour la réceptionniste
            />
          ))}
        </div>
      )}

      {/* Modal création */}
      {showForm && (
        <Modal title="Nouveau patient" onClose={() => setShowForm(false)}>
          <p style={styles.infoBox}>
            Le patient sera envoyé au dentiste sélectionné pour validation.
          </p>
          {formError && <div style={styles.formError}>{formError}</div>}
          <PatientForm
            dentistes={dentistes}
            isReceptionniste={true}
            onSubmit={handleCreate}
            onCancel={() => setShowForm(false)}
            loading={formLoading}
          />
        </Modal>
      )}
    </div>
  );
}

const styles = {
  page:        { display: "flex", flexDirection: "column", gap: "1.5rem" },
  header:      { display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" },
  title:       { fontSize: "1.6rem", fontWeight: 700, color: "#111827", margin: 0 },
  subtitle:    { color: "#6b7280", fontSize: "0.9rem", marginTop: "2px" },
  btnAdd:      { padding: "0.65rem 1.25rem", background: "#0f4c81", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "0.9rem", fontWeight: 600 },
  searchInput: { padding: "0.6rem 0.875rem", border: "1.5px solid #d1d5db", borderRadius: "8px", fontSize: "0.9rem", outline: "none", width: "100%", boxSizing: "border-box" },
  error:       { background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", padding: "0.75rem 1rem", color: "#dc2626", fontSize: "0.88rem" },
  success:     { background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: "8px", padding: "0.75rem 1rem", color: "#059669", fontSize: "0.88rem", fontWeight: 500 },
  loading:     { color: "#6b7280", padding: "2rem 0" },
  empty:       { textAlign: "center", color: "#6b7280", padding: "3rem 0" },
  grid:        { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "1rem" },
  infoBox:     { background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: "6px", padding: "0.6rem 0.9rem", color: "#1d4ed8", fontSize: "0.83rem", marginBottom: "1rem" },
  formError:   { background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "6px", padding: "0.6rem 0.9rem", color: "#dc2626", fontSize: "0.83rem", marginBottom: "1rem" },
};