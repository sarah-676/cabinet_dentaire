/**
 * src/pages/admin/GestionUtilisateurs.jsx
 * ✅ UI améliorée : cartes modernes, avatars, badges colorés, hover effects
 * ✅ Logique API inchangée
 */

import { useEffect, useState, useCallback } from "react";
import {
  getUsers, createUser, updateUser, deleteUser, toggleUserActif,
} from "../../api/authAPI";
import EntityForm from "../../components/ui/EntityForm";
import InlineError from "../../components/ui/InlineError";
import { useToast } from "../../context/ToastContext";
import { extractErrorMessage } from "../../utils/errorHandler";

// ── Couleurs par rôle ─────────────────────────────────────────────────────────
const ROLE_CONFIG = {
  dentiste: {
    badge:      { bg: "#dbeafe", color: "#1e40af" },
    avatar:     { bg: "linear-gradient(135deg, #2563eb, #1d4ed8)", color: "#fff" },
    border:     "#bfdbfe",
    label:      "Dentiste",
    icon:       "🦷",
  },
  receptionniste: {
    badge:      { bg: "#f3e8ff", color: "#6b21a8" },
    avatar:     { bg: "linear-gradient(135deg, #9333ea, #7c3aed)", color: "#fff" },
    border:     "#e9d5ff",
    label:      "Réceptionniste",
    icon:       "📋",
  },
  admin: {
    badge:      { bg: "#fef3c7", color: "#92400e" },
    avatar:     { bg: "linear-gradient(135deg, #f59e0b, #d97706)", color: "#fff" },
    border:     "#fde68a",
    label:      "Admin",
    icon:       "⚙️",
  },
};

const EMPTY_FORM = {
  email: "", first_name: "", last_name: "",
  phone: "", role: "dentiste",
  password: "", password_confirm: "",
};

// ── Initiales depuis un nom ───────────────────────────────────────────────────
function getInitials(user) {
  const first = (user.first_name || "").charAt(0).toUpperCase();
  const last  = (user.last_name  || "").charAt(0).toUpperCase();
  if (first && last) return `${first}${last}`;
  if (first) return first;
  return (user.email || "?").charAt(0).toUpperCase();
}

