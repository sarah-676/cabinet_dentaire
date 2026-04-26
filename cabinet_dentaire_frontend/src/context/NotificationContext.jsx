/**
 * NotificationContext — REST + WebSocket (Django Channels) temps réel.
 * ✅ CORRIGÉ : WebSocket et polling désactivés pour le rôle admin
 */
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";

import { useAuth as useAuthContext } from "./AuthContext";
import { useToast } from "./ToastContext";
import { useWebSocket } from "../hooks/useWebSocket";
import { getNotificationWebSocketUrl } from "../utils/notificationWebSocketUrl";
import { getToken } from "../utils/token";

import {
  getNotifications,
  getNotificationStats,
  marquerLue as apiMarquerLue,
  marquerToutesLues as apiMarquerToutesLues,
  deleteNotification as apiSupprimer,
} from "../api/notificationsAPI";

const POLLING_INTERVAL = 30_000;

// ✅ Rôles qui reçoivent des notifications WebSocket
const ROLES_AVEC_NOTIFICATIONS = ["dentiste", "receptionniste"];

const EMPTY_STATE = {
  notifications:         [],
  stats:                 { total: 0, non_lues: 0, lues: 0, par_type: {} },
  loading:               false,
  error:                 null,
  wsConnected:           false,
  marquerLue:            () => {},
  marquerToutesLues:     () => {},
  supprimerNotification: () => {},
  refetch:               () => {},
};

const NotificationContext = createContext(EMPTY_STATE);

export function useNotificationContext() {
  return useContext(NotificationContext);
}

function bumpParType(parType, typeKey) {
  const next = { ...(parType || {}) };
  next[typeKey] = (next[typeKey] || 0) + 1;
  return next;
}

function isRealtimeNotificationRow(data) {
  if (!data || typeof data !== "object") return false;
  if (data.action != null) return false;
  return Boolean(data.id && data.created_at != null && typeof data.type === "string");
}

// ── Composant actif (dentiste + réceptionniste uniquement) ────────────────────

function NotificationsActive({ children }) {
  const { user } = useAuthContext();
  const { showSuccess } = useToast();

  const [notifications, setNotifications] = useState([]);
  const [stats, setStats]                 = useState(EMPTY_STATE.stats);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState(null);
  const [wsConnected, setWsConnected]     = useState(false);
  const [accessRevision, setAccessRevision] = useState(0);

  const pollingRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    const onAccess = () => setAccessRevision((n) => n + 1);
    window.addEventListener("cabinet:access-token-changed", onAccess);
    return () => window.removeEventListener("cabinet:access-token-changed", onAccess);
  }, []);

  const wsUrl = useMemo(
    () => getNotificationWebSocketUrl(getToken()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user?.id, accessRevision]
  );

  const fetchAll = useCallback(async (silent = false) => {
    if (!mountedRef.current) return;
    if (!silent) setLoading(true);
    try {
      const [listRes, statsRes] = await Promise.all([
        getNotifications(),
        getNotificationStats(),
      ]);
      if (!mountedRef.current) return;
      setNotifications(listRes?.results ?? listRes ?? []);
      setStats(statsRes ?? EMPTY_STATE.stats);
      setError(null);
    } catch (err) {
      if (!mountedRef.current) return;
      if (err?.response?.status !== 403) {
        setError("Impossible de charger les notifications.");
      }
    } finally {
      if (mountedRef.current && !silent) setLoading(false);
    }
  }, []);

  const startPolling = useCallback(() => {
    if (pollingRef.current) return;
    pollingRef.current = setInterval(() => fetchAll(true), POLLING_INTERVAL);
  }, [fetchAll]);

  const handleWsMessage = useCallback(
    (raw) => {
      let data;
      try { data = JSON.parse(raw); } catch { return; }

      if (data?.action === "unread_count") {
        const count = typeof data.count === "number" ? data.count : 0;
        setStats((prev) => ({ ...prev, non_lues: count }));
        return;
      }
      if (data?.action === "pong") return;
      if (data?.action === "mark_read" || data?.action === "mark_all_read") return;

      if (isRealtimeNotificationRow(data)) {
        const row = { ...data, read_at: data.read_at ?? null };
        setNotifications((prev) => {
          if (prev.some((n) => n.id === row.id)) return prev;
          return [row, ...prev];
        });
        setStats((prev) => {
          const unread = !row.is_read;
          return {
            ...prev,
            total:    (prev.total ?? 0) + 1,
            non_lues: unread ? (prev.non_lues ?? 0) + 1 : (prev.non_lues ?? 0),
            lues:     unread ? (prev.lues ?? 0) : (prev.lues ?? 0) + 1,
            par_type: bumpParType(prev.par_type, row.type),
          };
        });
        if (row.titre) showSuccess(row.titre);
      }
    },
    [showSuccess]
  );

  useWebSocket(wsUrl, {
    enabled:  Boolean(wsUrl && user),
    reconnect: true,
    onMessage: handleWsMessage,
    onConnectionChange: setWsConnected,
  });

  const handleMarquerLue = useCallback(async (id) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
    setStats((prev) => ({
      ...prev,
      non_lues: Math.max(0, prev.non_lues - 1),
      lues:     prev.lues + 1,
    }));
    try { await apiMarquerLue(id); } catch { fetchAll(true); }
  }, [fetchAll]);

  const handleMarquerToutesLues = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setStats((prev) => ({ ...prev, non_lues: 0, lues: prev.total }));
    try { await apiMarquerToutesLues(); } catch { fetchAll(true); }
  }, [fetchAll]);

  const handleSupprimer = useCallback(async (id) => {
    const target = notifications.find((n) => n.id === id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    setStats((prev) => ({
      ...prev,
      total:    Math.max(0, prev.total - 1),
      non_lues: target && !target.is_read
        ? Math.max(0, prev.non_lues - 1)
        : prev.non_lues,
    }));
    try { await apiSupprimer(id); } catch { fetchAll(true); }
  }, [notifications, fetchAll]);

  useEffect(() => {
    mountedRef.current = true;
    fetchAll();
    startPolling();
    return () => {
      mountedRef.current = false;
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [fetchAll, startPolling]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        stats,
        loading,
        error,
        wsConnected,
        marquerLue:            handleMarquerLue,
        marquerToutesLues:     handleMarquerToutesLues,
        supprimerNotification: handleSupprimer,
        refetch:               () => fetchAll(false),
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

// ── Provider principal ────────────────────────────────────────────────────────

export function NotificationProvider({ children }) {
  const { isAuthenticated, loading, user } = useAuthContext();

  // ✅ Pas authentifié ou chargement en cours → état vide
  if (!isAuthenticated || loading) {
    return (
      <NotificationContext.Provider value={EMPTY_STATE}>
        {children}
      </NotificationContext.Provider>
    );
  }

  // ✅ Admin → pas de WebSocket, pas de polling, état vide silencieux
  // L'admin n'est pas destinataire de notifications (rôles : dentiste + réceptionniste)
  if (!ROLES_AVEC_NOTIFICATIONS.includes(user?.role)) {
    return (
      <NotificationContext.Provider value={EMPTY_STATE}>
        {children}
      </NotificationContext.Provider>
    );
  }

  // ✅ Dentiste ou réceptionniste → connexion WebSocket + polling actifs
  return <NotificationsActive>{children}</NotificationsActive>;
}