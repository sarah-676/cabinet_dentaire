/**
 * components/layout/Navbar.jsx
 * ==============================
 * Barre de navigation supérieure.
 * - Titre de la page courante (auto depuis le chemin)
 * - NotificationBell avec badge
 * - Avatar + nom utilisateur
 * - Lien rapide vers Mon compte
 */

import { useLocation, useNavigate } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import NotificationBell from "../notifications/NotificationBell";
import { ROLES } from "../../utils/roles";

// ─── Titres de page selon le chemin ───────────────────────────────────────
const PAGE_TITLES = {
  "/admin/dashboard":              "Tableau de bord",
  "/admin/utilisateurs":           "Gestion des utilisateurs",
  "/admin/compte":                 "Mon compte",
  "/dentiste/dashboard":           "Tableau de bord",
  "/dentiste/patients":            "Mes patients",
  "/dentiste/agenda":              "Mon agenda",
  "/dentiste/compte":              "Mon compte",
  "/receptionniste/dashboard":     "Tableau de bord",
  "/receptionniste/patients":      "Patients",
  "/receptionniste/agenda":        "Agenda",
  "/receptionniste/compte":        "Mon compte",
};

const COMPTE_PATH = {
  [ROLES.ADMIN]:          "/admin/compte",
  [ROLES.DENTISTE]:       "/dentiste/compte",
  [ROLES.RECEPTIONNISTE]: "/receptionniste/compte",
};

// ===========================================================================

export default function Navbar() {
  const { user, role, logout } = useAuth();
  const location                = useLocation();
  const navigate                = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef                 = useRef(null);

  const pageTitle = PAGE_TITLES[location.pathname] || "Cabinet Dentaire";

  // Fermer menu si clic extérieur
  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <header style={{
      height: "60px",
      background: "#fff",
      borderBottom: "1px solid #e5e7eb",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0 24px",
      position: "sticky",
      top: 0,
      zIndex: 100,
    }}>
      {/* ── Titre de la page ── */}
      <h2 style={{
        fontSize: "16px",
        fontWeight: 600,
        color: "#111827",
        margin: 0,
      }}>
        {pageTitle}
      </h2>

      {/* ── Actions droite ── */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        {/* Cloche notifications (CAS 1 + CAS 2) */}
        <NotificationBell />

        {/* ── Menu profil ── */}
        <div style={{ position: "relative" }} ref={menuRef}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              background: "none",
              border: "1px solid #e5e7eb",
              borderRadius: "20px",
              padding: "5px 12px 5px 6px",
              cursor: "pointer",
              transition: "background 0.15s",
            }}
          >
            {/* Avatar */}
            <div style={{
              width: "28px",
              height: "28px",
              borderRadius: "50%",
              background: "#2563eb",
              color: "#fff",
              fontSize: "11px",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}>
              {user?.first_name?.[0]?.toUpperCase() || "?"}
            </div>
            <span style={{ fontSize: "13px", fontWeight: 500, color: "#374151" }}>
              {user?.first_name || "Utilisateur"}
            </span>
            <span style={{ fontSize: "10px", color: "#9ca3af" }}>▾</span>
          </button>

          {/* Dropdown menu */}
          {menuOpen && (
            <div style={{
              position: "absolute",
              right: 0,
              top: "calc(100% + 8px)",
              width: "200px",
              background: "#fff",
              borderRadius: "10px",
              boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
              border: "1px solid #e5e7eb",
              overflow: "hidden",
              zIndex: 200,
            }}>
              {/* Info utilisateur */}
              <div style={{
                padding: "12px 14px",
                borderBottom: "1px solid #f3f4f6",
                background: "#f9fafb",
              }}>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "#111827" }}>
                  {user?.first_name} {user?.last_name}
                </div>
                <div style={{ fontSize: "11px", color: "#6b7280", marginTop: "2px" }}>
                  {user?.email}
                </div>
              </div>

              {/* Mon compte */}
              <button
                onClick={() => { navigate(COMPTE_PATH[role]); setMenuOpen(false); }}
                style={{
                  display: "block",
                  width: "100%",
                  padding: "10px 14px",
                  background: "none",
                  border: "none",
                  textAlign: "left",
                  cursor: "pointer",
                  fontSize: "13px",
                  color: "#374151",
                }}
              >
                ⚙ Mon compte
              </button>

              {/* Déconnexion */}
              <button
                onClick={handleLogout}
                style={{
                  display: "block",
                  width: "100%",
                  padding: "10px 14px",
                  background: "none",
                  border: "none",
                  borderTop: "1px solid #f3f4f6",
                  textAlign: "left",
                  cursor: "pointer",
                  fontSize: "13px",
                  color: "#dc2626",
                }}
              >
                ⟵ Déconnexion
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}