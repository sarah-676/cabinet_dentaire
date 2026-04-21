/**
 * src/pages/auth/LoginPage.jsx
 * ─────────────────────────────
 * Page de connexion commune à tous les rôles.
 * Redirige automatiquement vers le dashboard selon le rôle après login.
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function LoginPage() {
  const { login, loading, error } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ email: "", password: "" });
  const [showPwd, setShowPwd] = useState(false);

  const handleChange = (e) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const route = await login(form.email, form.password);
      navigate(route, { replace: true });
    } catch {
      // erreur gérée dans AuthContext
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>

        {/* Logo / titre */}
        <div style={styles.header}>
          <div style={styles.logo}>
            <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
              <rect width="36" height="36" rx="10" fill="#0f4c81"/>
              <path d="M18 7c-3.3 0-5.5 2-6 4.5-.5 2.5.5 4.5 1 6 .5 1.5.5 3-.5 5s-1.5 4.5 1 5.5c2.5 1 3.5-2 4.5-4s2-4 2-4 0 3-1 5.5-1 4.5 1.5 4.5c2.5 0 2-3.5 1-5.5s-1-5.5-1-5.5 1.5 2.5 2 4 2 5 4.5 4c2.5-1 1.5-3.5.5-5.5s-1-3.5-.5-5 1.5-3.5 1-6C27.5 9 25.3 7 22 7c-1 0-2 .5-4 .5S19 7 18 7z" fill="white" opacity="0.9"/>
            </svg>
          </div>
          <h1 style={styles.title}>Cabinet Dentaire</h1>
          <p style={styles.subtitle}>Connectez-vous à votre espace</p>
        </div>

        {/* Formulaire */}
        <form onSubmit={handleSubmit} style={styles.form}>

          {error && (
            <div style={styles.errorBanner}>
              <span>⚠</span> {error}
            </div>
          )}

          <div style={styles.field}>
            <label style={styles.label}>Adresse email</label>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder="nom@cabinet.dz"
              required
              autoComplete="email"
              style={styles.input}
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Mot de passe</label>
            <div style={{ position: "relative" }}>
              <input
                type={showPwd ? "text" : "password"}
                name="password"
                value={form.password}
                onChange={handleChange}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                style={{ ...styles.input, paddingRight: "44px" }}
              />
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                style={styles.eyeBtn}
                tabIndex={-1}
              >
                {showPwd ? "🙈" : "👁"}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{ ...styles.submitBtn, opacity: loading ? 0.7 : 1 }}
          >
            {loading ? "Connexion en cours..." : "Se connecter"}
          </button>

        </form>

        <p style={styles.footer}>
          Cabinet Dentaire © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}

// ── Styles inline (pas de dépendance externe) ─────────────────────────────────
const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg, #e8f4fd 0%, #f0f7ff 50%, #e8f0fe 100%)",
    fontFamily: "'Segoe UI', system-ui, sans-serif",
    padding: "1rem",
  },
  card: {
    background: "#ffffff",
    borderRadius: "16px",
    boxShadow: "0 4px 40px rgba(15,76,129,0.12)",
    padding: "2.5rem 2rem",
    width: "100%",
    maxWidth: "400px",
  },
  header: { textAlign: "center", marginBottom: "2rem" },
  logo: { marginBottom: "1rem" },
  title: {
    fontSize: "1.5rem",
    fontWeight: 700,
    color: "#0f4c81",
    margin: "0 0 0.25rem",
  },
  subtitle: { fontSize: "0.9rem", color: "#6b7280", margin: 0 },
  form: { display: "flex", flexDirection: "column", gap: "1rem" },
  errorBanner: {
    background: "#fef2f2",
    border: "1px solid #fecaca",
    borderRadius: "8px",
    padding: "0.75rem 1rem",
    color: "#dc2626",
    fontSize: "0.875rem",
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
  },
  field: { display: "flex", flexDirection: "column", gap: "0.4rem" },
  label: { fontSize: "0.875rem", fontWeight: 500, color: "#374151" },
  input: {
    padding: "0.65rem 0.875rem",
    border: "1.5px solid #d1d5db",
    borderRadius: "8px",
    fontSize: "0.95rem",
    outline: "none",
    transition: "border-color 0.2s",
    width: "100%",
    boxSizing: "border-box",
  },
  eyeBtn: {
    position: "absolute",
    right: "10px",
    top: "50%",
    transform: "translateY(-50%)",
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: "1rem",
    padding: "4px",
  },
  submitBtn: {
    marginTop: "0.5rem",
    padding: "0.75rem",
    background: "#0f4c81",
    color: "#ffffff",
    border: "none",
    borderRadius: "8px",
    fontSize: "1rem",
    fontWeight: 600,
    cursor: "pointer",
    transition: "background 0.2s, transform 0.1s",
  },
  footer: {
    textAlign: "center",
    fontSize: "0.75rem",
    color: "#9ca3af",
    marginTop: "1.5rem",
    marginBottom: 0,
  },
};