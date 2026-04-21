/**
 * pages/receptionniste/PatientsPage.jsx
 * ========================================
 * Gestion des patients par la réceptionniste.
 *
 * Différences vs MesPatientsPage (dentiste) :
 *   - Création → dentiste_id requis dans le body (sélectionné dans le formulaire)
 *   - Pas de validation (canValider=false)
 *   - Pas de modification (canEdit=false — perform_update bloque réceptionniste)
 *   - Lecture seule + création uniquement
 *   - Charge la liste des dentistes actifs via GET /api/auth/users/dentistes/
 *
 * Compatibilité backend :
 *   perform_create → _is_receptioniste → statut PENDING, dentiste_id requis
 *   perform_update → lève ValidationError pour réceptionniste
 */

import React, { useCallback, useEffect, useState } from "react";
import { usePatients }      from "@/hooks/usePatients";
import { getDentistes }     from "@/api/usersAPI";
import { getDossierPatient } from "@/api/patientsAPI";
import PatientCard          from "@/components/patients/PatientCard";
import PatientForm          from "@/components/patients/PatientForm";
import PatientDossier       from "@/components/patients/PatientDossier";

// ── Styles (identiques à MesPatientsPage) ────────────────────────────────────

const S = {
  page:       { minHeight: "100vh", backgroundColor: "#f8fafc", fontFamily: "system-ui, sans-serif", padding: "2rem" },
  header:     { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" },
  title:      { fontSize: "1.4rem", fontWeight: "700", color: "#0f172a", margin: 0 },
  subtitle:   { fontSize: "0.85rem", color: "#64748b", marginTop: "0.2rem" },
  toolbar:    { display: "flex", gap: "0.65rem", flexWrap: "wrap", marginBottom: "1.25rem", alignItems: "center" },
  input:      { padding: "0.55rem 0.875rem", border: "1.5px solid #d1d5db", borderRadius: "8px", fontSize: "0.875rem", color: "#1e293b", backgroundColor: "#fff", outline: "none", minWidth: "220px" },
  select:     { padding: "0.55rem 0.875rem", border: "1.5px solid #d1d5db", borderRadius: "8px", fontSize: "0.875rem", backgroundColor: "#fff", color: "#1e293b", cursor: "pointer" },
  btnPrimary: { padding: "0.55rem 1.25rem", backgroundColor: "#7c3aed", color: "#fff", border: "none", borderRadius: "8px", fontSize: "0.875rem", fontWeight: "600", cursor: "pointer" },
  btnReset:   { padding: "0.55rem 0.875rem", backgroundColor: "#f1f5f9", color: "#475569", border: "1.5px solid #e2e8f0", borderRadius: "8px", fontSize: "0.875rem", cursor: "pointer" },
  grid:       { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "1rem" },
  empty:      { textAlign: "center", padding: "4rem 1rem", color: "#94a3b8", fontSize: "0.9rem" },
  spinner:    { display: "flex", justifyContent: "center", alignItems: "center", minHeight: "200px", gap: "0.5rem", color: "#94a3b8" },
  errorBox:   { backgroundColor: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", padding: "0.75rem 1rem", color: "#dc2626", fontSize: "0.875rem", marginBottom: "1rem" },
  infoBanner: { backgroundColor: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: "8px", padding: "0.75rem 1rem", color: "#1d4ed8", fontSize: "0.8125rem", marginBottom: "1.25rem" },
  overlay:    { position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 },
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PatientsPage() {
  const {
    patients, loading, error,
    fetchPatients, createPatient,
  } = usePatients();

  const [dentistes, setDentistes] = useState([]);
  const [search,    setSearch]    = useState("");
  const [statut,    setStatut]    = useState("");

  const [showCreate,     setShowCreate]     = useState(false);
  const [dossier,        setDossier]        = useState(null);
  const [dossierLoading, setDossierLoading] = useState(false);

  // ── Chargement initial ────────────────────────────────────────────

  const load = useCallback(() => {
    const params = {};
    if (search) params.search = search;
    if (statut) params.statut = statut;
    fetchPatients(params);
  }, [search, statut, fetchPatients]);

  useEffect(() => { load(); }, [load]);

  // Charger la liste des dentistes actifs (pour le formulaire)
  useEffect(() => {
    getDentistes()
      .then(({ data }) => setDentistes(Array.isArray(data) ? data : []))
      .catch(() => setDentistes([]));
  }, []);

  // ── Dossier ───────────────────────────────────────────────────────

  const openDossier = async (patient) => {
    setDossierLoading(true);
    try {
      const { data } = await getDossierPatient(patient.id);
      setDossier(data);
    } catch {
      alert("Impossible de charger le dossier.");
    } finally {
      setDossierLoading(false);
    }
  };

  // ── Création ──────────────────────────────────────────────────────

  const handleCreate = async (formData) => {
    // dentiste_id est dans formData — injecté par PatientForm (isRecep=true)
    await createPatient(formData);
    setShowCreate(false);
  };

  // ── Rendu ─────────────────────────────────────────────────────────

  return (
    <div style={S.page}>

      {/* En-tête */}
      <div style={S.header}>
        <div>
          <h1 style={S.title}>🧾 Patients</h1>
          <p style={S.subtitle}>
            {loading ? "Chargement…" : `${patients.length} patient(s)`}
          </p>
        </div>
        <button style={S.btnPrimary} onClick={() => setShowCreate(true)}>
          ➕ Ajouter un patient
        </button>
      </div>

      {/* Info réceptionniste */}
      <div style={S.infoBanner}>
        ℹ Les patients créés par vous sont en attente de validation par le dentiste.
        Vous ne pouvez pas modifier les dossiers — consultez uniquement.
      </div>

      {/* Filtres */}
      <div style={S.toolbar}>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher nom, prénom, téléphone…"
          style={S.input}
        />
        <select value={statut} onChange={(e) => setStatut(e.target.value)} style={S.select}>
          <option value="">Tous les statuts</option>
          <option value="ACCEPTE">Accepté</option>
          <option value="PENDING">En attente</option>
          <option value="REFUSE">Refusé</option>
        </select>
        <button
          style={S.btnReset}
          onClick={() => { setSearch(""); setStatut(""); }}
        >
          ↺ Réinitialiser
        </button>
      </div>

      {/* Erreur */}
      {error && (
        <div style={S.errorBox}>
          ⚠ {error}
          <button onClick={load} style={{ marginLeft: "1rem", background: "none",
            border: "none", color: "#dc2626", cursor: "pointer", fontWeight: "600" }}>
            Réessayer
          </button>
        </div>
      )}

      {/* Liste */}
      {loading ? (
        <div style={S.spinner}>
          <span style={{ width: "22px", height: "22px", border: "2.5px solid #e2e8f0",
            borderTop: "2.5px solid #7c3aed", borderRadius: "50%",
            animation: "spin 0.7s linear infinite", display: "inline-block" }} />
          Chargement…
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      ) : patients.length === 0 ? (
        <div style={S.empty}>
          <p style={{ fontSize: "2.5rem" }}>🧾</p>
          <p>Aucun patient trouvé.</p>
        </div>
      ) : (
        <div style={S.grid}>
          {patients.map((p) => (
            <PatientCard
              key={p.id}
              patient={p}
              canEdit={false}      // réceptionniste ne peut pas modifier
              canValider={false}   // réceptionniste ne valide pas
              onView={() => openDossier(p)}
            />
          ))}
        </div>
      )}

      {/* Modal création */}
      {showCreate && (
        <PatientForm
          mode="create"
          isRecep={true}
          dentistes={dentistes}
          onSubmit={handleCreate}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {/* Dossier (lecture seule) */}
      {dossier && (
        <PatientDossier
          dossier={dossier}
          canEdit={false}
          onClose={() => setDossier(null)}
        />
      )}

      {dossierLoading && (
        <div style={{ ...S.overlay, zIndex: 998 }}>
          <span style={{ width: "36px", height: "36px", border: "3px solid #fff",
            borderTop: "3px solid #7c3aed", borderRadius: "50%",
            animation: "spin 0.7s linear infinite", display: "inline-block" }} />
        </div>
      )}

    </div>
  );
}