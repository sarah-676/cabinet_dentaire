/**
 * src/api/authAPI.js
 * ───────────────────
 * Appels vers auth_service via le gateway.
 * Base : /api/auth/
 */

import api from "./axios";

const AUTH = "/api/auth";

// ── Authentification ──────────────────────────────────────────────────────────

/**
 * POST /api/auth/login/
 * Retourne { access, refresh, user: { id, email, full_name, role } }
 */
export const login = async (email, password) => {
  const { data } = await api.post(`${AUTH}/login/`, { email, password });
  return data;
};

/**
 * POST /api/auth/logout/
 * Blackliste le refresh token.
 */
export const logout = async (refreshToken) => {
  await api.post(`${AUTH}/logout/`, { refresh: refreshToken });
};

/**
 * POST /api/auth/token/refresh/
 * Renouvelle le access token. Utilisé par l'interceptor axios.
 */
export const refreshToken = async (refresh) => {
  const { data } = await api.post(`${AUTH}/token/refresh/`, { refresh });
  return data.access;
};

/**
 * GET /api/auth/verify/
 * Vérifie le token et retourne { valid, user }.
 */
export const verifyToken = async () => {
  const { data } = await api.get(`${AUTH}/verify/`);
  return data;
};

// ── Profil ────────────────────────────────────────────────────────────────────

/**
 * GET /api/auth/profile/
 */
export const getProfile = async () => {
  const { data } = await api.get(`${AUTH}/profile/`);
  return data;
};

/**
 * PATCH /api/auth/profile/
 */
export const updateProfile = async (payload) => {
  const { data } = await api.patch(`${AUTH}/profile/`, payload);
  return data;
};

/**
 * POST /api/auth/profile/change-password/
 */
export const changePassword = async (payload) => {
  const { data } = await api.post(`${AUTH}/profile/change-password/`, payload);
  return data;
};

// ── Gestion utilisateurs (Admin) ──────────────────────────────────────────────

/**
 * GET /api/auth/users/                 → liste (avec filtres)
 * params : { role, is_active, search }
 */
export const getUsers = async (params = {}) => {
  const { data } = await api.get(`${AUTH}/users/`, { params });
  return data;
};

/**
 * GET /api/auth/users/dentistes/       → liste dentistes actifs
 * Utilisé par la réceptionniste pour sélectionner un dentiste.
 */
export const getDentistes = async () => {
  const { data } = await api.get(`${AUTH}/users/dentistes/`);
  return data;
};

/**
 * GET /api/auth/users/receptionnistes/ → liste réceptionnistes actifs
 */
export const getReceptionnistes = async () => {
  const { data } = await api.get(`${AUTH}/users/receptionnistes/`);
  return data;
};

/**
 * GET /api/auth/users/stats/
 */
export const getUserStats = async () => {
  const { data } = await api.get(`${AUTH}/users/stats/`);
  return data;
};

/**
 * POST /api/auth/users/               → créer un utilisateur [Admin]
 */
export const createUser = async (payload) => {
  const { data } = await api.post(`${AUTH}/users/`, payload);
  return data;
};

/**
 * PATCH /api/auth/users/{id}/
 */
export const updateUser = async (id, payload) => {
  const { data } = await api.patch(`${AUTH}/users/${id}/`, payload);
  return data;
};

/**
 * DELETE /api/auth/users/{id}/         → désactivation soft
 */
export const deleteUser = async (id) => {
  const { data } = await api.delete(`${AUTH}/users/${id}/`);
  return data;
};

/**
 * PATCH /api/auth/users/{id}/toggle-actif/
 */
export const toggleUserActif = async (id) => {
  const { data } = await api.patch(`${AUTH}/users/${id}/toggle-actif/`);
  return data;
};