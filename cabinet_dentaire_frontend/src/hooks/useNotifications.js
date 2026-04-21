/**
 * hooks/useNotifications.js
 * ==========================
 * Gère les deux cas demandés par le prof :
 *
 * CAS 1 — Persistant (REST polling)
 *   → Appelle GET /notifications/ toutes les 30s
 *   → Historique, filtres, marquer lu, pagination
 *
 * CAS 2 — Temps réel (WebSocket)
 *   → Connexion ws://localhost:8080/ws/notifications/
 *   → Reçoit les événements RabbitMQ en direct
 *   → Ajoute la nouvelle notif en tête de liste sans recharger
 *
 * Les deux cas sont actifs simultanément :
 *   - WebSocket = instantané
 *   - Polling = filet de sécurité si WS déconnecté
 */

import { useState, useEffect, useRef, useCallback } from "react";
import {
  getNotifications,
  getStatsNotifications,
  marquerLue,
  marquerToutesLues,
  supprimerNotification,
} from "../api/notificationsAPI";
import { getToken } from "../utils/token";

// ─── Intervalle polling CAS 1 (ms) ────────────────────────────────────────
const POLLING_INTERVAL = 30_000;

// ─── URL WebSocket CAS 2 ───────────────────────────────────────────────────
const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:8080/ws/notifications/";

// ===========================================================================
//  Hook principal
// ===========================================================================

export function useNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [stats, setStats]                 = useState({ total: 0, non_lues: 0, lues: 0, par_type: {} });
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState(null);
  const [wsConnected, setWsConnected]     = useState(false);

  const wsRef          = useRef(null);
  const pollingRef     = useRef(null);
  const reconnectRef   = useRef(null);
  const reconnectDelay = useRef(2000);

  // ── CAS 1 : Charger la liste REST ──────────────────────────────────────
  const fetchNotifications = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [listRes, statsRes] = await Promise.all([
        getNotifications(),
        getStatsNotifications(),
      ]);
      // DRF renvoie { results: [...], count } ou directement []
      const items = listRes.data?.results ?? listRes.data ?? [];
      setNotifications(items);
      setStats(statsRes.data);
      setError(null);
    } catch (err) {
      if (!silent) setError("Impossible de charger les notifications.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  // ── CAS 1 : Démarrer le polling ────────────────────────────────────────
  const startPolling = useCallback(() => {
    if (pollingRef.current) return;
    pollingRef.current = setInterval(() => {
      fetchNotifications(true); // silent = ne pas afficher spinner
    }, POLLING_INTERVAL);
  }, [fetchNotifications]);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  // ── CAS 2 : Connexion WebSocket ────────────────────────────────────────
  const connectWebSocket = useCallback(() => {
    const token = getToken();
    if (!token) return;

    // Fermer l'ancienne connexion si elle existe
    if (wsRef.current) {
      wsRef.current.onclose = null; // éviter le reconnect automatique
      wsRef.current.close();
    }

    // Ajouter le token JWT dans l'URL (Django Channels le lit depuis query string)
    const url = `${WS_URL}?token=${token}`;
    const ws  = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsConnected(true);
      reconnectDelay.current = 2000; // reset le délai de reconnexion
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // Le backend envoie { type: "notification", data: { ...NotificationSerializer } }
        if (data.type === "notification" && data.data) {
          const nouvelleNotif = data.data;

          // Ajouter en tête de liste sans recharger tout
          setNotifications((prev) => {
            const dejaPresent = prev.some((n) => n.id === nouvelleNotif.id);
            if (dejaPresent) return prev;
            return [nouvelleNotif, ...prev];
          });

          // Incrémenter le compteur non_lues
          setStats((prev) => ({
            ...prev,
            total:    prev.total + 1,
            non_lues: prev.non_lues + 1,
          }));
        }
      } catch {
        // Message non-JSON ignoré
      }
    };

    ws.onerror = () => {
      setWsConnected(false);
    };

    ws.onclose = () => {
      setWsConnected(false);
      // Reconnexion automatique avec backoff exponentiel (max 30s)
      const delay = Math.min(reconnectDelay.current, 30_000);
      reconnectDelay.current = delay * 2;
      reconnectRef.current = setTimeout(connectWebSocket, delay);
    };
  }, []);

  // ── Actions : marquer une notification lue ─────────────────────────────
  const handleMarquerLue = useCallback(async (id) => {
    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
    setStats((prev) => ({
      ...prev,
      non_lues: Math.max(0, prev.non_lues - 1),
      lues: prev.lues + 1,
    }));

    try {
      await marquerLue(id);
    } catch {
      // Rollback si erreur
      fetchNotifications(true);
    }
  }, [fetchNotifications]);

  // ── Actions : marquer toutes lues ─────────────────────────────────────
  const handleMarquerToutesLues = useCallback(async () => {
    // Optimistic update
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setStats((prev) => ({ ...prev, non_lues: 0, lues: prev.total }));

    try {
      await marquerToutesLues();
    } catch {
      fetchNotifications(true);
    }
  }, [fetchNotifications]);

  // ── Actions : supprimer ────────────────────────────────────────────────
  const handleSupprimer = useCallback(async (id) => {
    const notifSupprimee = notifications.find((n) => n.id === id);

    // Optimistic update
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    setStats((prev) => ({
      ...prev,
      total: Math.max(0, prev.total - 1),
      non_lues: notifSupprimee && !notifSupprimee.is_read
        ? Math.max(0, prev.non_lues - 1)
        : prev.non_lues,
    }));

    try {
      await supprimerNotification(id);
    } catch {
      fetchNotifications(true);
    }
  }, [notifications, fetchNotifications]);

  // ── Initialisation ─────────────────────────────────────────────────────
  useEffect(() => {
    fetchNotifications();   // CAS 1 : chargement initial
    startPolling();          // CAS 1 : polling
    connectWebSocket();      // CAS 2 : WebSocket

    return () => {
      stopPolling();
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
    };
  }, [fetchNotifications, startPolling, stopPolling, connectWebSocket]);

  return {
    notifications,
    stats,
    loading,
    error,
    wsConnected,
    marquerLue:         handleMarquerLue,
    marquerToutesLues:  handleMarquerToutesLues,
    supprimerNotification: handleSupprimer,
    refetch:            () => fetchNotifications(false),
  };
}

// ===========================================================================
//  Hook léger pour badge uniquement (Navbar)
//  → N'écoute que le compteur, ne charge pas toute la liste
// ===========================================================================

export function useNotificationsBadge() {
  const [nonLues, setNonLues] = useState(0);

  const fetchStats = useCallback(async () => {
    try {
      const res = await getStatsNotifications();
      setNonLues(res.data?.non_lues ?? 0);
    } catch {
      // silencieux
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, POLLING_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchStats]);

  return { nonLues, refetch: fetchStats };
}