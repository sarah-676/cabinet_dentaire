/**
 * hooks/useAuth.js
 * ==================
 * Hook métier d'authentification.
 *
 * Encapsule la logique de login/logout avec gestion d'état locale
 * (loading, error) pour les composants qui en ont besoin.
 *
 * Utilise useAuthContext() en interne.
 *
 * Usage dans LoginPage :
 *   const { handleLogin, isSubmitting, error } = useAuth();
 *
 * Usage dans Navbar (logout) :
 *   const { handleLogout } = useAuth();
 *
 * Usage global (accès user/role) :
 *   const { user, isAuth } = useAuth();
 */

import { useState, useCallback } from "react";
import { useNavigate }           from "react-router-dom";

import { useAuthContext }  from "@/context/AuthContext";
import { getDashboardPath } from "@/utils/roles";
import {
  isAdmin,
  isDentiste,
  isReceptionniste,
  getRole,
} from "@/utils/roles";

export function useAuth() {
  const navigate = useNavigate();
  const auth     = useAuthContext();

  const [isSubmitting, setSubmitting] = useState(false);
  const [error, setError]             = useState(null);

  // ── Login ─────────────────────────────────────────────────────────

  /**
   * Gère le submit du formulaire de login.
   * Redirige vers le dashboard du rôle après succès.
   *
   * @param {string} email
   * @param {string} password
   */
  const handleLogin = useCallback(
    async (email, password) => {
      setSubmitting(true);
      setError(null);

      try {
        const user = await auth.login(email, password);
        navigate(getDashboardPath(user), { replace: true });
      } catch (err) {
        // Extraire le message d'erreur du backend
        const data = err?.response?.data;

        if (data?.detail) {
          // Erreur standard DRF : { detail: "No active account found..." }
          setError(data.detail);
        } else if (data?.non_field_errors) {
          setError(data.non_field_errors[0]);
        } else if (typeof data === "object" && data !== null) {
          // Erreurs de champs : { email: ["..."], password: ["..."] }
          const first = Object.values(data).flat()[0];
          setError(typeof first === "string" ? first : "Erreur de connexion.");
        } else {
          setError("Impossible de se connecter. Vérifiez vos identifiants.");
        }
      } finally {
        setSubmitting(false);
      }
    },
    [auth, navigate]
  );

  // ── Logout ────────────────────────────────────────────────────────

  /**
   * Déconnecte et redirige vers /login.
   */
  const handleLogout = useCallback(async () => {
    await auth.logout();
    navigate("/login", { replace: true });
  }, [auth, navigate]);

  // ── Retour ────────────────────────────────────────────────────────

  return {
    // Données
    user:    auth.user,
    isAuth:  auth.isAuth,
    isLoading: auth.isLoading,
    role:    getRole(auth.user),

    // Raccourcis rôle
    isAdmin:          isAdmin(auth.user),
    isDentiste:       isDentiste(auth.user),
    isReceptionniste: isReceptionniste(auth.user),

    // Actions
    handleLogin,
    handleLogout,
    updateUser: auth.updateUser,

    // État local du formulaire
    isSubmitting,
    error,
    clearError: () => setError(null),
  };
}