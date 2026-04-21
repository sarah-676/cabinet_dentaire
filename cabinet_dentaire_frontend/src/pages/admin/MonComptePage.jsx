/**
 * pages/admin/MonComptePage.jsx
 * ===============================
 * Gestion du compte personnel — Admin.
 *
 * Onglets :
 *   1. Profil     → PATCH /api/auth/profile/ (UserUpdateSelfSerializer)
 *   2. Sécurité   → POST  /api/auth/profile/change-password/ (ChangePasswordSerializer)
 *
 * Champs modifiables (UserUpdateSelfSerializer) :
 *   first_name, last_name, phone, specialite, numero_ordre, avatar
 *
 * Champs change-password (ChangePasswordSerializer) :
 *   current_password, new_password, new_password_confirm
 */

import React, { useState } from "react";
import { updateProfile, changePassword } from "@/api/authAPI";
import { useAuth }                       from "@/hooks/useAuth";

// ── Styles ────────────────────────────────────────────────────────────────────

const S = {
  page:       { minHeight: "100vh", backgroundColor: "#f8fafc", fontFamily: "system-ui, sans-serif", padding: "2rem" },
  title:      { fontSize: "1.4rem", fontWeight: "700", color: "#0f172a", margin: "0 0 1.75rem" },
  tabs:       { display: "flex", gap: "0.5rem", marginBottom: "1.75rem", borderBottom: "1.5px solid #e2e8f0", paddingBottom: "0" },
  tab:        (active) => ({
    padding:         "0.6rem 1.25rem",
    fontWeight:      active ? "600" : "400",
    color:           active ? "#2563eb" : "#64748b",
    borderBottom:    active ? "2.5px solid #2563eb" : "2.5px solid transparent",
    cursor:          "pointer",
    background:      "none",
    border:          "none",
    fontSize:        "0.9rem",
    marginBottom:    "-1.5px",
    transition:      "color 0.15s",
  }),
  card:       { backgroundColor: "#fff", borderRadius: "12px", padding: "1.75rem", maxWidth: "540px", boxShadow: "0 1px 3px rgba(0,0,0,0.07)" },
  formGroup:  { marginBottom: "1.1rem" },
  label:      { display: "block", fontSize: "0.85rem", fontWeight: "500", color: "#374151", marginBottom: "0.35rem" },
  input:      { width: "100%", padding: "0.6rem 0.875rem", border: "1.5px solid #d1d5db", borderRadius: "8px", fontSize: "0.9rem", color: "#1e293b", boxSizing: "border-box", outline: "none" },
  inputErr:   { borderColor: "#ef4444" },
  fieldErr:   { fontSize: "0.78rem", color: "#dc2626", marginTop: "0.25rem" },
  row:        { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" },
  btnPrimary: { padding: "0.65rem 1.5rem", backgroundColor: "#2563eb", color: "#fff", border: "none", borderRadius: "8px", fontSize: "0.9rem", fontWeight: "600", cursor: "pointer" },
  successBox: { backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "8px", padding: "0.75rem 1rem", color: "#166534", fontSize: "0.875rem", marginBottom: "1rem" },
  errorBox:   { backgroundColor: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", padding: "0.75rem 1rem", color: "#dc2626", fontSize: "0.875rem", marginBottom: "1rem" },
  avatarRow:  { display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.5rem" },
  avatar:     { width: "64px", height: "64px", borderRadius: "50%", objectFit: "cover", backgroundColor: "#e0e7ff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.5rem", fontWeight: "700", color: "#3730a3" },
};

// ── Onglet Profil ─────────────────────────────────────────────────────────────

function TabProfil() {
  const { user, updateUser } = useAuth();

  const [form, setForm] = useState({
    first_name:   user?.first_name   ?? "",
    last_name:    user?.last_name    ?? "",
    phone:        user?.phone        ?? "",
    specialite:   user?.specialite   ?? "",
    numero_ordre: user?.numero_ordre ?? "",
  });
  const [errors,  setErrors]  = useState({});
  const [saving,  setSaving]  = useState(false);
  const [success, setSuccess] = useState(false);

  const set = (f, v) => {
    setForm((p) => ({ ...p, [f]: v }));
    setErrors((p) => ({ ...p, [f]: undefined }));
    setSuccess(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    setSuccess(false);
    try {
      const { data } = await updateProfile(form);
      updateUser(data);
      setSuccess(true);
    } catch (err) {
      const d = err?.response?.data ?? {};
      if (d.detail) {
        setErrors({ _global: d.detail });
      } else {
        const mapped = {};
        Object.entries(d).forEach(([k, v]) => {
          mapped[k] = Array.isArray(v) ? v[0] : v;
        });
        setErrors(mapped);
      }
    } finally {
      setSaving(false);
    }
  };

  const initials = `${user?.first_name?.[0] ?? ""}${user?.last_name?.[0] ?? ""}`.toUpperCase() || "A";

  return (
    <div style={S.card}>
      {/* Avatar */}
      <div style={S.avatarRow}>
        {user?.avatar ? (
          <img src={user.avatar} alt="avatar" style={S.avatar} />
        ) : (
          <div style={S.avatar}>{initials}</div>
        )}
        <div>
          <p style={{ margin: 0, fontWeight: "600", color: "#1e293b" }}>{user?.full_name}</p>
          <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748b" }}>{user?.email}</p>
          <p style={{ margin: 0, fontSize: "0.78rem", color: "#94a3b8", marginTop: "0.2rem" }}>
            Rôle : Administrateur
          </p>
        </div>
      </div>

      {success      && <div style={S.successBox}>✅ Profil mis à jour avec succès.</div>}
      {errors._global && <div style={S.errorBox}>⚠ {errors._global}</div>}

      <form onSubmit={handleSubmit}>
        <div style={S.row}>
          <div style={S.formGroup}>
            <label style={S.label}>Prénom</label>
            <input
              type="text"
              value={form.first_name}
              onChange={(e) => set("first_name", e.target.value)}
              style={{ ...S.input, ...(errors.first_name ? S.inputErr : {}) }}
            />
            {errors.first_name && <p style={S.fieldErr}>{errors.first_name}</p>}
          </div>
          <div style={S.formGroup}>
            <label style={S.label}>Nom</label>
            <input
              type="text"
              value={form.last_name}
              onChange={(e) => set("last_name", e.target.value)}
              style={{ ...S.input, ...(errors.last_name ? S.inputErr : {}) }}
            />
            {errors.last_name && <p style={S.fieldErr}>{errors.last_name}</p>}
          </div>
        </div>

        <div style={S.formGroup}>
          <label style={S.label}>Téléphone</label>
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => set("phone", e.target.value)}
            placeholder="0551234567"
            style={{ ...S.input, ...(errors.phone ? S.inputErr : {}) }}
          />
          {errors.phone && <p style={S.fieldErr}>{errors.phone}</p>}
        </div>

        <button type="submit" disabled={saving} style={{ ...S.btnPrimary, opacity: saving ? 0.6 : 1 }}>
          {saving ? "Enregistrement…" : "Enregistrer les modifications"}
        </button>
      </form>
    </div>
  );
}

// ── Onglet Sécurité ───────────────────────────────────────────────────────────

function TabSecurite() {
  const [form, setForm] = useState({
    current_password:     "",
    new_password:         "",
    new_password_confirm: "",
  });
  const [errors,  setErrors]  = useState({});
  const [saving,  setSaving]  = useState(false);
  const [success, setSuccess] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

  const set = (f, v) => {
    setForm((p) => ({ ...p, [f]: v }));
    setErrors((p) => ({ ...p, [f]: undefined }));
    setSuccess(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    setSuccess(false);

    if (form.new_password !== form.new_password_confirm) {
      setErrors({ new_password_confirm: "Les mots de passe ne correspondent pas." });
      setSaving(false);
      return;
    }

    try {
      await changePassword(form);
      setSuccess(true);
      setForm({ current_password: "", new_password: "", new_password_confirm: "" });
    } catch (err) {
      const d = err?.response?.data ?? {};
      if (d.detail) {
        setErrors({ _global: d.detail });
      } else {
        const mapped = {};
        Object.entries(d).forEach(([k, v]) => {
          mapped[k] = Array.isArray(v) ? v[0] : v;
        });
        setErrors(mapped);
      }
    } finally {
      setSaving(false);
    }
  };

  const fieldProps = (name) => ({
    type:     showPwd ? "text" : "password",
    value:    form[name],
    onChange: (e) => set(name, e.target.value),
    style:    { ...S.input, ...(errors[name] ? S.inputErr : {}) },
  });

  return (
    <div style={S.card}>
      <h2 style={{ fontSize: "1rem", fontWeight: "600", color: "#1e293b", margin: "0 0 1.25rem" }}>
        🔐 Changer le mot de passe
      </h2>

      {success        && <div style={S.successBox}>✅ Mot de passe modifié avec succès.</div>}
      {errors._global && <div style={S.errorBox}>⚠ {errors._global}</div>}

      <form onSubmit={handleSubmit}>
        <div style={S.formGroup}>
          <label style={S.label}>Mot de passe actuel</label>
          <input {...fieldProps("current_password")} autoComplete="current-password" />
          {errors.current_password && <p style={S.fieldErr}>{errors.current_password}</p>}
        </div>

        <div style={S.formGroup}>
          <label style={S.label}>Nouveau mot de passe</label>
          <input {...fieldProps("new_password")} autoComplete="new-password" />
          {errors.new_password && <p style={S.fieldErr}>{errors.new_password}</p>}
        </div>

        <div style={S.formGroup}>
          <label style={S.label}>Confirmer le nouveau mot de passe</label>
          <input {...fieldProps("new_password_confirm")} autoComplete="new-password" />
          {errors.new_password_confirm && <p style={S.fieldErr}>{errors.new_password_confirm}</p>}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.25rem" }}>
          <input type="checkbox" id="showpwd" checked={showPwd} onChange={(e) => setShowPwd(e.target.checked)} />
          <label htmlFor="showpwd" style={{ fontSize: "0.85rem", color: "#64748b", cursor: "pointer" }}>
            Afficher les mots de passe
          </label>
        </div>

        <button type="submit" disabled={saving} style={{ ...S.btnPrimary, opacity: saving ? 0.6 : 1 }}>
          {saving ? "Modification…" : "Changer le mot de passe"}
        </button>
      </form>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MonComptePage() {
  const [tab, setTab] = useState("profil");

  return (
    <div style={S.page}>
      <h1 style={S.title}>⚙️ Mon compte</h1>

      <div style={S.tabs}>
        <button style={S.tab(tab === "profil")}   onClick={() => setTab("profil")}>
          👤 Profil
        </button>
        <button style={S.tab(tab === "securite")} onClick={() => setTab("securite")}>
          🔐 Sécurité
        </button>
      </div>

      {tab === "profil"   && <TabProfil />}
      {tab === "securite" && <TabSecurite />}
    </div>
  );
}