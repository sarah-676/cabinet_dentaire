/**
 * components/layout/AppLayout.jsx
 * ==================================
 * Wrapper principal de toute l'application connectée.
 * Structure : Sidebar gauche + colonne droite (Navbar + contenu)
 *
 * Utilisé dans App.jsx pour toutes les routes protégées :
 *   <Route element={<AppLayout />}>
 *     <Route path="/dentiste/dashboard" element={<DashboardDentiste />} />
 *     ...
 *   </Route>
 */

import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Navbar from "./Navbar";

export default function AppLayout() {
  return (
    <div style={{
      display: "flex",
      minHeight: "100vh",
      background: "#f8fafc",
    }}>
      {/* ── Navigation latérale ── */}
      <Sidebar />

      {/* ── Zone principale ── */}
      <div style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        minWidth: 0, // important pour que flex ne déborde pas
        overflow: "hidden",
      }}>
        {/* Barre supérieure */}
        <Navbar />

        {/* Contenu de la page courante */}
        <main style={{
          flex: 1,
          overflow: "auto",
          padding: "0",
        }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}