/**
 * Builds the notifications WebSocket URL with JWT query auth (api_service Channels).
 * Backend: config/ws_middleware.py reads ?token=<access_jwt>
 */
export function getNotificationWebSocketUrl(accessToken) {
  if (!accessToken) return null;
  const raw = (import.meta.env.VITE_WS_URL || "ws://localhost:8000/ws/notifications/").trim();
  const withoutQuery = raw.split("?")[0];
  const base = withoutQuery.replace(/\/+$/, "");
  return `${base}/?token=${encodeURIComponent(accessToken)}`;
}
