/**
 * src/utils/token.js
 * ───────────────────
 * Gestion sécurisée des tokens JWT en localStorage.
 */

const ACCESS_KEY  = "cabinet_access";
const REFRESH_KEY = "cabinet_refresh";
const USER_KEY    = "cabinet_user";

export const getToken        = () => localStorage.getItem(ACCESS_KEY);
export const getRefreshToken = () => localStorage.getItem(REFRESH_KEY);
export const getStoredUser   = () => {
  try { return JSON.parse(localStorage.getItem(USER_KEY)); }
  catch { return null; }
};

export const setToken = (access) => localStorage.setItem(ACCESS_KEY, access);

export const setTokens = (access, refresh, user) => {
  localStorage.setItem(ACCESS_KEY,  access);
  localStorage.setItem(REFRESH_KEY, refresh);
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const clearTokens = () => {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
};

export const isAuthenticated = () => !!getToken();