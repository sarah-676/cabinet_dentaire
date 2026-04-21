/**
 * utils/token.js
 * ================
 * Gestion du token JWT dans localStorage.
 *
 * Clés utilisées :
 *   "access"  → access token  (courte durée, 60 min)
 *   "refresh" → refresh token (longue durée, 7 jours)
 *   "user"    → objet user sérialisé (id, email, role, full_name, etc.)
 *
 * Ces clés correspondent exactement à la réponse de :
 *   POST /api/auth/login/ → { access, refresh, user: { id, email, role, ... } }
 */

const KEYS = {
  ACCESS:  "access",
  REFRESH: "refresh",
  USER:    "user",
};
export const getToken = getAccessToken;

// ── Access token ──────────────────────────────────────────────────────────────

/** Retourne l'access token ou null. */
export const getAccessToken = () => localStorage.getItem(KEYS.ACCESS);

/** Stocke l'access token. */
export const setAccessToken = (token) => {
  if (token) {
    localStorage.setItem(KEYS.ACCESS, token);
  }
};

/** Supprime l'access token. */
export const removeAccessToken = () => localStorage.removeItem(KEYS.ACCESS);

// ── Refresh token ─────────────────────────────────────────────────────────────

/** Retourne le refresh token ou null. */
export const getRefreshToken = () => localStorage.getItem(KEYS.REFRESH);

/** Stocke le refresh token. */
export const setRefreshToken = (token) => {
  if (token) {
    localStorage.setItem(KEYS.REFRESH, token);
  }
};

/** Supprime le refresh token. */
export const removeRefreshToken = () => localStorage.removeItem(KEYS.REFRESH);

// ── User ──────────────────────────────────────────────────────────────────────

/**
 * Retourne l'objet user depuis localStorage ou null.
 *
 * Structure attendue (réponse auth_service) :
 * {
 *   id:         "uuid",
 *   email:      "...",
 *   full_name:  "...",
 *   first_name: "...",
 *   last_name:  "...",
 *   role:       "admin" | "dentiste" | "receptionniste",
 *   is_active:  true,
 *   specialite: "...",   ← dentiste uniquement
 *   avatar:     "url"    ← nullable
 * }
 */
export const getUser = () => {
  try {
    const raw = localStorage.getItem(KEYS.USER);
    return raw ? JSON.parse(raw) : null;
  } catch {
    removeUser();
    return null;
  }
};

/** Stocke l'objet user (sérialisé en JSON). */
export const setUser = (user) => {
  if (user) {
    localStorage.setItem(KEYS.USER, JSON.stringify(user));
  }
};

/** Supprime l'objet user. */
export const removeUser = () => localStorage.removeItem(KEYS.USER);

// ── Session complète ──────────────────────────────────────────────────────────

/**
 * Stocke la session complète après login.
 * Appelé depuis AuthContext après POST /api/auth/login/.
 *
 * @param {Object} params
 * @param {string} params.access   - access JWT
 * @param {string} params.refresh  - refresh JWT
 * @param {Object} params.user     - objet user
 */
export const saveSession = ({ access, refresh, user }) => {
  setAccessToken(access);
  setRefreshToken(refresh);
  setUser(user);
};

/**
 * Supprime toute la session (logout).
 * Appelé depuis AuthContext après POST /api/auth/logout/.
 */
export const clearSession = () => {
  removeAccessToken();
  removeRefreshToken();
  removeUser();
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Retourne true si un access token est présent en localStorage. */
export const isAuthenticated = () => Boolean(getAccessToken());

/**
 * Décode le payload JWT sans vérification de signature.
 * Utile pour lire exp, user_id, role côté client.
 *
 * @param {string} token
 * @returns {Object|null}
 */
export const decodeToken = (token) => {
  if (!token) return null;
  try {
    const payload = token.split(".")[1];
    const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(decoded);
  } catch {
    return null;
  }
};

/**
 * Retourne true si l'access token est expiré ou expire bientôt.
 *
 * @param {number} thresholdMs - Marge avant expiration (défaut : 5 min)
 */
export const isTokenExpiringSoon = (thresholdMs = 300_000) => {
  const token   = getAccessToken();
  const payload = decodeToken(token);
  if (!payload?.exp) return true;
  const expiresAt = payload.exp * 1000; // exp est en secondes
  return Date.now() >= expiresAt - thresholdMs;
};