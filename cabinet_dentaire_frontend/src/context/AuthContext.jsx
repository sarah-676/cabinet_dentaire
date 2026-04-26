/**
 * src/context/AuthContext.jsx
 * ✅ CORRIGÉ : ajout updateUser() + import setStoredUser
 */

import {
  createContext, useContext,
  useState, useEffect, useCallback,
} from "react";
import { login as apiLogin, logout as apiLogout, verifyToken } from "../api/authAPI";
import {
  setTokens, setStoredUser, clearTokens,
  getStoredUser, getToken, getRefreshToken,
} from "../utils/token";
import { getHomeRoute } from "../utils/roles";

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(getStoredUser);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    const token = getToken();
    if (!token) { setLoading(false); return; }
    verifyToken(token)
      .catch(() => { clearTokens(); setUser(null); })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email, password) => {
    setLoading(true); setError(null);
    try {
      const data = await apiLogin(email, password);
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
    } finally { setLoading(false); }
  }, []);

  const logout = useCallback(async () => {
    const refresh = getRefreshToken();
    try { if (refresh) await apiLogout(refresh); } catch { /* silencieux */ }
    finally { clearTokens(); setUser(null); }
  }, []);

  // ✅ Met à jour le user dans le state ET dans localStorage
  const updateUser = useCallback((nouvellesInfos) => {
    setUser((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, ...nouvellesInfos };
      setStoredUser(updated); // ✅ persist après refresh de page
      return updated;
    });
  }, []);

  const isAuthenticated = !!user && !!getToken();
  if (loading) return null;

  return (
    <AuthContext.Provider
      value={{ user, loading, error, login, logout, isAuthenticated, updateUser }}
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