/**
 * src/components/layout/Sidebar.jsx
 * ✅ Logique 100% conservée (useAuth, logout, navigate, NAV, user)
 *
 * CORRECTION :
 *   ❌ AVANT : aside = min-h-screen → la sidebar grandissait avec le contenu
 *              nav flex-1 sans overflow → les liens pouvaient dépasser
 *              le bloc déconnexion descendait hors écran sur petits écrans
 *
 *   ✅ APRÈS : aside = h-screen sticky top-0 → hauteur fixe, toujours visible
 *              nav = flex-1 + overflow-y-auto → scroll interne si trop de liens
 *              footer = flex-shrink-0 → bouton déconnexion TOUJOURS ancré en bas
 */

import { useCallback } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { NAV } from "./layoutConfig";

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate         = useNavigate();
  const links            = NAV[user?.role] || [];
  const initial          = (user?.full_name || user?.email || "U")[0].toUpperCase();

  const handleLogout = useCallback(async () => {
    await logout();
    navigate("/login", { replace: true });
  }, [logout, navigate]);

  return (
    /*
     * ✅ FIX CLÉ 1 : h-screen + sticky top-0
     *    La sidebar occupe exactement la hauteur de l'écran
     *    et reste fixée au scroll de la page.
     *    flex flex-col permet de distribuer l'espace entre les 3 zones.
     */
    <aside
      className="w-[260px] h-screen sticky top-0 flex flex-col flex-shrink-0 text-white z-30"
      style={{ background: "linear-gradient(180deg, #1aa3c8 0%, #0e8faf 100%)" }}
    >

      {/* ── 1. Logo / Brand — flex-shrink-0 ─────────────────────
           Ne rétrécit jamais, toujours visible en haut            */}
      <div className="flex-shrink-0 flex items-center gap-3 px-5 py-5 border-b border-white/15">
        <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center flex-shrink-0">
          <ToothIcon className="w-5 h-5 text-white" />
        </div>
        <div>
          <span className="font-bold text-base tracking-wide leading-none">DentalCare</span>
          <p className="text-white/60 text-xs mt-0.5">Pro</p>
        </div>
      </div>

      {/* ── 2. Label section — flex-shrink-0 ────────────────────── */}
      <div className="flex-shrink-0 px-5 pt-5 pb-2">
        <span className="text-white/50 text-[10px] font-semibold uppercase tracking-widest">
          Menu Principal
        </span>
      </div>

      {/* ── 3. Navigation — flex-1 + overflow-y-auto ────────────
           Prend tout l'espace disponible entre le label et le footer.
           Si les liens dépassent → scroll interne, footer ne bouge pas. */}
      <nav
        className="flex-1 overflow-y-auto flex flex-col gap-0.5 px-3 pb-2"
        style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.2) transparent" }}
      >
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                isActive
                  ? "bg-white text-[#0e8faf] shadow-sm"
                  : "text-white/80 hover:bg-white/15 hover:text-white"
              }`
            }
          >
            <NavIcon name={link.label} />
            {link.label}
          </NavLink>
        ))}
      </nav>

      {/* ── 4. Footer user + déconnexion — flex-shrink-0 ─────────
           ✅ FIX CLÉ 2 : flex-shrink-0 empêche ce bloc de rétrécir.
           Peu importe le nombre de liens dans la nav, ce bloc reste
           TOUJOURS ancré en bas de la sidebar, visible à l'écran.   */}
      <div className="flex-shrink-0 border-t border-white/15 px-4 py-4">
        {/* User info */}
        <div className="flex items-center gap-3 mb-3 px-1">
          <div className="w-8 h-8 rounded-full bg-white/25 flex items-center justify-center font-bold text-sm flex-shrink-0">
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold truncate leading-none">
              {user?.full_name || user?.email?.split("@")[0]}
            </p>
            <p className="text-white/60 text-xs capitalize mt-0.5">{user?.role}</p>
          </div>
        </div>

        {/* Bouton déconnexion — toujours visible */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm
                     text-white/70 hover:bg-white/15 hover:text-white
                     transition-all duration-150"
        >
          <LogoutIcon className="w-4 h-4" />
          Déconnexion
        </button>
      </div>
    </aside>
  );
}

/* ── Icône contextuelle par label ─────────────────────────────────────────── */
function NavIcon({ name }) {
  const icons = {
    "Tableau de bord": (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
      </svg>
    ),
    "Mes patients": (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
      </svg>
    ),
    "Patients": (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
      </svg>
    ),
    "Mon agenda": (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
    ),
    "Agenda": (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
    ),
    "Radiographies": (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
        <polyline points="21 15 16 10 5 21"/>
      </svg>
    ),
    "Traitements": (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18"/>
      </svg>
    ),
    "Ordonnances": (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
        <polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
      </svg>
    ),
    "Utilisateurs": (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
      </svg>
    ),
    "Mon compte": (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
      </svg>
    ),
  };
  return icons[name] || (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <circle cx="12" cy="12" r="4"/>
    </svg>
  );
}

function ToothIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2C9.5 2 8 3.5 7 5c-1 1.5-1.5 3-1 5 .5 2 1 3.5 1 5.5 0 1.5.5 3.5 1.5 4.5.5.5 1 .5 1.5 0 .5-.5.5-1.5.5-2.5 0-1 .5-2.5 1.5-2.5s1.5 1.5 1.5 2.5c0 1 0 2 .5 2.5.5.5 1 .5 1.5 0 1-1 1.5-3 1.5-4.5 0-2 .5-3.5 1-5.5.5-2 0-3.5-1-5C16 3.5 14.5 2 12 2z"/>
    </svg>
  );
}

function LogoutIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2h5a2 2 0 012 2v1"/>
    </svg>
  );
}