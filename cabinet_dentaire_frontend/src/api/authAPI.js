/**
 * api/authAPI.js
 * ================
 * Couche HTTP — endpoints auth_service.
 *
 * Tous les appels passent par le gateway (8080) → auth_service (8001).
 *
 * Endpoints utilisés (auth_app/urls.py) :
 *   POST  /api/auth/login/                   → LoginView
 *   POST  /api/auth/logout/                  → LogoutView
 *   POST  /api/auth/token/refresh/           → TokenRefreshView
 *   GET   /api/auth/verify/                  → VerifyTokenView
 *   GET   /api/auth/profile/                 → ProfileView
 *   PATCH /api/auth/profile/                 → ProfileView
 *   POST  /api/auth/profile/change-password/ → ChangePasswordView
 */

import apiClient from "./axios";

// ── Préfixe ───────────────────────────────────────────────────────────────────
const BASE = "/api/auth";

// ── Auth ──────────────────────────────────────────────────────────────────────

/**
 * POST /api/auth/login/
 *
 * Réponse (CustomTokenObtainPairSerializer.validate) :
 * {
 *   access:  "jwt...",
 *   refresh: "jwt...",
 *   user: {
 *     id, email, first_name, last_name, full_name,
 *     phone, role, specialite, numero_ordre,
 *     avatar, is_active, date_joined, updated_at
 *   }
 * }
 *
 * @param {string} email
 * @param {string} password
 */
export const login = (email, password) =>
  apiClient.post(`${BASE}/login/`, { email, password });

/**
 * POST /api/auth/logout/
 * Blackliste le refresh token → invalide la session côté serveur.
 *
 * @param {string} refreshToken
 */
export const logout = (refreshToken) =>
  apiClient.post(`${BASE}/logout/`, { refresh: refreshToken });

/**
 * POST /api/auth/token/refresh/
 * Utilisé par l'interceptor axios.js — rarement appelé manuellement.
 *
 * @param {string} refreshToken
 */
export const refreshToken = (refreshToken) =>
  apiClient.post(`${BASE}/token/refresh/`, { refresh: refreshToken });

/**
 * GET /api/auth/verify/
 * Vérifie que le token est valide et retourne les infos user.
 * Utilisé au démarrage de l'app pour restaurer la session.
 *
 * Réponse : { valid: true, user: { id, email, full_name, role, is_active } }
 */
export const verifyToken = () =>
  apiClient.get(`${BASE}/verify/`);

// ── Profil ────────────────────────────────────────────────────────────────────

/**
 * GET /api/auth/profile/
 * Retourne UserProfileSerializer : id, email, full_name, role, etc.
 */
export const getProfile = () =>
  apiClient.get(`${BASE}/profile/`);

/**
 * PATCH /api/auth/profile/
 * Champs modifiables (UserUpdateSelfSerializer) :
 *   first_name, last_name, phone, specialite, numero_ordre, avatar
 *
 * @param {Object} data
 */
export const updateProfile = (data) =>
  apiClient.patch(`${BASE}/profile/`, data);

/**
 * PATCH /api/auth/profile/ — avec avatar (multipart/form-data)
 *
 * @param {FormData} formData
 */
export const updateProfileWithAvatar = (formData) =>
  apiClient.patch(`${BASE}/profile/`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

/**
 * POST /api/auth/profile/change-password/
 * Body (ChangePasswordSerializer) :
 *   { current_password, new_password, new_password_confirm }
 *
 * @param {Object} data
 */
export const changePassword = (data) =>
  apiClient.post(`${BASE}/profile/change-password/`, data);