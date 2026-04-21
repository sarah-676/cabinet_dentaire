/**
 * src/pages/dentiste/MesPatientsPage.jsx
 * ─────────────────────────────────────────
 * Page patients du dentiste.
 *
 * Fonctionnalités :
 *   - Liste paginée avec recherche et filtre par statut
 *   - Créer un nouveau patient (statut ACCEPTE auto)
 *   - Voir le détail (/dentiste/patients/:id)
 *   - Modifier un patient
 *   - Archiver un patient
 *   - Accepter / Refuser les patients PENDING (boutons inline)
 *
 * Utilise usePatients hook.
 */

import { useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { usePatients } from "../../hooks/usePatients";
import PatientCard   from "../../components/patients/PatientCard";
import PatientForm   from "../../components/patients/PatientForm";
import Modal         from "../../components/ui/Modal";

const STATUT_FILTERS = [
  { value: "",        label: "Tous" },
  { value: "ACCEPTE", label: "Actifs" },
  { value: "PENDING", label: "En attente" },
  { value: "REFUSE",  label: "Refusés" },
];

export default function MesPatientsPage() {
  const navigate = useNavigate();
  const searchRef = useRef(null);

  const {
    patients,
    pagination,
    loading,
    error,
    filters,
    setFilters,
    fetchPatients,
    createPatient,
    updatePatient,
    deletePatient,
    validerPatient,
  } = usePatients({ statut: "" });

  const [modal,        setModal]        = useState(null); // null | "create" | "edit"
  const [editPatient,  setEditPatient]  = useState(null);
  const [formLoading,  setFormLoading]  = useState(false);
  const [formError,    setFormError]    = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  // ── Recherche avec debounce ──────────────────────────────────────────
  const debounceRef = useRef(null);
  const handleSearch = (e) => {
    const q = e.target.value;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setFilters((prev) => ({ ...prev, search: q || undefined }));
    }, 350);
  };

  // ── Créer ────────────────────────────────────────────────────────────
  const handleCreate = async (payload) => {
    setFormLoading(true);
    setFormError(null);
    try {
      await createPatient(payload);
      setModal(null);
    } catch (err) {
      setFormError(
        err.response?.data
          ? JSON.stringify(err.response.data)
          : "Erreur lors de la création."
      );
    } finally {
      setFormLoading(false);
    }
  };

  // ── Modifier ─────────────────────────────────────────────────────────
  const handleUpdate = async (payload) => {
    setFormLoading(true);
    setFormError(null);
    try {
      await updatePatient(editPatient.id, payload);
      setModal(null);
      setEditPatient(null);
    } catch (err) {
      setFormError(
        err.response?.data
          ? JSON.stringify(err.response.data)
          : "Erreur lors de la modification."
      );
    } finally {
      setFormLoading(false);
    }
  };

  // ── Archiver ─────────────────────────────────────────────────────────
  const handleDelete = async (id) => {
    try {
      await deletePatient(id);
      setConfirmDelete(null);
    } catch {
      alert("Erreur lors de l'archivage.");
    }
  };

  // ── Valider ──────────────────────────────────────────────────────────
  const handleValider = useCallback(async (id, decision) => {
    await validerPatient(id, decision);
  }, [validerPatient]);

  return (
    <div style={styles.page}>
      {/* En-tête */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Mes patients</h1>
          <p style={styles.subtitle}>{pagination.count} patient(s)</p>
        </div>
        <button onClick={() => setModal("create")} style={styles.btnAdd}>
          + Nouveau patient
        </button>
      </div>

      {/* Filtres */}
      <div style={styles.toolbar}>
        <input
          ref={searchRef}
          onChange={handleSearch}
          placeholder="Rechercher par nom, téléphone ou email..."
          style={styles.searchInput}
        />
        <div style={styles.filterBtns}>
          {STATUT_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilters((prev) => ({ ...prev, statut: f.value || undefined }))}
              style={{
                ...styles.filterBtn,
                ...(filters.statut === f.value || (!filters.statut && !f.value)
                  ? styles.filterBtnActive : {}),
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Erreur */}
      {error && <div style={styles.error}>{error}</div>}

      {/* Liste */}
      {loading ? (
        <div style={styles.loading}>Chargement...</div>
      ) : patients.length === 0 ? (
        <div style={styles.empty}>
          <p>Aucun patient trouvé.</p>
          {!filters.search && (
            <button onClick={() => setModal("create")} style={styles.btnAdd}>
              Ajouter le premier patient
            </button>
          )}
        </div>
      ) : (
        <div style={styles.grid}>
          {patients.map((p) => (
            <PatientCard
              key={p.id}
              patient={p}
              onView={(id) => navigate(`/dentiste/patients/${id}`)}
              onEdit={(patient) => { setEditPatient(patient); setModal("edit"); }}
              onDelete={(id) => setConfirmDelete(id)}
              onValider={handleValider}
            />
          ))}
        </div>
      )}

      {/* Modal Créer */}
      {modal === "create" && (
        <Modal title="Nouveau patient" onClose={() => setModal(null)}>
          {formError && <div style={styles.formError}>{formError}</div>}
          <PatientForm
            onSubmit={handleCreate}
            onCancel={() => setModal(null)}
            loading={formLoading}
          />
        </Modal>
      )}

      {/* Modal Modifier */}
      {modal === "edit" && editPatient && (
        <Modal title="Modifier le patient" onClose={() => { setModal(null); setEditPatient(null); }}>
          {formError && <div style={styles.formError}>{formError}</div>}
          <PatientForm
            initial={editPatient}
            onSubmit={handleUpdate}
            onCancel={() => { setModal(null); setEditPatient(null); }}
            loading={formLoading}
          />
        </Modal>
      )}

      {/* Confirm Archiver */}
      {confirmDelete && (
        <Modal title="Confirmer l'archivage" onClose={() => setConfirmDelete(null)}>
          <p style={{ marginBottom: "1.5rem", color: "#6b7280" }}>
            Ce patient sera archivé et n'apparaîtra plus dans la liste principale.
          </p>
          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
            <button onClick={() => setConfirmDelete(null)} style={styles.btnCancel}>Annuler</button>
            <button onClick={() => handleDelete(confirmDelete)} style={styles.btnDanger}>Archiver</button>
          </div>
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
  toolbar:     { display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "center" },
  searchInput: { flex: "1 1 280px", padding: "0.6rem 0.875rem", border: "1.5px solid #d1d5db", borderRadius: "8px", fontSize: "0.9rem", outline: "none" },
  filterBtns:  { display: "flex", gap: "0.4rem", flexWrap: "wrap" },
  filterBtn:   { padding: "0.4rem 0.9rem", border: "1.5px solid #e5e7eb", borderRadius: "20px", background: "#fff", cursor: "pointer", fontSize: "0.83rem", color: "#374151" },
  filterBtnActive: { background: "#0f4c81", color: "#fff", borderColor: "#0f4c81" },
  error:       { background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", padding: "0.75rem 1rem", color: "#dc2626", fontSize: "0.88rem" },
  loading:     { color: "#6b7280", padding: "2rem 0" },
  empty:       { textAlign: "center", color: "#6b7280", padding: "3rem 0", display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem" },
  grid:        { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "1rem" },
  formError:   { background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "6px", padding: "0.6rem 0.9rem", color: "#dc2626", fontSize: "0.83rem", marginBottom: "1rem" },
  btnCancel:   { padding: "0.5rem 1rem", background: "#f3f4f6", color: "#374151", border: "1px solid #d1d5db", borderRadius: "6px", cursor: "pointer" },
  btnDanger:   { padding: "0.5rem 1rem", background: "#dc2626", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: 600 },
};