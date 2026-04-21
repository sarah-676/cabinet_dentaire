/**
 * src/components/layout/Sidebar.jsx
 * ────────────────────────────────────
 * Navigation latérale avec tous les liens par rôle.
 */

import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { ROLES } from "../../utils/roles";

const NAV = {
  [ROLES.DENTISTE]: [
    { to: "/dentiste/dashboard",   label: "Tableau de bord", icon: "⊞" },
    { to: "/dentiste/patients",    label: "Mes patients",    icon: "◉" },
    { to: "/dentiste/agenda",      label: "Mon agenda",      icon: "◷" },
    { to: "/dentiste/radios",      label: "Radiographies",   icon: "🩻" },
    { to: "/dentiste/traitements", label: "Traitements",     icon: "💉" },
    { to: "/dentiste/ordonnances", label: "Ordonnances",     icon: "📋" },
    { to: "/dentiste/compte",      label: "Mon compte",      icon: "◎" },
  ],
  [ROLES.RECEPTIONNISTE]: [
    { to: "/receptionniste/dashboard", label: "Tableau de bord", icon: "⊞" },
    { to: "/receptionniste/patients",  label: "Patients",        icon: "◉" },
    { to: "/receptionniste/agenda",    label: "Agenda",          icon: "◷" },
    { to: "/receptionniste/compte",    label: "Mon compte",      icon: "◎" },
  ],
  [ROLES.ADMIN]: [
    { to: "/admin/dashboard",    label: "Tableau de bord",  icon: "⊞" },
    { to: "/admin/utilisateurs", label: "Utilisateurs",     icon: "◉" },
    { to: "/admin/compte",       label: "Mon compte",       icon: "◎" },
  ],
};

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate         = useNavigate();
  const links            = NAV[user?.role] || [];
  const initial          = (user?.full_name || user?.email || "U")[0].toUpperCase();

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <aside style={styles.sidebar}>

      {/* Logo */}
      <div style={styles.brand}>
        <div style={styles.brandIcon}>+</div>
        <span style={styles.brandText}>CabinetDent</span>
      </div>

      {/* User */}
      <div style={styles.userBlock}>
        <div style={styles.avatar}>{initial}</div>
        <div style={{ minWidth: 0 }}>
          <div style={styles.userName}>
            {user?.full_name || user?.email?.split("@")[0]}
          </div>
          <div style={styles.userRole}>{user?.role}</div>
        </div>
      </div>

      {/* Nav */}
      <nav style={styles.nav}>
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            style={({ isActive }) => ({
              ...styles.navLink,
              ...(isActive ? styles.navLinkActive : {}),
            })}
          >
            <span style={styles.navIcon}>{link.icon}</span>
            {link.label}
          </NavLink>
        ))}
      </nav>

      {/* Déconnexion */}
      <button onClick={handleLogout} style={styles.logoutBtn}>
        ⇤ Déconnexion
      </button>
    </aside>
  );
}

const styles = {
  sidebar: {
    width: "230px", minHeight: "100vh",
    background: "#0f4c81", color: "#fff",
    display: "flex", flexDirection: "column",
    flexShrink: 0,
  },
  brand: {
    display: "flex", alignItems: "center", gap: "0.5rem",
    padding: "1.25rem 1.25rem 1rem",
    borderBottom: "1px solid rgba(255,255,255,0.1)",
  },
  brandIcon: {
    width: "30px", height: "30px",
    background: "rgba(255,255,255,0.2)",
    borderRadius: "8px",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: "1.1rem", fontWeight: 700, flexShrink: 0,
  },
  brandText: { fontWeight: 700, fontSize: "0.95rem", letterSpacing: "0.02em" },
  userBlock: {
    display: "flex", alignItems: "center", gap: "0.75rem",
    padding: "1rem 1.25rem",
    borderBottom: "1px solid rgba(255,255,255,0.1)",
  },
  avatar: {
    width: "34px", height: "34px",
    background: "rgba(255,255,255,0.25)",
    borderRadius: "50%",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontWeight: 700, fontSize: "0.9rem", flexShrink: 0,
  },
  userName: { fontSize: "0.82rem", fontWeight: 600, marginBottom: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  userRole: { fontSize: "0.72rem", opacity: 0.7, textTransform: "capitalize" },
  nav: { flex: 1, padding: "0.75rem 0", display: "flex", flexDirection: "column" },
  navLink: {
    display: "flex", alignItems: "center", gap: "0.6rem",
    padding: "0.6rem 1.25rem",
    color: "rgba(255,255,255,0.72)",
    textDecoration: "none", fontSize: "0.875rem",
    transition: "background 0.12s, color 0.12s",
  },
  navLinkActive: {
    background: "rgba(255,255,255,0.16)",
    color: "#fff",
    borderRight: "3px solid #fff",
  },
  navIcon: { fontSize: "0.9rem", opacity: 0.85, width: "18px", textAlign: "center" },
  logoutBtn: {
    margin: "0.5rem 1rem 1.25rem",
    padding: "0.6rem 1rem",
    background: "rgba(255,255,255,0.07)",
    color: "rgba(255,255,255,0.75)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: "8px",
    cursor: "pointer", fontSize: "0.85rem", textAlign: "left",
  },
};