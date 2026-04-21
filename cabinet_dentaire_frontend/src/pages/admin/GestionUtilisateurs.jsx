/**
 * src/pages/admin/GestionUtilisateurs.jsx
 * ─────────────────────────────────────────
 * CRUD complet des utilisateurs pour l'admin.
 * - Liste avec filtres rôle / statut / recherche
 * - Créer, modifier, désactiver, toggle actif
 */

import { useEffect, useState, useCallback } from "react";
import {
  getUsers, createUser, updateUser, deleteUser, toggleUserActif,
} from "../../api/authAPI";

const ROLE_COLORS = {
  admin:          { bg: "#fef3c7", color: "#92400e" },
  dentiste:       { bg: "#dbeafe", color: "#1e40af" },
  receptionniste: { bg: "#f3e8ff", color: "#6b21a8" },
};

const EMPTY_FORM = { email: "", first_name: "", last_name: "", phone: "", role: "dentiste", password: "" };

export default function GestionUtilisateurs() {
  const [users,    setUsers]    = useState([]);
  const [total,    setTotal]    = useState(0);
  const [loading,  setLoading]  = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [form,     setForm]     = useState(EMPTY_FORM);
  const [errors,   setErrors]   = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [search,   setSearch]   = useState("");
  const [role,     setRole]     = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (role)   params.role   = role;
      const data = await getUsers(params);
      setUsers(data.results || data);
      setTotal(data.count || (data.results || data).length);
    } finally { setLoading(false); }
  }, [search, role]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditUser(null); setForm(EMPTY_FORM); setErrors({}); setShowForm(true); };
  const openEdit   = (u) => {
    setEditUser(u);
    setForm({ email: u.email, first_name: u.first_name || "", last_name: u.last_name || "", phone: u.phone || "", role: u.role, password: "" });
    setErrors({});
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true); setErrors({});
    try {
      const payload = { ...form };
      if (editUser && !payload.password) delete payload.password;
      if (editUser) await updateUser(editUser.id, payload);
      else          await createUser(payload);
      setShowForm(false);
      load();
    } catch (err) {
      setErrors(err.response?.data || {});
    } finally { setSubmitting(false); }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Désactiver ${name} ?`)) return;
    await deleteUser(id);
    load();
  };

  const handleToggle = async (id) => {
    await toggleUserActif(id);
    load();
  };

  return (
    <div style={styles.page}>

      <div style={styles.toolbar}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher email, nom…" style={styles.searchInput} />
        <select value={role} onChange={e => setRole(e.target.value)} style={styles.select}>
          <option value="">Tous les rôles</option>
          <option value="dentiste">Dentiste</option>
          <option value="receptionniste">Réceptionniste</option>
          <option value="admin">Admin</option>
        </select>
        <button onClick={openCreate} style={styles.addBtn}>+ Créer un compte</button>
      </div>

      <p style={{ fontSize: "0.85rem", color: "#6b7280", margin: 0 }}>{total} utilisateur{total > 1 ? "s" : ""}</p>

      {loading ? <p style={{ color: "#6b7280" }}>Chargement...</p> : (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Nom</th>
                <th style={styles.th}>Email</th>
                <th style={styles.th}>Rôle</th>
                <th style={styles.th}>Statut</th>
                <th style={styles.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => {
                const rc = ROLE_COLORS[u.role] || {};
                return (
                  <tr key={u.id} style={styles.tr}>
                    <td style={styles.td}><strong>{u.full_name || `${u.first_name} ${u.last_name}`}</strong></td>
                    <td style={styles.td}>{u.email}</td>
                    <td style={styles.td}>
                      <span style={{ ...styles.pill, ...rc }}>{u.role}</span>
                    </td>
                    <td style={styles.td}>
                      <span style={{ ...styles.pill, background: u.is_active ? "#ecfdf5" : "#f9fafb", color: u.is_active ? "#059669" : "#6b7280" }}>
                        {u.is_active ? "Actif" : "Inactif"}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                        <button onClick={() => openEdit(u)} style={styles.btnSm}>Modifier</button>
                        <button onClick={() => handleToggle(u.id)} style={styles.btnSm}>
                          {u.is_active ? "Désactiver" : "Activer"}
                        </button>
                        {u.is_active && (
                          <button onClick={() => handleDelete(u.id, u.full_name)} style={{ ...styles.btnSm, color: "#dc2626" }}>
                            Suppr.
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modale */}
      {showForm && (
        <div style={styles.overlay} onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700 }}>
                {editUser ? "Modifier l'utilisateur" : "Créer un compte"}
              </h2>
              <button onClick={() => setShowForm(false)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.1rem" }}>✕</button>
            </div>
            <form onSubmit={handleSubmit} style={styles.formBody}>
              {errors.non_field_errors && <div style={styles.errBanner}>{errors.non_field_errors[0]}</div>}

              <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                <FField label="Prénom" error={errors.first_name}>
                  <input value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} style={styles.fi} />
                </FField>
                <FField label="Nom" error={errors.last_name}>
                  <input value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} style={styles.fi} />
                </FField>
              </div>

              <FField label="Email *" error={errors.email}>
                <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required style={styles.fi} />
              </FField>

              <FField label="Téléphone" error={errors.phone}>
                <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} style={styles.fi} />
              </FField>

              <FField label="Rôle *" error={errors.role}>
                <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} style={styles.fi}>
                  <option value="dentiste">Dentiste</option>
                  <option value="receptionniste">Réceptionniste</option>
                  <option value="admin">Admin</option>
                </select>
              </FField>

              <FField label={editUser ? "Nouveau mot de passe (laisser vide = inchangé)" : "Mot de passe *"} error={errors.password}>
                <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required={!editUser} style={styles.fi} />
              </FField>

              <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", marginTop: "0.5rem" }}>
                <button type="button" onClick={() => setShowForm(false)} style={styles.cancelBtn}>Annuler</button>
                <button type="submit" disabled={submitting} style={styles.submitBtn}>
                  {submitting ? "..." : editUser ? "Modifier" : "Créer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function FField({ label, error, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem", flex: 1 }}>
      <label style={{ fontSize: "0.8rem", fontWeight: 500, color: "#374151" }}>{label}</label>
      {children}
      {error && <span style={{ fontSize: "0.75rem", color: "#dc2626" }}>{Array.isArray(error) ? error[0] : error}</span>}
    </div>
  );
}

const styles = {
  page:       { display: "flex", flexDirection: "column", gap: "1rem" },
  toolbar:    { display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" },
  searchInput:{ flex: 1, minWidth: "200px", padding: "0.6rem 0.875rem", border: "1.5px solid #d1d5db", borderRadius: "8px", fontSize: "0.9rem" },
  select:     { padding: "0.6rem 0.875rem", border: "1.5px solid #d1d5db", borderRadius: "8px", fontSize: "0.9rem", background: "#fff" },
  addBtn:     { padding: "0.6rem 1.25rem", background: "#0f4c81", color: "#fff", border: "none", borderRadius: "8px", fontWeight: 600, cursor: "pointer" },
  tableWrap:  { overflowX: "auto" },
  table:      { width: "100%", borderCollapse: "collapse", background: "#fff", borderRadius: "12px", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" },
  th:         { padding: "0.75rem 1rem", textAlign: "left", fontSize: "0.8rem", fontWeight: 600, color: "#6b7280", background: "#f9fafb", borderBottom: "1px solid #e5e7eb" },
  tr:         { borderBottom: "1px solid #f3f4f6" },
  td:         { padding: "0.75rem 1rem", fontSize: "0.875rem", color: "#111827" },
  pill:       { padding: "3px 10px", borderRadius: "12px", fontSize: "0.75rem", fontWeight: 600 },
  btnSm:      { padding: "0.3rem 0.7rem", border: "1px solid #d1d5db", borderRadius: "6px", background: "#f9fafb", cursor: "pointer", fontSize: "0.8rem" },
  overlay:    { position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 1000, overflowY: "auto", padding: "2rem 1rem" },
  modal:      { background: "#fff", borderRadius: "16px", width: "100%", maxWidth: "520px" },
  modalHeader:{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1.25rem 1.5rem", borderBottom: "1px solid #e5e7eb" },
  formBody:   { padding: "1.5rem", display: "flex", flexDirection: "column", gap: "0.875rem" },
  fi:         { padding: "0.6rem 0.75rem", border: "1.5px solid #d1d5db", borderRadius: "8px", fontSize: "0.9rem", width: "100%", boxSizing: "border-box" },
  errBanner:  { background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", padding: "0.6rem", color: "#dc2626", fontSize: "0.85rem" },
  cancelBtn:  { padding: "0.6rem 1.25rem", border: "1.5px solid #d1d5db", borderRadius: "8px", background: "#fff", cursor: "pointer" },
  submitBtn:  { padding: "0.6rem 1.5rem", background: "#0f4c81", color: "#fff", border: "none", borderRadius: "8px", fontWeight: 600, cursor: "pointer" },
};