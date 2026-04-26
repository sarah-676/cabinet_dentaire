/**
 * @deprecated Utiliser `useNotificationContext` depuis `context/NotificationContext.jsx`.
 */
export { useNotificationContext as useNotifications } from "../context/NotificationContext";

import { useState, useEffect, useCallback } from "react";
import { getNotificationStats } from "../api/notificationsAPI";

const POLLING_INTERVAL = 30_000;

/** Badge léger sans monter tout le panneau (polling REST uniquement). */
export function useNotificationsBadge() {
  const [nonLues, setNonLues] = useState(0);

  const fetchStats = useCallback(async () => {
    try {
      const res = await getNotificationStats();
      setNonLues(res?.non_lues ?? 0);
    } catch {
      /* silencieux */
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, POLLING_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchStats]);

  return { nonLues, refetch: fetchStats };
}
