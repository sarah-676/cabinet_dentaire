/**
 * src/context/AuthContext.jsx
 * ────────────────────────────
 * Contexte global : user courant, token, login, logout.
 * Persiste la session via localStorage.
 */

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { login as apiLogin, logout as apiLogout } from "../api/authAPI";
import {
  setTokens,
  clearTokens,
  getStoredUser,
  getToken,
  getRefreshToken,
} from "../utils/token";
import { getHomeRoute } from "../utils/roles";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(getStoredUser);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  /** Connexion — retourne la route home selon le rôle */
  const login = useCallback(async (email, password) => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiLogin(email, password);
      // data = { access, refresh, user: { id, email, full_name, role, is_active } }
      setTokens(data.access, data.refresh, data.user);
      setUser(data.user);
      return getHomeRoute(data.user.role);
    } catch (err) {
      const msg =
        err.response?.data?.detail ||
        err.response?.data?.non_field_errors?.[0] ||
        "Identifiants incorrects.";
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  /** Déconnexion */
  const logout = useCallback(async () => {
    const refresh = getRefreshToken();
    try {
      if (refresh) await apiLogout(refresh);
    } catch {
      // silencieux — on déconnecte quoi qu'il arrive
    } finally {
      clearTokens();
      setUser(null);
    }
  }, []);

  /** Vérifie si l'utilisateur est authentifié */
  const isAuthenticated = !!user && !!getToken();

  return (
    <AuthContext.Provider
      value={{ user, loading, error, login, logout, isAuthenticated }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
};