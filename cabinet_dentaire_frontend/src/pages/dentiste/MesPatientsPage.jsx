/**
 * src/pages/dentiste/MesPatientsPage.jsx
 * ─────────────────────────────────────────
 * Liste paginée des patients du dentiste connecté.
 * - Recherche, filtres statut/sexe
 * - Badge alertes critiques
 * - Actions : voir, archiver, restaurer
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  getPatients, deletePatient, archiverPatient, restaurerPatient,
} from "../../api/patientsAPI";
import PatientForm from "../../components/patients/PatientForm";

const STATUT_COLORS = {
  ACCEPTE: { bg: "#ecfdf5", color: "#059669" },
  PENDING: { bg: "#fffbeb", color: "#d97706" },
  REFUSE:  { bg: "#fef2f2", color: "#dc2626" },
};

export default function MesPatientsPage() {
  const navigate = useNavigate();

  const [patients,    setPatients]    = useState([]);
  const [total,       setTotal]       = useState(0);
  const [loading,     setLoading]     = useState(true);
  const [showForm,    setShowForm]    = useState(false);
  const [editPatient, setEditPatient] = useState(null);

  // Filtres
  const [search,  setSearch]  = useState("");
  const [statut,  setStatut]  = useState("");
  const [page,    setPage]    = useState(1);
  const searchRef             = useRef();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, ordering: "-created_at" };
      if (search) params.search  = search;
      if (statut) params.statut  = statut;
      const data = await getPatients(params);
      setPatients(data.results || data);
      setTotal(data.count || (data.results || data).length);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [search, statut, page]);

  useEffect(() => { load(); }, [load]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setPage(1), 400);
    return () => clearTimeout(t);
  }, [search]);

  const handleArchiver = async (id, nom) => {
    if (!window.confirm(`Archiver le patient ${nom} ?`)) return;
    await archiverPatient(id);
    load();
  };

  const handleEdit = (patient) => {
    setEditPatient(patient);
    setShowForm(true);
  };

  const PAGE_SIZE = 20;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div style={styles.page}>

      {/* ── Barre d'outils ── */}
      <div style={styles.toolbar}>
        <input
          ref={searchRef}
          type="text"
          placeholder="Rechercher nom, téléphone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={styles.searchInput}
        />
        <select value={statut} onChange={(e) => setStatut(e.target.value)} style={styles.select}>
          <option value="">Tous les statuts</option>
          <option value="ACCEPTE">Acceptés</option>
          <option value="PENDING">En attente</option>
          <option value="REFUSE">Refusés</option>
        </select>
        <button onClick={() => { setEditPatient(null); setShowForm(true); }} style={styles.addBtn}>
          + Nouveau patient
        </button>
      </div>

      {/* ── Compteur ── */}
      <p style={styles.counter}>
        {total} patient{total > 1 ? "s" : ""}
        {search && ` · "${search}"`}
      </p>

      {/* ── Tableau ── */}
      {loading ? (
        <div style={styles.loading}>Chargement...</div>
      ) : patients.length === 0 ? (
        <div style={styles.empty}>Aucun patient trouvé.</div>
      ) : (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Nom complet</th>
                <th style={styles.th}>Âge</th>
                <th style={styles.th}>Téléphone</th>
                <th style={styles.th}>Statut</th>
                <th style={styles.th}>Alertes</th>
                <th style={styles.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {patients.map((p) => (
                <tr key={p.id} style={styles.tr}>
                  <td style={styles.td}>
                    <button
                      onClick={() => navigate(`/dentiste/patients/${p.id}`)}
                      style={styles.nameBtn}
                    >
                      {p.nom_complet}
                    </button>
                  </td>
                  <td style={styles.td}>{p.age} ans</td>
                  <td style={styles.td}>{p.telephone}</td>
                  <td style={styles.td}>
                    <span style={{
                      ...styles.statPill,
                      ...(STATUT_COLORS[p.statut] || {}),
                    }}>
                      {p.statut}
                    </span>
                  </td>
                  <td style={styles.td}>
                    {p.nb_alertes_critiques > 0 && (
                      <span style={styles.alertBadge}>
                        ⚠ {p.nb_alertes_critiques}
                      </span>
                    )}
                  </td>
                  <td style={styles.td}>
                    <div style={styles.actions}>
                      <button onClick={() => navigate(`/dentiste/patients/${p.id}`)} style={styles.btnSm}>
                        Voir
                      </button>
                      <button onClick={() => handleEdit(p)} style={styles.btnSm}>
                        Modifier
                      </button>
                      <button
                        onClick={() => handleArchiver(p.id, p.nom_complet)}
                        style={{ ...styles.btnSm, color: "#dc2626" }}
                      >
                        Archiver
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div style={styles.pagination}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={styles.pageBtn}>
            ←
          </button>
          <span style={styles.pageInfo}>Page {page} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={styles.pageBtn}>
            →
          </button>
        </div>
      )}

      {/* ── Modale formulaire ── */}
      {showForm && (
        <PatientForm
          patient={editPatient}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); }}
        />
      )}
    </div>
  );
}

