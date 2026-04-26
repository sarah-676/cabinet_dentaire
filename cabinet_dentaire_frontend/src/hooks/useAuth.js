/**
 * src/hooks/useAuth.js — VERSION CORRIGÉE
 */

import { useState, useCallback } from "react";
import { useNavigate }           from "react-router-dom";

// ✅ CORRIGÉ : l'export de AuthContext s'appelle useAuth, pas useAuthContext
import { useAuth as useAuthContext } from "../context/AuthContext";

import {
  isAdmin,
  isDentiste,
  isReceptionniste,
} from "../utils/roles";

export function useAuth() {
  const navigate = useNavigate();
  const auth     = useAuthContext();

  const [isSubmitting, setSubmitting] = useState(false);
  const [error,        setError]      = useState(null);

  // ── Login ─────────────────────────────────────────────────────────

  const handleLogin = useCallback(
    async (email, password) => {
      setSubmitting(true);
      setError(null);
      try {
        // ✅ CORRIGÉ : auth.login() retourne une route (string), pas un user
        //    AuthContext.login() appelle getHomeRoute et retourne le chemin
        const homeRoute = await auth.login(email, password);
        navigate(homeRoute, { replace: true });
      } catch (err) {
        // auth.login() throw déjà un Error avec le bon message
        setError(err.message || "Impossible de se connecter.");
      } finally {
        setSubmitting(false);
      }
    },
    [auth, navigate]
  );

  // ── Logout ────────────────────────────────────────────────────────

  const handleLogout = useCallback(async () => {
    await auth.logout();
    navigate("/login", { replace: true });
  }, [auth, navigate]);

  // ── Retour ────────────────────────────────────────────────────────

  return {
    // Données
    user:      auth.user,
    isAuthenticated: auth.isAuthenticated,
    loading: auth.loading,
    role:      auth.user?.role ?? null,

    // Raccourcis rôle
    isAdmin:          isAdmin(auth.user),
    isDentiste:       isDentiste(auth.user),
    isReceptionniste: isReceptionniste(auth.user),

    // Actions
    handleLogin,
    handleLogout,
    // ✅ SUPPRIMÉ : updateUser n'existe pas dans AuthContext

    // État local formulaire
    isSubmitting,
    error,
    clearError: () => setError(null),
  };
}
