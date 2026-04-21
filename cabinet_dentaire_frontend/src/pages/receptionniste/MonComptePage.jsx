/**
 * src/pages/dentiste/MonComptePage.jsx
 * src/pages/receptionniste/MonComptePage.jsx
 * src/pages/admin/MonComptePage.jsx
 * ─────────────────────────────────────────────
 * Partagé entre tous les rôles.
 */
import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { updateProfile, changePassword } from "../../api/authAPI";


export default function MonComptePage() {
  const { user } = useAuth();
  const [form,    setForm]    = useState({ first_name: user?.first_name || "", last_name: user?.last_name || "", phone: user?.phone || "" });
  const [pwdForm, setPwdForm] = useState({ old_password: "", new_password: "", confirm: "" });
  const [msg,     setMsg]     = useState("");
  const [err,     setErr]     = useState("");
  const [saving,  setSaving]  = useState(false);

  const handleProfile = async (e) => {
    e.preventDefault();
    setSaving(true); setMsg(""); setErr("");
    try {
      await updateProfile(form);
      setMsg("Profil mis à jour avec succès.");
    } catch (e) {
      setErr(e.response?.data?.detail || "Erreur.");
    } finally { setSaving(false); }
  };

  const handlePwd = async (e) => {
    e.preventDefault();
    if (pwdForm.new_password !== pwdForm.confirm) { setErr("Les mots de passe ne correspondent pas."); return; }
    setSaving(true); setMsg(""); setErr("");
    try {
      await changePassword({ old_password: pwdForm.old_password, new_password: pwdForm.new_password });
      setMsg("Mot de passe modifié."); setPwdForm({ old_password: "", new_password: "", confirm: "" });
    } catch (e) {
      setErr(e.response?.data?.detail || "Erreur.");
    } finally { setSaving(false); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", maxWidth: "560px" }}>
      {msg && <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: "8px", padding: "0.75rem", color: "#059669" }}>{msg}</div>}
      {err && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", padding: "0.75rem", color: "#dc2626" }}>{err}</div>}

      {/* Profil */}
      <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #e5e7eb", padding: "1.5rem" }}>
        <h3 style={{ margin: "0 0 1rem", fontSize: "1rem", fontWeight: 600 }}>Mon profil</h3>
        <div style={{ marginBottom: "0.75rem", fontSize: "0.875rem", color: "#6b7280" }}>
          <strong>Email :</strong> {user?.email} &nbsp;·&nbsp; <strong>Rôle :</strong> {user?.role}
        </div>
        <form onSubmit={handleProfile} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <input placeholder="Prénom" value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} style={inputStyle} />
            <input placeholder="Nom" value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} style={inputStyle} />
          </div>
          <input placeholder="Téléphone" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} style={inputStyle} />
          <button type="submit" disabled={saving} style={submitStyle}>{saving ? "Enregistrement..." : "Mettre à jour"}</button>
        </form>
      </div>

      {/* Mot de passe */}
      <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #e5e7eb", padding: "1.5rem" }}>
        <h3 style={{ margin: "0 0 1rem", fontSize: "1rem", fontWeight: 600 }}>Changer le mot de passe</h3>
        <form onSubmit={handlePwd} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <input type="password" placeholder="Ancien mot de passe" value={pwdForm.old_password} onChange={e => setPwdForm(f => ({ ...f, old_password: e.target.value }))} required style={inputStyle} />
          <input type="password" placeholder="Nouveau mot de passe" value={pwdForm.new_password} onChange={e => setPwdForm(f => ({ ...f, new_password: e.target.value }))} required style={inputStyle} />
          <input type="password" placeholder="Confirmer" value={pwdForm.confirm} onChange={e => setPwdForm(f => ({ ...f, confirm: e.target.value }))} required style={inputStyle} />
          <button type="submit" disabled={saving} style={submitStyle}>{saving ? "..." : "Modifier le mot de passe"}</button>
        </form>
      </div>
    </div>
  );
}

const inputStyle = { padding: "0.6rem 0.75rem", border: "1.5px solid #d1d5db", borderRadius: "8px", fontSize: "0.9rem", flex: 1 };
const submitStyle = { padding: "0.6rem 1.25rem", background: "#0f4c81", color: "#fff", border: "none", borderRadius: "8px", fontWeight: 600, cursor: "pointer", alignSelf: "flex-start" };