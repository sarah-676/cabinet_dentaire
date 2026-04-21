/**
 * components/notifications/NotificationBell.jsx
 * ================================================
 * Cloche notifications dans la Navbar.
 * - Badge rouge avec compteur non_lues
 * - Dropdown des 5 dernières notifications
 * - Bouton "Tout marquer lu"
 * - Lien "Voir toutes"
 * - Indicateur WS connecté (point vert)
 */

import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useNotificationContext } from "../../context/NotificationContext";
import { useAuth } from "../../context/AuthContext";

// ─── Icônes SVG inline (pas de dépendance externe) ────────────────────────

const BellIcon = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

const CheckAllIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

// ─── Couleurs par niveau de notification ──────────────────────────────────
const NIVEAU_STYLE = {
  INFO:     { dot: "#3b82f6", bg: "#eff6ff" },
  SUCCES:   { dot: "#22c55e", bg: "#f0fdf4" },
  ALERTE:   { dot: "#f59e0b", bg: "#fffbeb" },
  CRITIQUE: { dot: "#ef4444", bg: "#fef2f2" },
};

// ─── Formater la date relative ─────────────────────────────────────────────
function timeAgo(dateString) {
  const diff = Math.floor((Date.now() - new Date(dateString)) / 1000);
  if (diff < 60)   return "à l'instant";
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`;
  return `il y a ${Math.floor(diff / 86400)} j`;
}

// ===========================================================================

export default function NotificationBell() {
  const [open, setOpen]   = useState(false);
  const dropdownRef        = useRef(null);
  const navigate           = useNavigate();
  const { role }           = useAuth();

  const {
    notifications,
    stats,
    wsConnected,
    marquerLue,
    marquerToutesLues,
  } = useNotificationContext();

  // Fermer si clic extérieur
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const dernières = notifications.slice(0, 5);
  const nonLues   = stats.non_lues ?? 0;

  // Chemin "Voir toutes" selon le rôle
  const allNotifsPath = `/${role}/notifications`;

  const handleClickNotif = (notif) => {
    if (!notif.is_read) marquerLue(notif.id);
    setOpen(false);
  };

  return (
    <div style={{ position: "relative" }} ref={dropdownRef}>
      {/* ── Bouton cloche ── */}
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          position: "relative",
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: "8px",
          borderRadius: "8px",
          color: open ? "#2563eb" : "#6b7280",
          transition: "background 0.15s",
        }}
        title="Notifications"
      >
        <BellIcon />

        {/* Badge compteur */}
        {nonLues > 0 && (
          <span style={{
            position: "absolute",
            top: "4px",
            right: "4px",
            background: "#ef4444",
            color: "#fff",
            fontSize: "10px",
            fontWeight: 700,
            borderRadius: "10px",
            minWidth: "16px",
            height: "16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 4px",
            lineHeight: 1,
          }}>
            {nonLues > 99 ? "99+" : nonLues}
          </span>
        )}

        {/* Point WS vert / gris */}
        <span style={{
          position: "absolute",
          bottom: "6px",
          right: "6px",
          width: "7px",
          height: "7px",
          borderRadius: "50%",
          background: wsConnected ? "#22c55e" : "#d1d5db",
          border: "1.5px solid #fff",
        }} title={wsConnected ? "Temps réel actif" : "Polling"} />
      </button>

      {/* ── Dropdown ── */}
      {open && (
        <div style={{
          position: "absolute",
          right: 0,
          top: "calc(100% + 8px)",
          width: "360px",
          background: "#fff",
          borderRadius: "12px",
          boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
          border: "1px solid #e5e7eb",
          zIndex: 1000,
          overflow: "hidden",
        }}>
          {/* En-tête */}
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 16px",
            borderBottom: "1px solid #f3f4f6",
          }}>
            <span style={{ fontWeight: 600, fontSize: "14px", color: "#111827" }}>
              Notifications
              {nonLues > 0 && (
                <span style={{
                  marginLeft: "8px",
                  background: "#eff6ff",
                  color: "#2563eb",
                  fontSize: "11px",
                  fontWeight: 700,
                  borderRadius: "10px",
                  padding: "2px 7px",
                }}>
                  {nonLues} non lue{nonLues > 1 ? "s" : ""}
                </span>
              )}
            </span>
            {nonLues > 0 && (
              <button
                onClick={marquerToutesLues}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#6b7280",
                  fontSize: "12px",
                  padding: "4px 8px",
                  borderRadius: "6px",
                }}
              >
                <CheckAllIcon /> Tout lire
              </button>
            )}
          </div>

          {/* Liste */}
          <div style={{ maxHeight: "320px", overflowY: "auto" }}>
            {dernières.length === 0 ? (
              <div style={{
                padding: "32px 16px",
                textAlign: "center",
                color: "#9ca3af",
                fontSize: "13px",
              }}>
                Aucune notification
              </div>
            ) : (
              dernières.map((notif) => {
                const style = NIVEAU_STYLE[notif.niveau] || NIVEAU_STYLE.INFO;
                return (
                  <div
                    key={notif.id}
                    onClick={() => handleClickNotif(notif)}
                    style={{
                      display: "flex",
                      gap: "10px",
                      padding: "12px 16px",
                      cursor: "pointer",
                      background: notif.is_read ? "#fff" : style.bg,
                      borderBottom: "1px solid #f9fafb",
                      transition: "background 0.1s",
                    }}
                  >
                    {/* Point couleur niveau */}
                    <div style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      background: style.dot,
                      marginTop: "5px",
                      flexShrink: 0,
                    }} />

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: "13px",
                        fontWeight: notif.is_read ? 400 : 600,
                        color: "#111827",
                        marginBottom: "2px",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}>
                        {notif.titre}
                      </div>
                      <div style={{
                        fontSize: "12px",
                        color: "#6b7280",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}>
                        {notif.message}
                      </div>
                      <div style={{
                        fontSize: "11px",
                        color: "#9ca3af",
                        marginTop: "4px",
                      }}>
                        {timeAgo(notif.created_at)}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Pied */}
          <div style={{
            padding: "10px 16px",
            borderTop: "1px solid #f3f4f6",
            textAlign: "center",
          }}>
            <button
              onClick={() => { navigate(allNotifsPath); setOpen(false); }}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "#2563eb",
                fontSize: "13px",
                fontWeight: 500,
              }}
            >
              Voir toutes les notifications →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}