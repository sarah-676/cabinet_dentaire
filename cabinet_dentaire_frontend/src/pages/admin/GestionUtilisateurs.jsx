/**
 * pages/admin/GestionUtilisateurs.jsx
 * ======================================
 * Gestion complète des utilisateurs par l'admin.
 *
 * Fonctionnalités :
 *   - Liste paginée avec filtres (rôle, statut, recherche)
 *   - Créer un utilisateur  → POST /api/auth/users/
 *   - Modifier              → PATCH /api/auth/users/{id}/
 *   - Activer/désactiver    → PATCH /api/auth/users/{id}/toggle-actif/
 *   - Désactiver (delete)   → DELETE /api/auth/users/{id}/
 *
 * Compatibilité backend :
 *   UserCreateSerializer     → email, first_name, last_name, phone, role,
 *                              specialite, numero_ordre, password, password_confirm
 *   UserUpdateAdminSerializer→ first_name, last_name, phone, role,
 *                              specialite, numero_ordre, is_active
 *   UserListSerializer       → id, email, full_name, role, is_active, specialite, avatar
 */

import React, {
  useCallback, useEffect, useReducer, useState,
} from "react";
import { useSearchParams } from "react-router-dom";
import {
  getUsers, createUser, updateUser,
  toggleUserActif, deleteUser,
} from "@/api/usersAPI";
import { ROLES, ROLE_LABELS } from "@/utils/roles";
import { useAuth }            from "@/hooks/useAuth";

// ── Constantes ────────────────────────────────────────────────────────────────

const ROLE_OPTIONS = [
  { value: "",                       label: "Tous les rôles" },
  { value: ROLES.DENTISTE,           label: ROLE_LABELS[ROLES.DENTISTE] },
  { value: ROLES.RECEPTIONNISTE,     label: ROLE_LABELS[ROLES.RECEPTIONNISTE] },
  { value: ROLES.ADMIN,              label: ROLE_LABELS[ROLES.ADMIN] },
];

const ROLE_COLORS = {
  [ROLES.ADMIN]:          { bg: "#eff6ff", text: "#1d4ed8", border: "#bfdbfe" },
  [ROLES.DENTISTE]:       { bg: "#f0fdf4", text: "#166534", border: "#bbf7d0" },
  [ROLES.RECEPTIONNISTE]: { bg: "#faf5ff", text: "#6b21a8", border: "#e9d5ff" },
};

// ── Reducer état liste ────────────────────────────────────────────────────────

const initialState = {
  users:   [],
  loading: false,
  error:   null,
};

function reducer(state, action) {
  switch (action.type) {
    case "FETCH_START":  return { ...state, loading: true,  error: null };
    case "FETCH_OK":     return { ...state, loading: false, users: action.payload };
    case "FETCH_ERROR":  return { ...state, loading: false, error: action.payload };
    case "TOGGLE_USER":  return {
      ...state,
      users: state.users.map((u) =>
        u.id === action.payload.id ? { ...u, is_active: action.payload.is_active } : u
      ),
    };
    case "DELETE_USER":  return {
      ...state,
      users: state.users.map((u) =>
        u.id === action.payload ? { ...u, is_active: false } : u
      ),
    };
    case "ADD_USER":     return { ...state, users: [action.payload, ...state.users] };
    case "UPDATE_USER":  return {
      ...state,
      users: state.users.map((u) =>
        u.id === action.payload.id ? { ...u, ...action.payload } : u
      ),
    };
    default: return state;
  }
}

// ── Styles ────────────────────────────────────────────────────────────────────