// ── Carte utilisateur ─────────────────────────────────────────────────────────
function UserCard({ user, onEdit, onToggle, onDelete }) {
  const [hovered, setHovered] = useState(false);
  const cfg = ROLE_CONFIG[user.role] || ROLE_CONFIG.admin;

  return (
    <div
      style={{
        ...cardStyles.card,
        borderColor:   hovered ? cfg.border : "#e5e7eb",
        boxShadow:     hovered
          ? "0 8px 30px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06)"
          : "0 1px 4px rgba(0,0,0,0.06)",
        transform:     hovered ? "translateY(-2px) scale(1.005)" : "none",
        opacity:       user.is_active ? 1 : 0.65,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* ── En-tête carte ── */}
      <div style={cardStyles.header}>
        {/* Avatar */}
        <div style={{ ...cardStyles.avatar, background: cfg.avatar.bg, color: cfg.avatar.color }}>
          {getInitials(user)}
        </div>

        {/* Nom + rôle */}
        <div style={cardStyles.identity}>
          <div style={cardStyles.name}>
            {user.full_name || `${user.first_name || ""} ${user.last_name || ""}`.trim() || "—"}
          </div>
          <span style={{ ...cardStyles.badge, ...cfg.badge }}>
            <span style={{ marginRight: "4px" }}>{cfg.icon}</span>
            {cfg.label}
          </span>
        </div>

        {/* Statut actif / inactif */}
        <div style={{
          ...cardStyles.statusDot,
          background: user.is_active ? "#10b981" : "#d1d5db",
        }} title={user.is_active ? "Actif" : "Inactif"} />
      </div>

      {/* ── Infos contact ── */}
      <div style={cardStyles.contacts}>
        <div style={cardStyles.contactRow}>
          <span style={cardStyles.contactIcon}>✉</span>
          <span style={cardStyles.contactText}>{user.email}</span>
        </div>
        {user.phone && (
          <div style={cardStyles.contactRow}>
            <span style={cardStyles.contactIcon}>📞</span>
            <span style={cardStyles.contactText}>{user.phone}</span>
          </div>
        )}
        {user.specialite && (
          <div style={cardStyles.contactRow}>
            <span style={cardStyles.contactIcon}>🏥</span>
            <span style={{ ...cardStyles.contactText, color: cfg.badge.color, fontWeight: 500 }}>
              {user.specialite}
            </span>
          </div>
        )}
      </div>

      {/* ── Actions ── */}
      <div style={cardStyles.actions}>
        <ActionButton
          label="Modifier"
          icon="✏️"
          onClick={() => onEdit(user)}
          color="#2563eb"
        />
        <ActionButton
          label={user.is_active ? "Désactiver" : "Activer"}
          icon={user.is_active ? "⏸" : "▶"}
          onClick={() => onToggle(user.id)}
          color={user.is_active ? "#d97706" : "#059669"}
        />
        {user.is_active && (
          <ActionButton
            label="Suppr."
            icon="🗑"
            onClick={() => onDelete(user.id, user.full_name || user.email)}
            color="#dc2626"
            danger
          />
        )}
      </div>
    </div>
  );
}

function ActionButton({ label, icon, onClick, color, danger }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display:        "flex",
        alignItems:     "center",
        gap:            "4px",
        padding:        "0.3rem 0.65rem",
        border:         `1px solid ${hov ? color : "#e5e7eb"}`,
        borderRadius:   "8px",
        background:     hov ? (danger ? "#fef2f2" : "#f0f9ff") : "#fff",
        color:          hov ? color : "#6b7280",
        cursor:         "pointer",
        fontSize:       "0.78rem",
        fontWeight:     500,
        transition:     "all 0.15s ease",
      }}
    >
      <span>{icon}</span>
      {label}
    </button>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function GestionUtilisateurs() {
  const [users,      setUsers]      = useState([]);
  const [total,      setTotal]      = useState(0);
  const [loading,    setLoading]    = useState(true);
  const [showForm,   setShowForm]   = useState(false);
  const [editUser,   setEditUser]   = useState(null);
  const [form,       setForm]       = useState(EMPTY_FORM);
  const [errors,     setErrors]     = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [search,     setSearch]     = useState("");
  const [role,       setRole]       = useState("");
  const [error,      setError]      = useState("");
  const { showSuccess, showError }  = useToast();

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const params = {};
      if (search) params.search = search;
      if (role)   params.role   = role;
      const data = await getUsers(params);
      setUsers(data.results || data);
      setTotal(data.count || (data.results || data).length);
    } catch (err) {
      const message = extractErrorMessage(err);
      setError(message); showError(message);
    } finally { setLoading(false); }
  }, [search, role, showError]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditUser(null); setForm(EMPTY_FORM); setErrors({}); setShowForm(true);
  };

  const openEdit = (u) => {
    setEditUser(u);
    setForm({ email: u.email, first_name: u.first_name || "", last_name: u.last_name || "", phone: u.phone || "", role: u.role, password: "" });
    setErrors({}); setShowForm(true);
  };

  const handleSubmit = async (values) => {
    setSubmitting(true); setErrors({});
    try {
      const payload = { ...values };
      if (editUser) {
        if (!payload.password) delete payload.password;
        delete payload.password_confirm;
        await updateUser(editUser.id, payload);
      } else {
        await createUser(payload);
      }
      showSuccess(editUser ? "Utilisateur modifié." : "Utilisateur créé.");
      setShowForm(false); load();
    } catch (err) {
      setErrors(err.response?.data || {});
      showError(extractErrorMessage(err));
    } finally { setSubmitting(false); }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Désactiver ${name} ?`)) return;
    try { await deleteUser(id); showSuccess("Utilisateur désactivé."); load(); }
    catch (err) { showError(extractErrorMessage(err)); }
  };

  const handleToggle = async (id) => {
    try { await toggleUserActif(id); showSuccess("Statut mis à jour."); load(); }
    catch (err) { showError(extractErrorMessage(err)); }
  };

  const getFields = () => {
    const base = [
      { name: "first_name", label: "Prénom", type: "text" },
      { name: "last_name",  label: "Nom",    type: "text" },
      { name: "email",      label: "Email *", type: "email", required: true },
      { name: "phone",      label: "Téléphone", type: "text" },
      { name: "role", label: "Rôle *", type: "select", options: [
        { value: "dentiste", label: "🦷 Dentiste" },
        { value: "receptionniste", label: "📋 Réceptionniste" },
        { value: "admin", label: "⚙️ Admin" },
      ]},
      { name: "password", label: editUser ? "Nouveau mot de passe (vide = inchangé)" : "Mot de passe *", type: "password", required: !editUser },
    ];
    if (!editUser) base.push({ name: "password_confirm", label: "Confirmer *", type: "password", required: true });
    return base;
  };

  // Grouper par rôle pour les compteurs
  const byRole = users.reduce((acc, u) => {
    acc[u.role] = (acc[u.role] || 0) + 1; return acc;
  }, {});

  return (
    <div style={pageStyles.page}>

      {/* ── En-tête ── */}
      <div style={pageStyles.header}>
        <div>
          <h1 style={pageStyles.title}>Gestion des utilisateurs</h1>
          <p style={pageStyles.subtitle}>
            {total} compte{total > 1 ? "s" : ""} au total
          </p>
        </div>
        <button onClick={openCreate} style={pageStyles.addBtn}>
          <span style={{ fontSize: "1.1rem" }}>+</span> Créer un compte
        </button>
      </div>

      {/* ── Compteurs par rôle ── */}
      <div style={pageStyles.statsRow}>
        {Object.entries(ROLE_CONFIG).map(([roleKey, cfg]) => (
          <div key={roleKey} style={{ ...pageStyles.statCard, borderColor: cfg.border }}>
            <span style={{ fontSize: "1.4rem" }}>{cfg.icon}</span>
            <div>
              <div style={{ ...pageStyles.statCount, color: cfg.badge.color }}>
                {byRole[roleKey] || 0}
              </div>
              <div style={pageStyles.statLabel}>{cfg.label}{(byRole[roleKey] || 0) > 1 ? "s" : ""}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Filtres ── */}
      <div style={pageStyles.filters}>
        <div style={pageStyles.searchWrap}>
          <span style={pageStyles.searchIcon}>🔍</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher email, nom…"
            style={pageStyles.searchInput}
          />
        </div>
        <div style={pageStyles.roleFilter}>
          {["", "dentiste", "receptionniste", "admin"].map((r) => {
            const cfg  = r ? ROLE_CONFIG[r] : null;
            const active = role === r;
            return (
              <button
                key={r || "all"}
                onClick={() => setRole(r)}
                style={{
                  ...pageStyles.filterBtn,
                  background:  active ? (cfg ? cfg.badge.bg : "#111827") : "#f9fafb",
                  color:       active ? (cfg ? cfg.badge.color : "#fff") : "#6b7280",
                  borderColor: active ? (cfg ? cfg.border : "#111827") : "#e5e7eb",
                  fontWeight:  active ? 600 : 400,
                }}
              >
                {r ? `${cfg.icon} ${cfg.label}s` : "👥 Tous"}
              </button>
            );
          })}
        </div>
      </div>

      <InlineError message={error} />

      {/* ── Grille de cartes ── */}
      {loading ? (
        <div style={pageStyles.empty}>
          <div style={pageStyles.spinner} />
          <span style={{ color: "#9ca3af", fontSize: "0.9rem" }}>Chargement…</span>
        </div>
      ) : users.length === 0 ? (
        <div style={pageStyles.empty}>
          <span style={{ fontSize: "2.5rem" }}>👤</span>
          <span style={{ color: "#9ca3af" }}>Aucun utilisateur trouvé.</span>
        </div>
      ) : (
        <div style={pageStyles.grid}>
          {users.map((u) => (
            <UserCard
              key={u.id}
              user={u}
              onEdit={openEdit}
              onToggle={handleToggle}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* ── Formulaire ── */}
      {showForm && (
        <EntityForm
          title={editUser ? "Modifier l'utilisateur" : "Créer un compte"}
          initialValues={form}
          errors={errors}
          submitting={submitting}
          submitLabel={editUser ? "Modifier" : "Créer"}
          onCancel={() => setShowForm(false)}
          onSubmit={handleSubmit}
          validate={(values) => {
            const errs = {};
            if (!values.email) errs.email = "Email requis.";
            if (!editUser) {
              if (!values.password) errs.password = "Mot de passe requis.";
              if (!values.password_confirm) errs.password_confirm = "Confirmation requise.";
              if (values.password && values.password_confirm && values.password !== values.password_confirm)
                errs.password_confirm = "Les mots de passe ne correspondent pas.";
            }
            return errs;
          }}
          fields={getFields()}
        />
      )}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const pageStyles = {
  page: {
    display: "flex", flexDirection: "column", gap: "1.5rem",
    fontFamily: "'Segoe UI', system-ui, sans-serif",
  },
  header: {
    display: "flex", justifyContent: "space-between", alignItems: "flex-start",
    flexWrap: "wrap", gap: "1rem",
  },
  title: {
    margin: 0, fontSize: "1.5rem", fontWeight: 700, color: "#111827",
    letterSpacing: "-0.02em",
  },
  subtitle: { margin: "0.25rem 0 0", fontSize: "0.875rem", color: "#6b7280" },
  addBtn: {
    display: "flex", alignItems: "center", gap: "0.4rem",
    padding: "0.6rem 1.25rem",
    background: "linear-gradient(135deg, #0f4c81, #1d6fa8)",
    color: "#fff", border: "none", borderRadius: "10px",
    fontWeight: 600, fontSize: "0.9rem", cursor: "pointer",
    boxShadow: "0 2px 8px rgba(15,76,129,0.35)",
    transition: "all 0.15s",
  },
  statsRow: {
    display: "flex", gap: "0.75rem", flexWrap: "wrap",
  },
  statCard: {
    display: "flex", alignItems: "center", gap: "0.75rem",
    padding: "0.75rem 1.25rem",
    background: "#fff", border: "1.5px solid #e5e7eb",
    borderRadius: "12px",
    boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
    minWidth: "110px",
  },
  statCount: { fontSize: "1.4rem", fontWeight: 700, lineHeight: 1 },
  statLabel: { fontSize: "0.75rem", color: "#9ca3af", marginTop: "2px" },
  filters: {
    display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center",
  },
  searchWrap: {
    display: "flex", alignItems: "center", gap: "0.5rem",
    background: "#fff", border: "1.5px solid #e5e7eb",
    borderRadius: "10px", padding: "0.5rem 0.875rem",
    flex: 1, minWidth: "200px",
  },
  searchIcon: { fontSize: "0.9rem", color: "#9ca3af" },
  searchInput: {
    border: "none", outline: "none", fontSize: "0.9rem",
    color: "#374151", background: "transparent", width: "100%",
  },
  roleFilter: { display: "flex", gap: "0.4rem", flexWrap: "wrap" },
  filterBtn: {
    padding: "0.45rem 0.875rem",
    border: "1.5px solid",
    borderRadius: "8px", cursor: "pointer",
    fontSize: "0.82rem", transition: "all 0.15s",
    whiteSpace: "nowrap",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
    gap: "1rem",
  },
  empty: {
    display: "flex", flexDirection: "column", alignItems: "center",
    gap: "0.75rem", padding: "3rem", color: "#9ca3af",
  },
  spinner: {
    width: "32px", height: "32px",
    border: "3px solid #e5e7eb",
    borderTop: "3px solid #0f4c81",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
};

const cardStyles = {
  card: {
    background: "#fff",
    border: "1.5px solid #e5e7eb",
    borderRadius: "16px",
    padding: "1.25rem",
    display: "flex", flexDirection: "column", gap: "1rem",
    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
    cursor: "default",
  },
  header: {
    display: "flex", alignItems: "center", gap: "0.875rem",
  },
  avatar: {
    width: "46px", height: "46px", borderRadius: "50%",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: "1rem", fontWeight: 700, flexShrink: 0,
    boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
    letterSpacing: "0.5px",
  },
  identity: { flex: 1, minWidth: 0 },
  name: {
    fontSize: "0.95rem", fontWeight: 700, color: "#111827",
    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
  },
  badge: {
    display: "inline-flex", alignItems: "center",
    padding: "2px 8px", borderRadius: "20px",
    fontSize: "0.72rem", fontWeight: 600, marginTop: "3px",
  },
  statusDot: {
    width: "10px", height: "10px", borderRadius: "50%",
    flexShrink: 0,
    boxShadow: "0 0 0 2px #fff, 0 0 0 3px currentColor",
  },
  contacts: { display: "flex", flexDirection: "column", gap: "0.35rem" },
  contactRow: { display: "flex", alignItems: "center", gap: "0.5rem" },
  contactIcon: { fontSize: "0.8rem", width: "16px", textAlign: "center", flexShrink: 0 },
  contactText: {
    fontSize: "0.8rem", color: "#6b7280",
    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
  },
  actions: {
    display: "flex", gap: "0.4rem", flexWrap: "wrap",
    paddingTop: "0.75rem",
    borderTop: "1px solid #f3f4f6",
  },
};