/**
 * pages/auth/LoginPage.jsx
 * ==========================
 * Page de connexion — tous rôles (admin, dentiste, réceptionniste).
 *
 * Flux :
 *   1. User remplit email + password
 *   2. handleLogin() → POST /api/auth/login/
 *   3. Succès → navigate vers dashboard selon user.role
 *   4. Échec  → affichage du message d'erreur backend
 *
 * Compatibilité backend :
 *   - Endpoint : POST /api/auth/login/ (LoginView → CustomTokenObtainPairSerializer)
 *   - Réponse  : { access, refresh, user: { id, email, role, full_name, ... } }
 *   - Erreur   : { detail: "No active account found with the given credentials" }
 */

import React, { useEffect, useState } from "react";
import { useNavigate }                from "react-router-dom";
import { useAuth }                    from "@/hooks/useAuth";
import { getDashboardPath }           from "@/utils/roles";

export default function LoginPage() {
  const navigate = useNavigate();
  const { handleLogin, isSubmitting, error, clearError, isAuth, user } = useAuth();

  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPwd,  setShowPwd]  = useState(false);

  // Si déjà connecté → rediriger vers dashboard
  useEffect(() => {
    if (isAuth && user) {
      navigate(getDashboardPath(user), { replace: true });
    }
  }, [isAuth, user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    clearError();

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !password) return;

    await handleLogin(trimmedEmail, password);
  };

  // ── Styles inline (pas de dépendance CSS externe) ─────────────────

  const styles = {
    page: {
      minHeight:       "100vh",
      display:         "flex",
      alignItems:      "center",
      justifyContent:  "center",
      backgroundColor: "#f0f4f8",
      padding:         "1rem",
      fontFamily:      "system-ui, -apple-system, sans-serif",
    },
    card: {
      backgroundColor: "#ffffff",
      borderRadius:    "12px",
      boxShadow:       "0 4px 24px rgba(0,0,0,0.10)",
      padding:         "2.5rem 2rem",
      width:           "100%",
      maxWidth:        "420px",
    },
    logo: {
      display:        "flex",
      alignItems:     "center",
      justifyContent: "center",
      gap:            "0.5rem",
      marginBottom:   "1.75rem",
    },
    logoIcon: {
      width:           "44px",
      height:          "44px",
      borderRadius:    "10px",
      backgroundColor: "#2563eb",
      display:         "flex",
      alignItems:      "center",
      justifyContent:  "center",
      fontSize:        "22px",
    },
    logoText: {
      fontSize:   "1.25rem",
      fontWeight: "600",
      color:      "#1e293b",
    },
    title: {
      fontSize:     "1.5rem",
      fontWeight:   "700",
      color:        "#1e293b",
      marginBottom: "0.25rem",
      textAlign:    "center",
    },
    subtitle: {
      fontSize:     "0.875rem",
      color:        "#64748b",
      textAlign:    "center",
      marginBottom: "1.75rem",
    },
    formGroup: {
      marginBottom: "1.1rem",
    },
    label: {
      display:      "block",
      fontSize:     "0.875rem",
      fontWeight:   "500",
      color:        "#374151",
      marginBottom: "0.4rem",
    },
    inputWrap: {
      position: "relative",
    },
    input: {
      width:           "100%",
      padding:         "0.65rem 0.875rem",
      border:          "1.5px solid #d1d5db",
      borderRadius:    "8px",
      fontSize:        "0.9375rem",
      color:           "#1e293b",
      backgroundColor: "#fff",
      outline:         "none",
      boxSizing:       "border-box",
      transition:      "border-color 0.15s",
    },
    inputError: {
      borderColor: "#ef4444",
    },
    eyeBtn: {
      position:        "absolute",
      right:           "0.75rem",
      top:             "50%",
      transform:       "translateY(-50%)",
      background:      "none",
      border:          "none",
      cursor:          "pointer",
      padding:         "0",
      color:           "#9ca3af",
      fontSize:        "1.1rem",
      lineHeight:      "1",
    },
    errorBox: {
      backgroundColor: "#fef2f2",
      border:          "1px solid #fecaca",
      borderRadius:    "8px",
      padding:         "0.75rem 1rem",
      fontSize:        "0.875rem",
      color:           "#dc2626",
      marginBottom:    "1.25rem",
      display:         "flex",
      alignItems:      "flex-start",
      gap:             "0.5rem",
    },
    submitBtn: {
      width:           "100%",
      padding:         "0.75rem",
      backgroundColor: isSubmitting ? "#93c5fd" : "#2563eb",
      color:           "#fff",
      border:          "none",
      borderRadius:    "8px",
      fontSize:        "1rem",
      fontWeight:      "600",
      cursor:          isSubmitting ? "not-allowed" : "pointer",
      marginTop:       "0.5rem",
      transition:      "background-color 0.15s",
      display:         "flex",
      alignItems:      "center",
      justifyContent:  "center",
      gap:             "0.5rem",
    },
    spinner: {
      width:          "18px",
      height:         "18px",
      border:         "2.5px solid rgba(255,255,255,0.3)",
      borderTop:      "2.5px solid #fff",
      borderRadius:   "50%",
      animation:      "spin 0.7s linear infinite",
      display:        "inline-block",
    },
    footer: {
      textAlign:  "center",
      marginTop:  "1.5rem",
      fontSize:   "0.8125rem",
      color:      "#94a3b8",
    },
  };

  return (
    <div style={styles.page}>
      {/* CSS pour spinner */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div style={styles.card}>

        {/* Logo */}
        <div style={styles.logo}>
          <div style={styles.logoIcon}>🦷</div>
          <span style={styles.logoText}>Cabinet Dentaire</span>
        </div>

        <h1 style={styles.title}>Connexion</h1>
        <p style={styles.subtitle}>Accédez à votre espace de travail</p>

        {/* Message d'erreur backend */}
        {error && (
          <div style={styles.errorBox} role="alert">
            <span>⚠</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>

          {/* Email */}
          <div style={styles.formGroup}>
            <label htmlFor="email" style={styles.label}>
              Adresse email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              autoFocus
              required
              value={email}
              onChange={(e) => { setEmail(e.target.value); clearError(); }}
              placeholder="ex : dentiste@cabinet.dz"
              style={{
                ...styles.input,
                ...(error ? styles.inputError : {}),
              }}
              disabled={isSubmitting}
            />
          </div>

          {/* Mot de passe */}
          <div style={styles.formGroup}>
            <label htmlFor="password" style={styles.label}>
              Mot de passe
            </label>
            <div style={styles.inputWrap}>
              <input
                id="password"
                type={showPwd ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => { setPassword(e.target.value); clearError(); }}
                placeholder="••••••••"
                style={{
                  ...styles.input,
                  paddingRight: "2.5rem",
                  ...(error ? styles.inputError : {}),
                }}
                disabled={isSubmitting}
              />
              <button
                type="button"
                style={styles.eyeBtn}
                onClick={() => setShowPwd((v) => !v)}
                tabIndex={-1}
                aria-label={showPwd ? "Masquer le mot de passe" : "Afficher le mot de passe"}
              >
                {showPwd ? "🙈" : "👁"}
              </button>
            </div>
          </div>

          {/* Bouton submit */}
          <button
            type="submit"
            style={styles.submitBtn}
            disabled={isSubmitting || !email || !password}
          >
            {isSubmitting && <span style={styles.spinner} />}
            {isSubmitting ? "Connexion en cours…" : "Se connecter"}
          </button>

        </form>

        <div style={styles.footer}>
          Cabinet Dentaire © {new Date().getFullYear()}
        </div>

      </div>
    </div>
  );
}