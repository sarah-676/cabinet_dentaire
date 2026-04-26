/**
 * src/components/layout/Navbar.jsx
 * ✅ Logique 100% conservée (useNotificationContext, stats, showPanel, PAGE_TITLES)
 * 🎨 UI redesignée — style Lovable / DentalCare Pro
 */

import { useState, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { useNotificationContext } from "../../context/NotificationContext";
import NotificationPanel from "../notifications/NotificationPanel";
import { PAGE_TITLES } from "./layoutConfig";
import { useAuth } from "../../context/AuthContext";

export default function Navbar() {
  const { pathname }              = useLocation();
  const { stats }                 = useNotificationContext();
  const { user }                  = useAuth();
  const [showPanel, setShowPanel] = useState(false);
  const closePanel                = useCallback(() => setShowPanel(false), []);

  const title = PAGE_TITLES[pathname]
    || (pathname.includes("/patients/") ? "Fiche patient" : "Cabinet Dentaire");

  const unread    = stats?.non_lues || 0;
  const initial   = (user?.full_name || user?.email || "U")[0].toUpperCase();
  const shortName = user?.full_name || user?.email?.split("@")[0] || "";
  const roleLabel = user?.role
    ? user.role.charAt(0).toUpperCase() + user.role.slice(1)
    : "";

  return (
    <>
      <header className="h-[64px] bg-white border-b border-gray-100 flex items-center justify-between px-6 lg:px-8 flex-shrink-0 sticky top-0 z-50 shadow-sm">

        {/* ── Gauche : icône sidebar + titre page ─────────────── */}
        <div className="flex items-center gap-3">
          {/* Icône layout (décoratif, comme Lovable) */}
          <div className="w-7 h-7 rounded-md border border-gray-200 flex items-center justify-center text-gray-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
          </div>
          <h2 className="text-base font-semibold text-gray-800">{title}</h2>
        </div>

        {/* ── Droite : cloche + avatar ─────────────────────────── */}
        <div className="flex items-center gap-3">

          {/* Cloche notifications */}
          <button
            type="button"
            onClick={() => setShowPanel(true)}
            title={`${unread} notification(s) non lue(s)`}
            className="relative w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors"
          >
            <BellIcon />
            {unread > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 border-2 border-white">
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </button>

          {/* Séparateur */}
          <div className="w-px h-6 bg-gray-200" />

          {/* Avatar + nom */}
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
              style={{ background: "linear-gradient(135deg, #1aa3c8, #0e8faf)" }}
            >
              {initial}
            </div>
            <div className="hidden sm:block text-right">
              <p className="text-sm font-semibold text-gray-800 leading-none">{shortName}</p>
              <p className="text-xs text-gray-400 mt-0.5">{roleLabel}</p>
            </div>
          </div>

        </div>
      </header>

      {showPanel && <NotificationPanel onClose={closePanel} />}
    </>
  );
}

function BellIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}