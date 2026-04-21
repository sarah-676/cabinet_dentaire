/**
 * src/context/NotificationContext.jsx
 * ─────────────────────────────────────
 * Gère le badge de notifications en temps réel via WebSocket.
 * Fallback polling si WebSocket indisponible.
 */

import {
  createContext, useContext, useState, useEffect, useRef, useCallback,
} from "react";
import { getNotificationStats, marquerToutesLues } from "../api/notificationsAPI";
import { useAuth } from "./AuthContext";
import { getToken } from "../utils/token";

const NotifContext = createContext(null);

const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:8000";

export function NotificationProvider({ children }) {
  const { user, isAuthenticated } = useAuth();
  const [nonLues, setNonLues]     = useState(0);
  const [notifs,  setNotifs]      = useState([]);
  const wsRef                     = useRef(null);
  const pollRef                   = useRef(null);

  const fetchStats = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const stats = await getNotificationStats();
      setNonLues(stats.non_lues || 0);
    } catch {
      // silencieux
    }
  }, [isAuthenticated]);

  /** Connexion WebSocket Django Channels */
  const connectWS = useCallback(() => {
    if (!isAuthenticated || !user) return;
    const token = getToken();
    const url   = `${WS_URL}/ws/notifications/?token=${token}`;

    wsRef.current = new WebSocket(url);

    wsRef.current.onopen  = () => console.info("[WS] Notifications connecté");
    wsRef.current.onclose = () => {
      // Reconnect après 5s si fermé de façon inattendue
      setTimeout(connectWS, 5000);
    };
    wsRef.current.onerror = () => {
      // Fallback polling si WS non disponible
      _startPolling();
    };
    wsRef.current.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "notification") {
          setNonLues((prev) => prev + 1);
          setNotifs((prev) => [msg.data, ...prev.slice(0, 49)]);
        }
      } catch {/* ignore */}
    };
  }, [isAuthenticated, user]);

  const _startPolling = () => {
    if (pollRef.current) return;
    fetchStats();
    pollRef.current = setInterval(fetchStats, 30_000); // toutes les 30s
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchStats();
    connectWS();
    return () => {
      wsRef.current?.close();
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [isAuthenticated]);

  const toutMarquerLu = useCallback(async () => {
    await marquerToutesLues();
    setNonLues(0);
  }, []);

  return (
    <NotifContext.Provider
      value={{ nonLues, notifs, fetchStats, toutMarquerLu, setNonLues }}
    >
      {children}
    </NotifContext.Provider>
  );
}

export const useNotifications = () => {
  const ctx = useContext(NotifContext);
  if (!ctx) throw new Error("useNotifications must be inside NotificationProvider");
  return ctx;
};