/**
 * src/utils/token.js
 * ✅ AJOUT : setStoredUser() pour mettre à jour le user en localStorage
 */

const ACCESS_KEY  = "cabinet_access";
const REFRESH_KEY = "cabinet_refresh";
const USER_KEY    = "cabinet_user";

export const getToken        = () => localStorage.getItem(ACCESS_KEY);
export const getRefreshToken = () => localStorage.getItem(REFRESH_KEY);

export const getStoredUser = () => {
  try { return JSON.parse(localStorage.getItem(USER_KEY)); }
  catch { return null; }
};

// ✅ AJOUT : met à jour uniquement le user sans toucher aux tokens
export const setStoredUser = (user) => {
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
};

function emitAccessTokenChanged() {
  try {
    window.dispatchEvent(new CustomEvent("cabinet:access-token-changed"));
  } catch { /* non-browser */ }
}

export const setToken = (access) => {
  localStorage.setItem(ACCESS_KEY, access);
  emitAccessTokenChanged();
};

export const setTokens = (access, refresh, user) => {
  localStorage.setItem(ACCESS_KEY, access);
  localStorage.setItem(REFRESH_KEY, refresh);
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  emitAccessTokenChanged();
};

export const clearTokens = () => {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
};