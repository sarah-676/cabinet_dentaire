/**
 * context/NotificationContext.jsx
 * =================================
 * Contexte global notifications — partagé entre :
 *   - Navbar (badge compteur)
 *   - NotificationBell (dropdown)
 *   - NotificationList (page dédiée)
 *
 * Combine CAS 1 (REST) + CAS 2 (WebSocket) via useNotifications.
 *
 * Usage :
 *   const { stats, notifications, marquerLue } = useNotificationContext();
 */

import { createContext, useContext } from "react";
import { useNotifications } from "../hooks/useNotifications";
import { useAuth } from "./AuthContext";

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const { user } = useAuth();

  // N'activer les notifications que si l'utilisateur est connecté
  const notifState = useNotifications();

  if (!user) {
    // Utilisateur non connecté → valeurs vides, pas d'appels API
    return (
      <NotificationContext.Provider value={{
        notifications:        [],
        stats:                { total: 0, non_lues: 0, lues: 0, par_type: {} },
        loading:              false,
        error:                null,
        wsConnected:          false,
        marquerLue:           () => {},
        marquerToutesLues:    () => {},
        supprimerNotification: () => {},
        refetch:              () => {},
      }}>
        {children}
      </NotificationContext.Provider>
    );
  }

  return (
    <NotificationContext.Provider value={notifState}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotificationContext() {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error(
      "useNotificationContext doit être utilisé dans <NotificationProvider>"
    );
  }
  return ctx;
}