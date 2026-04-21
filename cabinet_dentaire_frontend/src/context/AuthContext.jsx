/**
 * context/AuthContext.jsx
 * =========================
 * Contexte global d'authentification.
 *
 * Expose :
 *   user        → objet user complet (UserProfileSerializer) ou null
 *   isLoading   → true pendant la vérification initiale du token
 *   isAuth      → raccourci : !!user
 *   login()     → POST /api/auth/login/ + sauvegarde session
 *   logout()    → POST /api/auth/logout/ + clearSession
 *   updateUser()→ met à jour user dans le contexte ET localStorage
 *
 * Compatibilité backend :
 *   - login() → réponse { access, refresh, user } (CustomTokenObtainPairSerializer)
 *   - user.role → "admin" | "dentiste" | "receptionniste" (UserRole.choices)
 *   - Au démarrage, appelle GET /api/auth/verify/ pour valider le token existant
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { login as apiLogin, logout as apiLogout, verifyToken } from "@/api/authAPI";
import {
  saveSession,
  clearSession,
  getAccessToken,
  getUser,
  setUser,
  getRefreshToken,
} from "@/utils/token";
import { getDashboardPath } from "@/utils/roles";

// ── Création du contexte ──────────────────────────────────────────────────────

const AuthContext = createContext(null);

// ── Provider ──────────────────────────────────────────────────────────────────

export function AuthProvider({ children }) {
  const [user, setUserState]   = useState(null);
  const [isLoading, setLoading] = useState(true); // vrai au premier rendu

  // ── Restauration de session au démarrage ──────────────────────────

  useEffect(() => {
    const restoreSession = async () => {
      const token = getAccessToken();

      if (!token) {
        // Pas de token → pas de session
        setLoading(false);
        return;
      }

      // On a un token en localStorage → vérifier qu'il est encore valide
      try {
        const { data } = await verifyToken();
        // GET /api/auth/verify/ → { valid: true, user: { id, email, role, ... } }
        if (data.valid && data.user) {
          // Mettre à jour le user en mémoire avec les données fraîches du serveur
          setUser(data.user);
          setUserState(data.user);
        } else {
          throw new Error("Token invalide");
        }
      } catch {
        // Token expiré ou invalide → nettoyer
        clearSession();
        setUserState(null);
      } finally {
        setLoading(false);
      }
    };

    restoreSession();
  }, []);

  // ── Login ─────────────────────────────────────────────────────────

  /**
   * Connecte l'utilisateur.
   *
   * @param {string} email
   * @param {string} password
   * @returns {Object} user — pour que LoginPage puisse rediriger selon le rôle
   * @throws {Object} error.response.data — erreurs backend (champs invalides, 401)
   */
  const login = useCallback(async (email, password) => {
    // POST /api/auth/login/ → { access, refresh, user }
    const { data } = await apiLogin(email, password);

    const { access, refresh, user } = data;

    // Sauvegarder la session dans localStorage
    saveSession({ access, refresh, user });

    // Mettre à jour le contexte
    setUserState(user);

    return user;
  }, []);

  // ── Logout ────────────────────────────────────────────────────────

  /**
   * Déconnecte l'utilisateur.
   * Blackliste le refresh token côté serveur puis nettoie le localStorage.
   */
  const logout = useCallback(async () => {
    const refresh = getRefreshToken();

    // Tenter le logout côté serveur (blacklist refresh)
    // On ne bloque pas l'UI si ça échoue
    if (refresh) {
      try {
        await apiLogout(refresh);
      } catch {
        // Silencieux — on nettoie quand même côté client
      }
    }

    clearSession();
    setUserState(null);
  }, []);

  // ── updateUser ────────────────────────────────────────────────────

  /**
   * Met à jour l'objet user dans le contexte ET dans localStorage.
   * Appelé après PATCH /api/auth/profile/ pour refléter les changements.
   *
   * @param {Object} updatedUser - données fraîches du serveur
   */
  const updateUser = useCallback((updatedUser) => {
    setUser(updatedUser);
    setUserState(updatedUser);
  }, []);

  // ── Valeur mémoïsée ───────────────────────────────────────────────

  const value = useMemo(
    () => ({
      user,
      isLoading,
      isAuth:        !!user,
      dashboardPath: user ? getDashboardPath(user) : "/login",
      login,
      logout,
      updateUser,
    }),
    [user, isLoading, login, logout, updateUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Hook pour accéder au contexte d'auth.
 * Doit être utilisé à l'intérieur de <AuthProvider>.
 *
 * @example
 * const { user, login, logout, isAuth } = useAuthContext();
 */
export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuthContext doit être utilisé dans <AuthProvider>");
  }
  return ctx;
}

export default AuthContext;