/**
 * api/axios.js
 * ==============
 * Instance Axios configurée pour le cabinet dentaire.
 *
 * Architecture :
 *   Frontend → Gateway (8080) → auth_service (8001) ou api_service (8000)
 *   Le frontend ne contacte JAMAIS directement les services — toujours via gateway.
 *
 * Interceptors :
 *   Request  → injecte Authorization: Bearer <access_token>
 *   Response → sur 401, tente de rafraîchir le token via /api/auth/token/refresh/
 *              Si refresh échoue → clearSession + redirect /login
 */

import axios from "axios";
import {
  getAccessToken,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
  clearSession,
} from "@/utils/token";

// ── Instance principale ───────────────────────────────────────────────────────

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080",
  timeout: 15_000,
  headers: {
    "Content-Type": "application/json",
    Accept:         "application/json",
  },
});

// ── Interceptor Request : injection du token ──────────────────────────────────

apiClient.interceptors.request.use(
  (config) => {
    const token = getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Refresh en cours (évite les doubles appels simultanés) ────────────────────

let _isRefreshing      = false;
let _pendingQueue      = [];   // [{resolve, reject}]

const _processQueue = (error, token = null) => {
  _pendingQueue.forEach(({ resolve, reject }) => {
    error ? reject(error) : resolve(token);
  });
  _pendingQueue = [];
};

// ── Interceptor Response : gestion 401 + auto-refresh ────────────────────────

apiClient.interceptors.response.use(
  // Réponse OK → on laisse passer
  (response) => response,

  // Erreur → on traite
  async (error) => {
    const originalRequest = error.config;

    // Seulement les 401 non-retentés, et pas l'endpoint refresh lui-même
    const is401     = error.response?.status === 401;
    const isRetry   = originalRequest._retry === true;
    const isRefresh = originalRequest.url?.includes("/api/auth/token/refresh/");
    const isLogin   = originalRequest.url?.includes("/api/auth/login/");

    if (!is401 || isRetry || isRefresh || isLogin) {
      return Promise.reject(error);
    }

    // Si un refresh est déjà en cours → mettre en file d'attente
    if (_isRefreshing) {
      return new Promise((resolve, reject) => {
        _pendingQueue.push({ resolve, reject });
      }).then((token) => {
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return apiClient(originalRequest);
      });
    }

    // Lancer le refresh
    originalRequest._retry = true;
    _isRefreshing          = true;

    const refreshToken = getRefreshToken();

    if (!refreshToken) {
      _isRefreshing = false;
      _logout();
      return Promise.reject(error);
    }

    try {
      // POST /api/auth/token/refresh/ → { access, refresh }
      const { data } = await axios.post(
        `${import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080"}/api/auth/token/refresh/`,
        { refresh: refreshToken },
        { headers: { "Content-Type": "application/json" } }
      );

      const newAccess  = data.access;
      const newRefresh = data.refresh ?? refreshToken;

      setAccessToken(newAccess);
      setRefreshToken(newRefresh);

      // Relancer toutes les requêtes en attente
      _processQueue(null, newAccess);

      // Relancer la requête originale avec le nouveau token
      originalRequest.headers.Authorization = `Bearer ${newAccess}`;
      return apiClient(originalRequest);

    } catch (refreshError) {
      _processQueue(refreshError, null);
      _logout();
      return Promise.reject(refreshError);

    } finally {
      _isRefreshing = false;
    }
  }
);

// ── Helpers internes ──────────────────────────────────────────────────────────

function _logout() {
  clearSession();
  // Redirection vers login sans recharger tout React
  if (window.location.pathname !== "/login") {
    window.location.replace("/login");
  }
}

// ── Export ────────────────────────────────────────────────────────────────────

export default apiClient;

/**
 * Helper pour les requêtes multipart/form-data (upload fichiers).
 * Utilisé dans radiosAPI.js pour l'upload d'images radiographiques.
 *
 * @param {string} url
 * @param {FormData} formData
 * @param {Function} [onUploadProgress]
 */
export const uploadFile = (url, formData, onUploadProgress) =>
  apiClient.post(url, formData, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress,
  });