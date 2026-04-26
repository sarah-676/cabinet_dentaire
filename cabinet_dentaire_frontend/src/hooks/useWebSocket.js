import { useEffect, useRef } from "react";

/**
 * Browser WebSocket with optional auto-reconnect and JSON keep-alive ping.
 *
 * @param {string|null} url - Full ws(s) URL, or null to stay disconnected
 * @param {object} [options]
 * @param {boolean} [options.enabled=true]
 * @param {boolean} [options.reconnect=true] - Reconnect on abnormal close (not after intentional unmount)
 * @param {(raw: string) => void} [options.onMessage] - Raw message string (caller parses JSON)
 * @param {(open: boolean) => void} [options.onConnectionChange]
 * @param {number} [options.initialReconnectDelayMs=1000]
 * @param {number} [options.maxReconnectDelayMs=30000]
 * @param {number} [options.pingIntervalMs=25000] - Send {"action":"ping"}; set 0 to disable
 */
export function useWebSocket(url, options = {}) {
  const {
    enabled = true,
    reconnect = true,
    onMessage,
    onConnectionChange,
    initialReconnectDelayMs = 1_000,
    maxReconnectDelayMs = 30_000,
    pingIntervalMs = 25_000,
  } = options;

  const wsRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const pingTimerRef = useRef(null);
  const reconnectAttemptRef = useRef(0);
  const intentionalCloseRef = useRef(false);
  const onMessageRef = useRef(onMessage);
  const onConnectionChangeRef = useRef(onConnectionChange);
  onMessageRef.current = onMessage;
  onConnectionChangeRef.current = onConnectionChange;

  useEffect(() => {
    intentionalCloseRef.current = false;

    const clearTimers = () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (pingTimerRef.current) {
        clearInterval(pingTimerRef.current);
        pingTimerRef.current = null;
      }
    };

    const scheduleReconnect = (runConnect) => {
      if (!reconnect || intentionalCloseRef.current) return;
      const delay = Math.min(
        initialReconnectDelayMs * 2 ** reconnectAttemptRef.current,
        maxReconnectDelayMs
      );
      reconnectTimerRef.current = setTimeout(() => {
        reconnectTimerRef.current = null;
        if (intentionalCloseRef.current) return;
        reconnectAttemptRef.current += 1;
        runConnect();
      }, delay);
    };

    if (!enabled || !url) {
      onConnectionChangeRef.current?.(false);
      return () => {
        intentionalCloseRef.current = true;
        clearTimers();
      };
    }

    const connect = () => {
      clearTimers();
      if (intentionalCloseRef.current) return;

      if (wsRef.current) {
        try {
          wsRef.current.onclose = null;
          wsRef.current.close();
        } catch (_) {
          /* ignore */
        }
        wsRef.current = null;
      }

      let ws;
      try {
        ws = new WebSocket(url);
      } catch {
        onConnectionChangeRef.current?.(false);
        scheduleReconnect(connect);
        return;
      }

      wsRef.current = ws;

      ws.onopen = () => {
        if (intentionalCloseRef.current) return;
        reconnectAttemptRef.current = 0;
        onConnectionChangeRef.current?.(true);
        if (pingIntervalMs > 0) {
          pingTimerRef.current = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              try {
                ws.send(JSON.stringify({ action: "ping" }));
              } catch {
                /* ignore */
              }
            }
          }, pingIntervalMs);
        }
      };

      ws.onmessage = (event) => {
        onMessageRef.current?.(event.data);
      };

      ws.onerror = () => {};

      ws.onclose = () => {
        clearTimers();
        wsRef.current = null;
        onConnectionChangeRef.current?.(false);
        if (!intentionalCloseRef.current) {
          scheduleReconnect(connect);
        }
      };
    };

    connect();

    return () => {
      intentionalCloseRef.current = true;
      clearTimers();
      if (wsRef.current) {
        try {
          wsRef.current.onclose = null;
          wsRef.current.close();
        } catch {
          /* ignore */
        }
        wsRef.current = null;
      }
      onConnectionChangeRef.current?.(false);
    };
  }, [
    url,
    enabled,
    reconnect,
    initialReconnectDelayMs,
    maxReconnectDelayMs,
    pingIntervalMs,
  ]);
}
