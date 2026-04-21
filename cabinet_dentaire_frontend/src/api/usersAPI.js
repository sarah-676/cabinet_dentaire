/**
 * api/usersAPI.js
 * =================
 * Couche HTTP — gestion des utilisateurs (admin).
 *
 * Endpoints (auth_app/urls.py → UserViewSet) :
 *
 *   GET    /api/auth/users/                     → liste paginée + filtres
 *   POST   /api/auth/users/                     → créer [Admin]
 *   GET    /api/auth/users/{id}/                → détail [Admin ou soi]
 *   PATCH  /api/auth/users/{id}/                → modifier [Admin ou soi]
 *   DELETE /api/auth/users/{id}/                → désactiver soft [Admin]
 *   PATCH  /api/auth/users/{id}/toggle-actif/   → activer/désactiver [Admin]
 *   GET    /api/auth/users/dentistes/           → liste dentistes actifs
 *   GET    /api/auth/users/receptionnistes/     → liste réceptionnistes actifs
 *   GET    /api/auth/users/stats/               → compteurs dashboard [Admin]
 */

import apiClient from "./axios";

const BASE = "/api/auth/users";

// ── Liste & détail ────────────────────────────────────────────────────────────

/**
 * GET /api/auth/users/
 * Retourne UserListSerializer[] (filtrée selon le rôle appelant).
 *
 * @param {Object} params - filtres query string
 * @param {string} [params.role]      - "admin" | "dentiste" | "receptionniste"
 * @param {boolean} [params.is_active]
 * @param {string} [params.search]   - recherche nom/email/téléphone
 * @param {string} [params.ordering] - "date_joined" | "last_name" | "role"
 */
export const getUsers = (params = {}) =>
  apiClient.get(`${BASE}/`, { params });

/**
 * GET /api/auth/users/{id}/
 * Retourne UserProfileSerializer.
 *
 * @param {string} id - UUID
 */
export const getUserById = (id) =>
  apiClient.get(`${BASE}/${id}/`);

// ── Création ──────────────────────────────────────────────────────────────────

/**
 * POST /api/auth/users/
 * Crée un utilisateur — réservé Admin.
 *
 * Body (UserCreateSerializer) :
 * {
 *   email, first_name, last_name, phone,
 *   role,                    ← "admin" | "dentiste" | "receptionniste"
 *   specialite?,             ← dentiste uniquement
 *   numero_ordre?,           ← dentiste uniquement
 *   password,
 *   password_confirm,
 *   is_active?               ← défaut true
 * }
 *
 * Réponse : UserProfileSerializer (201)
 *
 * @param {Object} userData
 */
export const createUser = (userData) =>
  apiClient.post(`${BASE}/`, userData);

// ── Modification ──────────────────────────────────────────────────────────────

/**
 * PATCH /api/auth/users/{id}/
 * Modification par Admin (UserUpdateAdminSerializer) :
 *   first_name, last_name, phone, role, specialite, numero_ordre, is_active, avatar
 *
 * @param {string} id
 * @param {Object} data
 */
export const updateUser = (id, data) =>
  apiClient.patch(`${BASE}/${id}/`, data);

/**
 * PATCH /api/auth/users/{id}/ — avec avatar (multipart)
 *
 * @param {string}   id
 * @param {FormData} formData
 */
export const updateUserWithAvatar = (id, formData) =>
  apiClient.patch(`${BASE}/${id}/`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

// ── Désactivation ─────────────────────────────────────────────────────────────

/**
 * DELETE /api/auth/users/{id}/
 * Soft delete — désactive sans supprimer (perform_destroy → is_active=False).
 * Réponse : { detail: "Utilisateur '...' désactivé." } (200)
 *
 * @param {string} id
 */
export const deleteUser = (id) =>
  apiClient.delete(`${BASE}/${id}/`);

/**
 * PATCH /api/auth/users/{id}/toggle-actif/
 * Bascule is_active.
 * Réponse : { detail: "Compte activé/désactivé.", is_active: bool }
 *
 * @param {string} id
 */
export const toggleUserActif = (id) =>
  apiClient.patch(`${BASE}/${id}/toggle-actif/`);

// ── Listes spécialisées ───────────────────────────────────────────────────────

/**
 * GET /api/auth/users/dentistes/
 * Liste des dentistes actifs — UserListSerializer[].
 * Accessible à tous les utilisateurs connectés.
 */
export const getDentistes = () =>
  apiClient.get(`${BASE}/dentistes/`);

/**
 * GET /api/auth/users/receptionnistes/
 * Liste des réceptionnistes actifs — UserListSerializer[].
 */
export const getReceptionnistes = () =>
  apiClient.get(`${BASE}/receptionnistes/`);

// ── Statistiques ──────────────────────────────────────────────────────────────

/**
 * GET /api/auth/users/stats/
 * Réponse :
 * {
 *   total, admins, dentistes, receptionnistes, inactifs
 * }
 * Réservé Admin.
 */
export const getUserStats = () =>
  apiClient.get(`${BASE}/stats/`);