const styles = {
  page:       { display: "flex", flexDirection: "column", gap: "1rem" },
  toolbar:    { display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" },
  searchInput:{
    flex: 1, minWidth: "200px",
    padding: "0.6rem 0.875rem",
    border: "1.5px solid #d1d5db", borderRadius: "8px",
    fontSize: "0.9rem", outline: "none",
  },
  select: {
    padding: "0.6rem 0.875rem",
    border: "1.5px solid #d1d5db", borderRadius: "8px",
    fontSize: "0.9rem", background: "#fff",
  },
  addBtn: {
    padding: "0.6rem 1.25rem",
    background: "#0f4c81", color: "#fff",
    border: "none", borderRadius: "8px",
    fontWeight: 600, cursor: "pointer", fontSize: "0.9rem",
    whiteSpace: "nowrap",
  },
  counter:    { fontSize: "0.85rem", color: "#6b7280", margin: 0 },
  loading:    { color: "#6b7280", padding: "1rem 0" },
  empty:      { color: "#6b7280", padding: "2rem 0", textAlign: "center" },
  tableWrap:  { overflowX: "auto" },
  table:      { width: "100%", borderCollapse: "collapse", background: "#fff", borderRadius: "12px", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" },
  th:         { padding: "0.75rem 1rem", textAlign: "left", fontSize: "0.8rem", fontWeight: 600, color: "#6b7280", background: "#f9fafb", borderBottom: "1px solid #e5e7eb" },
  tr:         { borderBottom: "1px solid #f3f4f6" },
  td:         { padding: "0.75rem 1rem", fontSize: "0.9rem", color: "#111827" },
  nameBtn:    { background: "none", border: "none", cursor: "pointer", fontWeight: 600, color: "#0f4c81", fontSize: "0.9rem", padding: 0 },
  statPill:   { padding: "3px 10px", borderRadius: "12px", fontSize: "0.75rem", fontWeight: 600 },
  alertBadge: { background: "#fef2f2", color: "#dc2626", padding: "2px 8px", borderRadius: "10px", fontSize: "0.75rem", fontWeight: 600 },
  actions:    { display: "flex", gap: "0.5rem" },
  btnSm:      { padding: "0.3rem 0.7rem", border: "1px solid #d1d5db", borderRadius: "6px", background: "#f9fafb", cursor: "pointer", fontSize: "0.8rem" },
  pagination: { display: "flex", alignItems: "center", justifyContent: "center", gap: "1rem", marginTop: "0.5rem" },
  pageBtn:    { padding: "0.4rem 0.9rem", border: "1px solid #d1d5db", borderRadius: "6px", background: "#fff", cursor: "pointer" },
  pageInfo:   { fontSize: "0.875rem", color: "#6b7280" },
};