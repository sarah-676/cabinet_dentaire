/**
 * src/components/layout/Navbar.jsx
 * ──────────────────────────────────
 * Barre navigation + bouton cloche + panneau notifications.
 *
 * Connexion backend :
 *   GET /api/notifications/stats/  → badge (via NotificationContext)
 *   WS  ws://.../ws/notifications/ → incrémente badge temps réel
 */

import { useState } from "react";
import { useLocation } from "react-router-dom";
import { useNotifications } from "../../context/NotificationContext";
import NotificationPanel from "../notifications/NotificationPanel";

const PAGE_TITLES = {
  "/dentiste/dashboard":       "Tableau de bord",
  "/dentiste/patients":        "Mes patients",
  "/dentiste/agenda":          "Mon agenda",
  "/dentiste/compte":          "Mon compte",
  "/receptionniste/dashboard": "Tableau de bord",
  "/receptionniste/patients":  "Patients",
  "/receptionniste/agenda":    "Agenda",
  "/receptionniste/compte":    "Mon compte",
  "/admin/dashboard":          "Tableau de bord",
  "/admin/utilisateurs":       "Gestion des utilisateurs",
  "/admin/compte":             "Mon compte",
};

export default function Navbar() {
  const { pathname }            = useLocation();
  const { nonLues }             = useNotifications();
  const [showPanel, setShowPanel] = useState(false);

  const title = PAGE_TITLES[pathname]
    || (pathname.includes("/patients/") ? "Fiche patient" : "Cabinet Dentaire");

  return (
    <>
      <header style={styles.bar}>
        <h2 style={styles.title}>{title}</h2>

        <div style={styles.actions}>
          <button
            style={styles.bellBtn}
            onClick={() => setShowPanel(true)}
            title={`${nonLues} notification(s) non lue(s)`}
          >
            <BellIcon />
            {nonLues > 0 && (
              <span style={styles.badge}>{nonLues > 99 ? "99+" : nonLues}</span>
            )}
          </button>
        </div>
      </header>

      {showPanel && <NotificationPanel onClose={() => setShowPanel(false)} />}
    </>
  );
}

function BellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  );
}

const styles = {
  bar: {
    height: "60px", background: "#fff", borderBottom: "1px solid #e5e7eb",
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "0 2rem", flexShrink: 0, position: "sticky", top: 0, zIndex: 100,
  },
  title:   { fontSize: "1.1rem", fontWeight: 600, color: "#111827", margin: 0 },
  actions: { display: "flex", alignItems: "center", gap: "0.75rem" },
  bellBtn: {
    position: "relative", background: "none",
    border: "1.5px solid #e5e7eb", borderRadius: "8px",
    width: "40px", height: "40px",
    display: "flex", alignItems: "center", justifyContent: "center",
    cursor: "pointer", color: "#374151",
  },
  badge: {
    position: "absolute", top: "-6px", right: "-6px",
    background: "#dc2626", color: "#fff", borderRadius: "10px",
    padding: "1px 5px", fontSize: "10px", fontWeight: 700,
    minWidth: "16px", textAlign: "center", border: "2px solid #fff",
  },
};