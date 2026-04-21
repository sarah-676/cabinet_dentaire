/**
 * api/notificationsAPI.js
 * ========================
 * Compatible avec notifications/views.py — NotificationViewSet
 *
 * Endpoints couverts :
 *   GET    /api/notifications/              → liste paginée
 *   GET    /api/notifications/{id}/         → détail
 *   PATCH  /api/notifications/{id}/lire/    → marquer lue
 *   POST   /api/notifications/lire-tout/    → tout marquer lu
 *   DELETE /api/notifications/{id}/         → supprimer
 *   GET    /api/notifications/stats/        → compteurs badge
 */

import api from "./axios";

// ─── Liste paginée avec filtres optionnels ─────────────────────────────────
export const getNotifications = (params = {}) => {
  // params accepte : { is_read, type, page }
  return api.get("/notifications/", { params });
};

// ─── Détail d'une notification ─────────────────────────────────────────────
export const getNotification = (id) => {
  return api.get(`/notifications/${id}/`);
};

// ─── Marquer UNE notification comme lue ───────────────────────────────────
export const marquerLue = (id) => {
  return api.patch(`/notifications/${id}/lire/`);
};

// ─── Marquer TOUTES les notifications comme lues ──────────────────────────
export const marquerToutesLues = () => {
  return api.post("/notifications/lire-tout/");
};

// ─── Supprimer une notification ────────────────────────────────────────────
export const supprimerNotification = (id) => {
  return api.delete(`/notifications/${id}/`);
};

// ─── Statistiques pour badge navbar ───────────────────────────────────────
// Retourne : { total, non_lues, lues, par_type }
export const getStatsNotifications = () => {
  return api.get("/notifications/stats/");
};