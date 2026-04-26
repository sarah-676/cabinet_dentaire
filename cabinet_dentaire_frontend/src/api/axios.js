/**
 * src/api/axios.js — VERSION CORRIGÉE
 * ─────────────────────────────────────
 * Corrections :
 *  1. URL refresh construite proprement (sans .replace fragile)
 *  2. Vérification anti-boucle basée sur _retry uniquement (plus fiable)
 *  3. setToken() utilisé au lieu de setTokens() pour le refresh
 *     (on ne reçoit que access, pas refresh+user)
 */

import axios from "axios";
import {
  getToken,
  getRefreshToken,
  setToken,       // ✅ pour le refresh : on met à jour access seulement
  clearTokens,
} from "../utils/token";

// ── Base URL ─────────────────────────────────────────────────────────────────
const RAW_BASE =
  import.meta.env.VITE_API_BASE_URL || "/api";
const BASE_URL = String(RAW_BASE).replace(/\/+$/, "");

// URL dédiée au refresh (axios brut, hors instance `api`)
const REFRESH_URL = `${BASE_URL}/auth/token/refresh/`;

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15_000,
  headers: { "Content-Type": "application/json" },
});

// ── Interceptor REQUEST : injecter le JWT ─────────────────────────────────────
api.interceptors.request.use(
  (config) => {
    const token = getToken();
    if (token) {
      config.headers["Authorization"] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Gestion du refresh 401 ───────────────────────────────────────────────────
let isRefreshing = false;
let failedQueue  = [];

function processQueue(error, token = null) {
  failedQueue.forEach((prom) => {
    error ? prom.reject(error) : prom.resolve(token);
  });
  failedQueue = [];
}

// ── Interceptor RESPONSE : refresh sur 401 ───────────────────────────────────
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    // ✅ Anti-boucle : on ne retry qu'une fois, et jamais sur l'endpoint refresh lui-même
    if (
      error.response?.status === 401 &&
      !original._retry
    ) {
      // Sécurité : ne jamais retenter le refresh endpoint
      if (original.url?.includes("token/refresh")) {
        clearTokens();
        window.location.href = "/login";
        return Promise.reject(error);
      }

      if (isRefreshing) {
        // File d'attente pendant qu'un refresh est déjà en cours
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          original.headers["Authorization"] = `Bearer ${token}`;
          return api(original);
        });
      }

      original._retry = true;
      isRefreshing    = true;

      const refreshToken = getRefreshToken();
      if (!refreshToken) {
        clearTokens();
        window.location.href = "/login";
        return Promise.reject(error);
      }

      try {
        // ✅ axios brut (pas api) pour éviter la boucle d'interceptors
        const res = await axios.post(REFRESH_URL, { refresh: refreshToken });
        const newAccess = res.data.access;

        setToken(newAccess);            // ✅ setToken (access seulement)
        processQueue(null, newAccess);

        original.headers["Authorization"] = `Bearer ${newAccess}`;
        return api(original);
      } catch (refreshError) {
        processQueue(refreshError, null);
        clearTokens();
        window.location.href = "/login";
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;