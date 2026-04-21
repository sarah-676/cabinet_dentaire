/**
 * pages/dentiste/MesPatientsPage.jsx
 * =====================================
 * Liste des patients du dentiste connecté.
 *
 * Fonctionnalités :
 *   - Liste filtrée (search, statut, groupe_sanguin, sexe)
 *   - Créer un patient → POST /api/patients/ (dentiste_id auto via token)
 *   - Modifier         → PATCH /api/patients/{id}/
 *   - Archiver         → DELETE /api/patients/{id}/
 *   - Valider PENDING  → PATCH /api/patients/{id}/valider/
 *   - Voir dossier     → GET /api/patients/{id}/dossier/
 */

import React, {
  useCallback, useEffect, useState,
} from "react";
import { useNavigate }    from "react-router-dom";
import { usePatients }    from "@/hooks/usePatients";
import PatientCard        from "@/components/patients/PatientCard";
import PatientForm        from "@/components/patients/PatientForm";
import PatientDossier     from "@/components/patients/PatientDossier";
import { getDossierPatient } from "@/api/patientsAPI";

// ── Styles ────────────────────────────────────────────────────────────────────

const S = {
  page:     { minHeight: "100vh", backgroundColor: "#f8fafc", fontFamily: "system-ui, sans-serif", padding: "2rem" },
  header:   { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" },
  title:    { fontSize: "1.4rem", fontWeight: "700", color: "#0f172a", margin: 0 },
  subtitle: { fontSize: "0.85rem", color: "#64748b", marginTop: "0.2rem" },
  toolbar:  { display: "flex", gap: "0.65rem", flexWrap: "wrap", marginBottom: "1.25rem", alignItems: "center" },
  input:    { padding: "0.55rem 0.875rem", border: "1.5px solid #d1d5db", borderRadius: "8px", fontSize: "0.875rem", color: "#1e293b", backgroundColor: "#fff", outline: "none", minWidth: "220px" },
  select:   { padding: "0.55rem 0.875rem", border: "1.5px solid #d1d5db", borderRadius: "8px", fontSize: "0.875rem", backgroundColor: "#fff", color: "#1e293b", cursor: "pointer" },
  btnPrimary: { padding: "0.55rem 1.25rem", backgroundColor: "#2563eb", color: "#fff", border: "none", borderRadius: "8px", fontSize: "0.875rem", fontWeight: "600", cursor: "pointer" },
  btnReset: { padding: "0.55rem 0.875rem", backgroundColor: "#f1f5f9", color: "#475569", border: "1.5px solid #e2e8f0", borderRadius: "8px", fontSize: "0.875rem", cursor: "pointer" },
  grid:     { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "1rem" },
  empty:    { textAlign: "center", padding: "4rem 1rem", color: "#94a3b8", fontSize: "0.9rem" },
  spinner:  { display: "flex", justifyContent: "center", alignItems: "center", minHeight: "200px", gap: "0.5rem", color: "#94a3b8" },
  errorBox: { backgroundColor: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", padding: "0.75rem 1rem", color: "#dc2626", fontSize: "0.875rem", marginBottom: "1rem" },
  // Modal valider
  overlay:  { position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "1rem" },
  modal:    { backgroundColor: "#fff", borderRadius: "12px", padding: "2rem", width: "100%", maxWidth: "420px", boxShadow: "0 20px 60px rgba(0,0,0,0.18)", fontFamily: "system-ui, sans-serif" },
  modalTitle: { fontSize: "1.1rem", fontWeight: "700", color: "#0f172a", margin: "0 0 1.25rem" },
  btnRow:   { display: "flex", gap: "0.75rem", marginTop: "1.25rem", justifyContent: "flex-end" },
};

// ── Modal valider patient ─────────────────────────────────────────────────────

function ValiderModal({ patient, onClose, onValider }) {
  const [raison,   setRaison]   = useState("");
  const [decision, setDecision] = useState(null);
  const [saving,   setSaving]   = useState(false);
  const [err,      setErr]      = useState(null);

  const submit = async (dec) => {
    if (dec === "REFUSE" && !raison.trim()) {
      setErr("La raison est obligatoire pour un refus.");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      await onValider(patient.id, dec, raison);
      onClose();
    } catch (e) {
      setErr(e?.response?.data?.detail ?? "Erreur lors de la validation.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={S.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={S.modal}>
        <h2 style={S.modalTitle}>✅ Valider le patient</h2>
        <p style={{ color: "#475569", fontSize: "0.9rem" }}>
          <strong>{patient.nom_complet}</strong> est en attente de validation.
        </p>
        {err && (
          <div style={{ backgroundColor: "#fef2f2", border: "1px solid #fecaca", borderRadius: "6px",
            padding: "0.6rem 0.875rem", color: "#dc2626", fontSize: "0.8rem", marginTop: "0.75rem" }}>
            {err}
          </div>
        )}
        <div style={{ marginTop: "1rem" }}>
          <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "500", color: "#374151", marginBottom: "0.35rem" }}>
            Raison du refus (obligatoire si refus)
          </label>
          <textarea
            value={raison}
            onChange={(e) => setRaison(e.target.value)}
            rows={3}
            style={{ width: "100%", padding: "0.575rem 0.825rem", border: "1.5px solid #d1d5db",
              borderRadius: "8px", fontSize: "0.875rem", resize: "vertical", boxSizing: "border-box", fontFamily: "inherit" }}
            placeholder="Motif du refus..."
          />
        </div>
        <div style={S.btnRow}>
          <button onClick={onClose} disabled={saving}
            style={{ padding: "0.55rem 1rem", backgroundColor: "#f1f5f9", color: "#475569",
              border: "1.5px solid #e2e8f0", borderRadius: "8px", cursor: "pointer", fontSize: "0.875rem" }}>
            Annuler
          </button>
          <button onClick={() => submit("REFUSE")} disabled={saving}
            style={{ padding: "0.55rem 1rem", backgroundColor: "#fef2f2", color: "#dc2626",
              border: "1.5px solid #fecaca", borderRadius: "8px", cursor: "pointer", fontWeight: "600", fontSize: "0.875rem" }}>
            ❌ Refuser
          </button>
          <button onClick={() => submit("ACCEPTE")} disabled={saving}
            style={{ padding: "0.55rem 1rem", backgroundColor: "#2563eb", color: "#fff",
              border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "600", fontSize: "0.875rem" }}>
            {saving ? "…" : "✅ Accepter"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────

export default function MesPatientsPage() {
  const navigate = useNavigate();
  const {
    patients, loading, error,
    fetchPatients, createPatient, updatePatient,
    deletePatient, validerPatient,
  } = usePatients();

  // Filtres
  const [search,   setSearch]   = useState("");
  const [statut,   setStatut]   = useState("");
  const [sexe,     setSexe]     = useState("");

  // Modals
  const [showCreate,    setShowCreate]    = useState(false);
  const [editTarget,    setEditTarget]    = useState(null);
  const [validerTarget, setValiderTarget] = useState(null);
  const [dossier,       setDossier]       = useState(null);
  const [dossierLoading, setDossierLoading] = useState(false);

  // ── Chargement ────────────────────────────────────────────────────

  const load = useCallback(() => {
    const params = {};
    if (search) params.search = search;
    if (statut) params.statut = statut;
    if (sexe)   params.sexe   = sexe;
    fetchPatients(params);
  }, [search, statut, sexe, fetchPatients]);

  useEffect(() => { load(); }, [load]);

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

  // ── Handlers ──────────────────────────────────────────────────────

  const handleCreate = async (data) => {
    await createPatient(data);
    setShowCreate(false);
  };

  const handleUpdate = async (data) => {
    await updatePatient(editTarget.id, data);
    setEditTarget(null);
    if (dossier) {
      const { data: fresh } = await getDossierPatient(editTarget.id);
      setDossier(fresh);
    }
  };

  const handleDelete = async (patient) => {
    if (!window.confirm(`Archiver le patient ${patient.nom_complet} ?`)) return;
    await deletePatient(patient.id);
  };

  // ── Rendu ─────────────────────────────────────────────────────────

  return (
    <div style={S.page}>

      {/* En-tête */}
      <div style={S.header}>
        <div>
          <h1 style={S.title}>🦷 Mes patients</h1>
          <p style={S.subtitle}>
            {loading ? "Chargement…" : `${patients.length} patient(s)`}
          </p>
        </div>
        <button style={S.btnPrimary} onClick={() => setShowCreate(true)}>
          ➕ Nouveau patient
        </button>
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
        <select value={sexe} onChange={(e) => setSexe(e.target.value)} style={S.select}>
          <option value="">Tous</option>
          <option value="M">Masculin</option>
          <option value="F">Féminin</option>
        </select>
        <button
          style={S.btnReset}
          onClick={() => { setSearch(""); setStatut(""); setSexe(""); }}
        >
          ↺ Réinitialiser
        </button>
      </div>

      {/* Erreur */}
      {error && (
        <div style={S.errorBox}>⚠ {error}
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
            borderTop: "2.5px solid #2563eb", borderRadius: "50%",
            animation: "spin 0.7s linear infinite", display: "inline-block" }} />
          Chargement des patients…
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      ) : patients.length === 0 ? (
        <div style={S.empty}>
          <p style={{ fontSize: "2.5rem" }}>🦷</p>
          <p>Aucun patient trouvé.</p>
          {!search && !statut && (
            <button style={{ ...S.btnPrimary, marginTop: "1rem" }} onClick={() => setShowCreate(true)}>
              Créer votre premier patient
            </button>
          )}
        </div>
      ) : (
        <div style={S.grid}>
          {patients.map((p) => (
            <PatientCard
              key={p.id}
              patient={p}
              canEdit
              canValider
              onView={() => openDossier(p)}
              onEdit={() => setEditTarget(p)}
              onDelete={() => handleDelete(p)}
              onValider={() => setValiderTarget(p)}
            />
          ))}
        </div>
      )}

      {/* Modal création */}
      {showCreate && (
        <PatientForm
          mode="create"
          isRecep={false}
          onSubmit={handleCreate}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {/* Modal édition */}
      {editTarget && (
        <PatientForm
          mode="edit"
          initial={editTarget}
          isRecep={false}
          onSubmit={handleUpdate}
          onCancel={() => setEditTarget(null)}
        />
      )}

      {/* Modal validation */}
      {validerTarget && (
        <ValiderModal
          patient={validerTarget}
          onClose={() => setValiderTarget(null)}
          onValider={validerPatient}
        />
      )}

      {/* Dossier complet */}
      {dossier && (
        <PatientDossier
          dossier={dossier}
          canEdit
          onEdit={() => { setEditTarget(dossier.patient); setDossier(null); }}
          onClose={() => setDossier(null)}
        />
      )}

      {dossierLoading && (
        <div style={{ ...S.overlay, zIndex: 999 }}>
          <span style={{ width: "36px", height: "36px", border: "3px solid #fff",
            borderTop: "3px solid #2563eb", borderRadius: "50%",
            animation: "spin 0.7s linear infinite", display: "inline-block" }} />
        </div>
      )}

    </div>
  );
}