const S = {
  page:     { minHeight: "100vh", backgroundColor: "#f8fafc", fontFamily: "system-ui, sans-serif", padding: "2rem" },
  header:   { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" },
  title:    { fontSize: "1.4rem", fontWeight: "700", color: "#0f172a", margin: 0 },
  subtitle: { fontSize: "0.85rem", color: "#64748b", marginTop: "0.2rem" },
  toolbar:  { display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1.25rem", alignItems: "center" },
  input:    { padding: "0.55rem 0.875rem", border: "1.5px solid #d1d5db", borderRadius: "8px", fontSize: "0.9rem", outline: "none", color: "#1e293b", backgroundColor: "#fff", minWidth: "200px" },
  select:   { padding: "0.55rem 0.875rem", border: "1.5px solid #d1d5db", borderRadius: "8px", fontSize: "0.9rem", backgroundColor: "#fff", color: "#1e293b", cursor: "pointer" },
  btnPrimary: { padding: "0.55rem 1.25rem", backgroundColor: "#2563eb", color: "#fff", border: "none", borderRadius: "8px", fontSize: "0.875rem", fontWeight: "600", cursor: "pointer" },
  btnSecondary: { padding: "0.45rem 1rem", backgroundColor: "#f1f5f9", color: "#475569", border: "1.5px solid #e2e8f0", borderRadius: "6px", fontSize: "0.8rem", fontWeight: "500", cursor: "pointer" },
  btnDanger:    { padding: "0.45rem 1rem", backgroundColor: "#fef2f2", color: "#dc2626", border: "1.5px solid #fecaca", borderRadius: "6px", fontSize: "0.8rem", fontWeight: "500", cursor: "pointer" },
  btnSuccess:   { padding: "0.45rem 1rem", backgroundColor: "#f0fdf4", color: "#166534", border: "1.5px solid #bbf7d0", borderRadius: "6px", fontSize: "0.8rem", fontWeight: "500", cursor: "pointer" },
  table:    { width: "100%", borderCollapse: "collapse", backgroundColor: "#fff", borderRadius: "12px", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.07)" },
  th:       { padding: "0.9rem 1rem", textAlign: "left", fontSize: "0.78rem", fontWeight: "600", color: "#64748b", backgroundColor: "#f8fafc", borderBottom: "1.5px solid #e2e8f0", whiteSpace: "nowrap" },
  td:       { padding: "0.85rem 1rem", fontSize: "0.875rem", color: "#1e293b", borderBottom: "1px solid #f1f5f9", verticalAlign: "middle" },
  badge:    (role) => {
    const c = ROLE_COLORS[role] ?? { bg: "#f1f5f9", text: "#475569", border: "#e2e8f0" };
    return { display: "inline-block", padding: "0.2rem 0.65rem", borderRadius: "20px", fontSize: "0.75rem", fontWeight: "600", backgroundColor: c.bg, color: c.text, border: `1px solid ${c.border}` };
  },
  activeBadge: (active) => ({
    display: "inline-block", padding: "0.2rem 0.65rem", borderRadius: "20px", fontSize: "0.75rem", fontWeight: "600",
    backgroundColor: active ? "#f0fdf4" : "#fef2f2",
    color:           active ? "#166534" : "#dc2626",
    border:          active ? "1px solid #bbf7d0" : "1px solid #fecaca",
  }),
  actions:  { display: "flex", gap: "0.4rem", flexWrap: "wrap" },
  errorBox: { backgroundColor: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", padding: "0.75rem 1rem", color: "#dc2626", fontSize: "0.875rem", marginBottom: "1rem" },
  emptyRow: { textAlign: "center", padding: "3rem 1rem", color: "#94a3b8", fontSize: "0.9rem" },
  overlay:  { position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "1rem" },
  modal:    { backgroundColor: "#fff", borderRadius: "14px", padding: "2rem", width: "100%", maxWidth: "520px", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" },
  modalTitle:  { fontSize: "1.125rem", fontWeight: "700", color: "#0f172a", margin: "0 0 1.5rem" },
  formGroup:   { marginBottom: "1rem" },
  label:       { display: "block", fontSize: "0.85rem", fontWeight: "500", color: "#374151", marginBottom: "0.35rem" },
  formInput:   { width: "100%", padding: "0.6rem 0.875rem", border: "1.5px solid #d1d5db", borderRadius: "8px", fontSize: "0.9rem", color: "#1e293b", boxSizing: "border-box", outline: "none" },
  formInputErr:{ borderColor: "#ef4444" },
  fieldError:  { fontSize: "0.78rem", color: "#dc2626", marginTop: "0.25rem" },
  modalFooter: { display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1.5rem" },
  spinnerRow:  { display: "flex", justifyContent: "center", padding: "3rem", color: "#94a3b8", gap: "0.5rem", alignItems: "center" },
};

// ── Formulaire création/édition ───────────────────────────────────────────────

const EMPTY_FORM = {
  email: "", first_name: "", last_name: "", phone: "",
  role: ROLES.DENTISTE, specialite: "", numero_ordre: "",
  password: "", password_confirm: "", is_active: true,
};

function UserModal({ mode, initial, onClose, onSaved }) {
  const [form,     setForm]     = useState(initial ?? EMPTY_FORM);
  const [errors,   setErrors]   = useState({});
  const [saving,   setSaving]   = useState(false);
  const [showPwd,  setShowPwd]  = useState(false);
  const isEdit = mode === "edit";

  const set = (field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});

    try {
      let data;
      if (isEdit) {
        // PATCH — UserUpdateAdminSerializer
        const payload = {
          first_name: form.first_name,
          last_name:  form.last_name,
          phone:      form.phone,
          role:       form.role,
          specialite: form.specialite,
          numero_ordre: form.numero_ordre,
          is_active:  form.is_active,
        };
        const res = await updateUser(initial.id, payload);
        data = res.data;
      } else {
        // POST — UserCreateSerializer
        const res = await createUser(form);
        data = res.data;
      }
      onSaved(data, isEdit);
    } catch (err) {
      const d = err?.response?.data ?? {};
      if (typeof d === "object" && !d.detail) {
        // Erreurs de champs backend
        const mapped = {};
        Object.entries(d).forEach(([k, v]) => {
          mapped[k] = Array.isArray(v) ? v[0] : v;
        });
        setErrors(mapped);
      } else {
        setErrors({ _global: d?.detail ?? "Une erreur est survenue." });
      }
    } finally {
      setSaving(false);
    }
  };

  const isDentiste = form.role === ROLES.DENTISTE;

  return (
    <div style={S.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={S.modal}>
        <h2 style={S.modalTitle}>
          {isEdit ? "✏️ Modifier l'utilisateur" : "➕ Créer un utilisateur"}
        </h2>

        {errors._global && (
          <div style={S.errorBox}>⚠ {errors._global}</div>
        )}

        <form onSubmit={handleSubmit}>

          {/* Email — création uniquement */}
          {!isEdit && (
            <div style={S.formGroup}>
              <label style={S.label}>Email *</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                required
                style={{ ...S.formInput, ...(errors.email ? S.formInputErr : {}) }}
                placeholder="prenom.nom@cabinet.dz"
                autoComplete="off"
              />
              {errors.email && <p style={S.fieldError}>{errors.email}</p>}
            </div>
          )}

          {/* Prénom + Nom */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <div style={S.formGroup}>
              <label style={S.label}>Prénom *</label>
              <input
                type="text"
                value={form.first_name}
                onChange={(e) => set("first_name", e.target.value)}
                required
                style={{ ...S.formInput, ...(errors.first_name ? S.formInputErr : {}) }}
              />
              {errors.first_name && <p style={S.fieldError}>{errors.first_name}</p>}
            </div>
            <div style={S.formGroup}>
              <label style={S.label}>Nom *</label>
              <input
                type="text"
                value={form.last_name}
                onChange={(e) => set("last_name", e.target.value)}
                required
                style={{ ...S.formInput, ...(errors.last_name ? S.formInputErr : {}) }}
              />
              {errors.last_name && <p style={S.fieldError}>{errors.last_name}</p>}
            </div>
          </div>

          {/* Téléphone */}
          <div style={S.formGroup}>
            <label style={S.label}>Téléphone</label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              placeholder="0551234567"
              style={{ ...S.formInput, ...(errors.phone ? S.formInputErr : {}) }}
            />
            {errors.phone && <p style={S.fieldError}>{errors.phone}</p>}
          </div>

          {/* Rôle */}
          <div style={S.formGroup}>
            <label style={S.label}>Rôle *</label>
            <select
              value={form.role}
              onChange={(e) => set("role", e.target.value)}
              required
              style={{ ...S.formInput, cursor: "pointer" }}
            >
              {ROLE_OPTIONS.slice(1).map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            {errors.role && <p style={S.fieldError}>{errors.role}</p>}
          </div>

          {/* Spécialité + N° ordre — dentiste seulement */}
          {isDentiste && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <div style={S.formGroup}>
                <label style={S.label}>Spécialité</label>
                <input
                  type="text"
                  value={form.specialite}
                  onChange={(e) => set("specialite", e.target.value)}
                  placeholder="Orthodontie"
                  style={S.formInput}
                />
              </div>
              <div style={S.formGroup}>
                <label style={S.label}>N° d'ordre</label>
                <input
                  type="text"
                  value={form.numero_ordre}
                  onChange={(e) => set("numero_ordre", e.target.value)}
                  style={S.formInput}
                />
              </div>
            </div>
          )}

          {/* Mot de passe — création uniquement */}
          {!isEdit && (
            <>
              <div style={S.formGroup}>
                <label style={S.label}>Mot de passe *</label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showPwd ? "text" : "password"}
                    value={form.password}
                    onChange={(e) => set("password", e.target.value)}
                    required
                    minLength={8}
                    style={{ ...S.formInput, paddingRight: "2.5rem", ...(errors.password ? S.formInputErr : {}) }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((v) => !v)}
                    style={{ position: "absolute", right: "0.75rem", top: "50%", transform: "translateY(-50%)",
                      background: "none", border: "none", cursor: "pointer", fontSize: "1rem", color: "#9ca3af" }}
                  >
                    {showPwd ? "🙈" : "👁"}
                  </button>
                </div>
                {errors.password && <p style={S.fieldError}>{errors.password}</p>}
              </div>
              <div style={S.formGroup}>
                <label style={S.label}>Confirmer le mot de passe *</label>
                <input
                  type={showPwd ? "text" : "password"}
                  value={form.password_confirm}
                  onChange={(e) => set("password_confirm", e.target.value)}
                  required
                  style={{ ...S.formInput, ...(errors.password_confirm ? S.formInputErr : {}) }}
                />
                {errors.password_confirm && <p style={S.fieldError}>{errors.password_confirm}</p>}
              </div>
            </>
          )}

          {/* is_active — modification uniquement */}
          {isEdit && (
            <div style={{ ...S.formGroup, display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <input
                type="checkbox"
                id="is_active"
                checked={form.is_active}
                onChange={(e) => set("is_active", e.target.checked)}
                style={{ width: "16px", height: "16px", cursor: "pointer" }}
              />
              <label htmlFor="is_active" style={{ ...S.label, margin: 0, cursor: "pointer" }}>
                Compte actif
              </label>
            </div>
          )}

          {/* Footer */}
          <div style={S.modalFooter}>
            <button type="button" onClick={onClose} style={S.btnSecondary}>
              Annuler
            </button>
            <button type="submit" disabled={saving} style={{ ...S.btnPrimary, opacity: saving ? 0.6 : 1 }}>
              {saving ? "Enregistrement…" : isEdit ? "Enregistrer" : "Créer le compte"}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}

// ── Confirmation suppression ──────────────────────────────────────────────────

function ConfirmModal({ user, onConfirm, onCancel, loading }) {
  return (
    <div style={S.overlay} onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div style={{ ...S.modal, maxWidth: "400px" }}>
        <h2 style={{ ...S.modalTitle, color: "#dc2626" }}>🚫 Désactiver le compte</h2>
        <p style={{ color: "#475569", fontSize: "0.9rem", lineHeight: 1.6 }}>
          Voulez-vous désactiver le compte de{" "}
          <strong>{user?.full_name}</strong> ({user?.email}) ?
          <br />
          L'utilisateur ne pourra plus se connecter.
        </p>
        <div style={S.modalFooter}>
          <button onClick={onCancel}  style={S.btnSecondary}>Annuler</button>
          <button
            onClick={onConfirm}
            disabled={loading}
            style={{ ...S.btnDanger, border: "none", backgroundColor: "#dc2626", color: "#fff", padding: "0.55rem 1.25rem", opacity: loading ? 0.6 : 1 }}
          >
            {loading ? "Désactivation…" : "Désactiver"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────

export default function GestionUtilisateurs() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user: currentUser }           = useAuth();

  const [state,    dispatch]  = useReducer(reducer, initialState);
  const [search,   setSearch] = useState(searchParams.get("search") ?? "");
  const [roleFilter, setRole] = useState(searchParams.get("role")   ?? "");

  // Modals
  const [showCreate,  setShowCreate]  = useState(false);
  const [editTarget,  setEditTarget]  = useState(null);  // user à éditer
  const [deleteTarget, setDeleteTarget] = useState(null); // user à supprimer
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [toggleLoading, setToggleLoading] = useState(null); // id en cours

  // ── Chargement liste ───────────────────────────────────────────────

  const fetchUsers = useCallback(async () => {
    dispatch({ type: "FETCH_START" });
    try {
      const params = {};
      if (search)     params.search    = search;
      if (roleFilter) params.role      = roleFilter;
      const { data } = await getUsers(params);
      // DRF peut retourner { results: [...] } si pagination activée
      dispatch({ type: "FETCH_OK", payload: Array.isArray(data) ? data : (data.results ?? []) });
    } catch (err) {
      dispatch({
        type:    "FETCH_ERROR",
        payload: err?.response?.data?.detail ?? "Impossible de charger les utilisateurs.",
      });
    }
  }, [search, roleFilter]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // Sync URL avec filtres
  useEffect(() => {
    const p = {};
    if (search)     p.search = search;
    if (roleFilter) p.role   = roleFilter;
    setSearchParams(p, { replace: true });
  }, [search, roleFilter, setSearchParams]);

  // ── Toggle actif ───────────────────────────────────────────────────

  const handleToggle = async (u) => {
    setToggleLoading(u.id);
    try {
      const { data } = await toggleUserActif(u.id);
      dispatch({ type: "TOGGLE_USER", payload: { id: u.id, is_active: data.is_active } });
    } catch (err) {
      alert(err?.response?.data?.detail ?? "Erreur lors du changement de statut.");
    } finally {
      setToggleLoading(null);
    }
  };

  // ── Désactivation ──────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await deleteUser(deleteTarget.id);
      dispatch({ type: "DELETE_USER", payload: deleteTarget.id });
      setDeleteTarget(null);
    } catch (err) {
      alert(err?.response?.data?.detail ?? "Erreur lors de la désactivation.");
    } finally {
      setDeleteLoading(false);
    }
  };

  // ── Callback modal sauvegarde ──────────────────────────────────────

  const handleSaved = (savedUser, isEdit) => {
    if (isEdit) {
      dispatch({ type: "UPDATE_USER", payload: savedUser });
      setEditTarget(null);
    } else {
      dispatch({ type: "ADD_USER", payload: savedUser });
      setShowCreate(false);
    }
  };

  // ── Rendu ──────────────────────────────────────────────────────────

  const { users, loading, error } = state;

  return (
    <div style={S.page}>

      {/* En-tête */}
      <div style={S.header}>
        <div>
          <h1 style={S.title}>👥 Gestion des utilisateurs</h1>
          <p style={S.subtitle}>
            {loading ? "Chargement…" : `${users.length} compte(s) trouvé(s)`}
          </p>
        </div>
        <button style={S.btnPrimary} onClick={() => setShowCreate(true)}>
          ➕ Créer un compte
        </button>
      </div>

      {/* Barre de filtres */}
      <div style={S.toolbar}>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher nom, email, téléphone…"
          style={S.input}
        />
        <select
          value={roleFilter}
          onChange={(e) => setRole(e.target.value)}
          style={S.select}
        >
          {ROLE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <button
          style={S.btnSecondary}
          onClick={() => { setSearch(""); setRole(""); }}
        >
          ↺ Réinitialiser
        </button>
      </div>

      {/* Erreur */}
      {error && (
        <div style={S.errorBox}>
          ⚠ {error}
          <button onClick={fetchUsers} style={{ marginLeft: "1rem", background: "none",
            border: "none", color: "#dc2626", cursor: "pointer", fontWeight: "600" }}>
            Réessayer
          </button>
        </div>
      )}

      {/* Tableau */}
      {loading ? (
        <div style={S.spinnerRow}>
          <span style={{ width: "20px", height: "20px", border: "2.5px solid #e2e8f0",
            borderTop: "2.5px solid #2563eb", borderRadius: "50%",
            animation: "spin 0.7s linear infinite", display: "inline-block" }} />
          Chargement des utilisateurs…
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>Nom complet</th>
                <th style={S.th}>Email</th>
                <th style={S.th}>Rôle</th>
                <th style={S.th}>Spécialité</th>
                <th style={S.th}>Statut</th>
                <th style={S.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={6} style={S.emptyRow}>
                    Aucun utilisateur trouvé.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id}>
                    <td style={S.td}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                        {u.avatar ? (
                          <img src={u.avatar} alt="" style={{ width: "32px", height: "32px",
                            borderRadius: "50%", objectFit: "cover" }} />
                        ) : (
                          <div style={{ width: "32px", height: "32px", borderRadius: "50%",
                            backgroundColor: "#e0e7ff", display: "flex", alignItems: "center",
                            justifyContent: "center", fontSize: "0.875rem", fontWeight: "700",
                            color: "#3730a3" }}>
                            {(u.full_name?.[0] ?? "?").toUpperCase()}
                          </div>
                        )}
                        <span style={{ fontWeight: "500" }}>{u.full_name}</span>
                        {u.id === currentUser?.id && (
                          <span style={{ fontSize: "0.7rem", color: "#2563eb", fontWeight: "600" }}>
                            (vous)
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ ...S.td, color: "#475569" }}>{u.email}</td>
                    <td style={S.td}>
                      <span style={S.badge(u.role)}>
                        {ROLE_LABELS[u.role] ?? u.role}
                      </span>
                    </td>
                    <td style={{ ...S.td, color: "#64748b" }}>
                      {u.specialite || "—"}
                    </td>
                    <td style={S.td}>
                      <span style={S.activeBadge(u.is_active)}>
                        {u.is_active ? "Actif" : "Inactif"}
                      </span>
                    </td>
                    <td style={S.td}>
                      <div style={S.actions}>
                        {/* Modifier */}
                        <button
                          style={S.btnSecondary}
                          onClick={() => setEditTarget(u)}
                        >
                          ✏️ Modifier
                        </button>

                        {/* Toggle actif — pas sur son propre compte */}
                        {u.id !== currentUser?.id && (
                          <button
                            style={u.is_active ? S.btnDanger : S.btnSuccess}
                            disabled={toggleLoading === u.id}
                            onClick={() => handleToggle(u)}
                          >
                            {toggleLoading === u.id
                              ? "…"
                              : u.is_active ? "🚫 Désactiver" : "✅ Activer"}
                          </button>
                        )}

                        {/* Supprimer (soft) — pas sur son propre compte */}
                        {u.id !== currentUser?.id && u.is_active && (
                          <button
                            style={S.btnDanger}
                            onClick={() => setDeleteTarget(u)}
                          >
                            🗑 Supprimer
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal création */}
      {showCreate && (
        <UserModal
          mode="create"
          onClose={() => setShowCreate(false)}
          onSaved={handleSaved}
        />
      )}

      {/* Modal édition */}
      {editTarget && (
        <UserModal
          mode="edit"
          initial={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={handleSaved}
        />
      )}

      {/* Modal confirmation suppression */}
      {deleteTarget && (
        <ConfirmModal
          user={deleteTarget}
          loading={deleteLoading}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

    </div>
  );
}