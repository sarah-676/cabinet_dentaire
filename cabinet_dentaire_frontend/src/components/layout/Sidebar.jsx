/**
 * components/layout/Sidebar.jsx
 * ================================
 * Navigation latérale selon le rôle de l'utilisateur.
 * - admin      → Tableau de bord, Utilisateurs, Mon compte
 * - dentiste   → Tableau de bord, Mes patients, Mon agenda, Mon compte
 * - receptionniste → Tableau de bord, Patients, Agenda, Mon compte
 *
 * Affiche les liens actifs, le nom et rôle de l'utilisateur.
 */

import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { ROLES } from "../../utils/roles";

// ─── Navigation par rôle ──────────────────────────────────────────────────
const NAV_CONFIG = {
  [ROLES.ADMIN]: [
    { path: "/admin/dashboard",    label: "Tableau de bord",   icon: "⊞" },
    { path: "/admin/utilisateurs", label: "Utilisateurs",      icon: "👥" },
    { path: "/admin/compte",       label: "Mon compte",        icon: "⚙" },
  ],
  [ROLES.DENTISTE]: [
    { path: "/dentiste/dashboard", label: "Tableau de bord",   icon: "⊞" },
    { path: "/dentiste/patients",  label: "Mes patients",      icon: "🦷" },
    { path: "/dentiste/agenda",    label: "Mon agenda",        icon: "📅" },
    { path: "/dentiste/compte",    label: "Mon compte",        icon: "⚙" },
  ],
  [ROLES.RECEPTIONNISTE]: [
    { path: "/receptionniste/dashboard", label: "Tableau de bord", icon: "⊞" },
    { path: "/receptionniste/patients",  label: "Patients",        icon: "🧑‍⚕️" },
    { path: "/receptionniste/agenda",    label: "Agenda",           icon: "📅" },
    { path: "/receptionniste/compte",    label: "Mon compte",      icon: "⚙" },
  ],
};

const ROLE_LABELS = {
  [ROLES.ADMIN]:          { label: "Administrateur", color: "#7c3aed" },
  [ROLES.DENTISTE]:       { label: "Dentiste",        color: "#0284c7" },
  [ROLES.RECEPTIONNISTE]: { label: "Réceptionniste",  color: "#059669" },
};

// ===========================================================================

export default function Sidebar() {
  const { user, role, logout } = useAuth();
  const navigate                = useNavigate();
  const navItems                = NAV_CONFIG[role] || [];
  const roleInfo                = ROLE_LABELS[role] || { label: role, color: "#6b7280" };

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <aside style={{
      width: "240px",
      minHeight: "100vh",
      background: "#1e293b",
      display: "flex",
      flexDirection: "column",
      flexShrink: 0,
    }}>
      {/* ── Logo ── */}
      <div style={{
        padding: "24px 20px 20px",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "22px" }}>🦷</span>
          <div>
            <div style={{ color: "#f8fafc", fontWeight: 700, fontSize: "15px" }}>
              Cabinet Dentaire
            </div>
            <div style={{ color: "#94a3b8", fontSize: "11px" }}>
              Gestion intégrée
            </div>
          </div>
        </div>
      </div>

      {/* ── Navigation ── */}
      <nav style={{ flex: 1, padding: "12px 0" }}>
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            style={({ isActive }) => ({
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "10px 20px",
              color: isActive ? "#f8fafc" : "#94a3b8",
              background: isActive ? "rgba(255,255,255,0.08)" : "transparent",
              textDecoration: "none",
              fontSize: "14px",
              fontWeight: isActive ? 600 : 400,
              borderLeft: isActive ? "3px solid #3b82f6" : "3px solid transparent",
              transition: "all 0.15s",
            })}
          >
            <span style={{ fontSize: "16px", width: "20px", textAlign: "center" }}>
              {item.icon}
            </span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* ── Profil utilisateur ── */}
      <div style={{
        padding: "16px 20px",
        borderTop: "1px solid rgba(255,255,255,0.08)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
          {/* Avatar initiales */}
          <div style={{
            width: "36px",
            height: "36px",
            borderRadius: "50%",
            background: roleInfo.color,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontWeight: 700,
            fontSize: "13px",
            flexShrink: 0,
          }}>
            {user?.first_name?.[0]?.toUpperCase() || "?"}
            {user?.last_name?.[0]?.toUpperCase() || ""}
          </div>

          <div style={{ minWidth: 0 }}>
            <div style={{
              color: "#f8fafc",
              fontSize: "13px",
              fontWeight: 600,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}>
              {user?.first_name} {user?.last_name}
            </div>
            <div style={{
              fontSize: "11px",
              fontWeight: 600,
              color: roleInfo.color,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}>
              {roleInfo.label}
            </div>
          </div>
        </div>

        {/* Bouton déconnexion */}
        <button
          onClick={handleLogout}
          style={{
            width: "100%",
            padding: "8px",
            background: "rgba(239,68,68,0.1)",
            color: "#f87171",
            border: "1px solid rgba(239,68,68,0.2)",
            borderRadius: "8px",
            cursor: "pointer",
            fontSize: "13px",
            fontWeight: 500,
            transition: "background 0.15s",
          }}
        >
          Déconnexion
        </button>
      </div>
    </aside>
  );
}