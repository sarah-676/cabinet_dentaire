/**
 * src/App.jsx — VERSION COMPLÈTE (Parties 1-4)
 * ──────────────────────────────────────────────
 * Routes protégées par rôle.
 * Toutes les pages des 4 parties sont incluses.
 */

import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { ROLES } from "./utils/roles";

// Auth
import LoginPage from "./pages/auth/LoginPage";

// Layout
import AppLayout from "./components/layout/AppLayout";

// ── Dentiste ──────────────────────────────────────────────────────
import DashboardDentiste  from "./pages/dentiste/DashboardDentiste";
import MesPatientsPage    from "./pages/dentiste/MesPatientsPage";
import PatientDetailPage  from "./pages/dentiste/PatientDetailPage";
import MonAgendaPage      from "./pages/dentiste/MonAgendaPage";
import RadiosPage         from "./pages/dentiste/RadiosPage";
import TraitementsPage    from "./pages/dentiste/TraitementsPage";
import OrdonnancesPage    from "./pages/dentiste/OrdonnancesPage";
import MonCompteDentiste  from "./pages/dentiste/MonComptePage";

// ── Réceptionniste ────────────────────────────────────────────────
import DashboardReceptionniste from "./pages/receptionniste/DashboardReceptionniste";
import PatientsReceptionniste  from "./pages/receptionniste/PatientsPage";
import AgendaReceptionniste    from "./pages/receptionniste/AgendaPage";
import MonCompteReceptionniste from "./pages/receptionniste/MonComptePage";

// ── Admin ─────────────────────────────────────────────────────────
import DashboardAdmin      from "./pages/admin/DashboardAdmin";
import GestionUtilisateurs from "./pages/admin/GestionUtilisateurs";
import MonCompteAdmin      from "./pages/admin/MonComptePage";


// ── Guards ────────────────────────────────────────────────────────

function ProtectedRoute() {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
}

function RoleRoute({ allowed }) {
  const { user } = useAuth();
  return allowed.includes(user?.role) ? <Outlet /> : <Navigate to="/login" replace />;
}

function RootRedirect() {
  const { user, isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  switch (user?.role) {
    case ROLES.DENTISTE:       return <Navigate to="/dentiste/dashboard"       replace />;
    case ROLES.RECEPTIONNISTE: return <Navigate to="/receptionniste/dashboard" replace />;
    case ROLES.ADMIN:          return <Navigate to="/admin/dashboard"          replace />;
    default:                   return <Navigate to="/login"                    replace />;
  }
}


// ── App ───────────────────────────────────────────────────────────

export default function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* Public */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/"      element={<RootRedirect />} />

        {/* Protégé */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>

            {/* ── Dentiste ── */}
            <Route element={<RoleRoute allowed={[ROLES.DENTISTE]} />}>
              <Route path="/dentiste/dashboard"    element={<DashboardDentiste />} />
              <Route path="/dentiste/patients"     element={<MesPatientsPage />} />
              <Route path="/dentiste/patients/:id" element={<PatientDetailPage />} />
              <Route path="/dentiste/agenda"       element={<MonAgendaPage />} />
              <Route path="/dentiste/radios"       element={<RadiosPage />} />
              <Route path="/dentiste/traitements"  element={<TraitementsPage />} />
              <Route path="/dentiste/ordonnances"  element={<OrdonnancesPage />} />
              <Route path="/dentiste/compte"       element={<MonCompteDentiste />} />
            </Route>

            {/* ── Réceptionniste ── */}
            <Route element={<RoleRoute allowed={[ROLES.RECEPTIONNISTE]} />}>
              <Route path="/receptionniste/dashboard" element={<DashboardReceptionniste />} />
              <Route path="/receptionniste/patients"  element={<PatientsReceptionniste />} />
              <Route path="/receptionniste/agenda"    element={<AgendaReceptionniste />} />
              <Route path="/receptionniste/compte"    element={<MonCompteReceptionniste />} />
            </Route>

            {/* ── Admin ── */}
            <Route element={<RoleRoute allowed={[ROLES.ADMIN]} />}>
              <Route path="/admin/dashboard"      element={<DashboardAdmin />} />
              <Route path="/admin/utilisateurs"   element={<GestionUtilisateurs />} />
              <Route path="/admin/compte"         element={<MonCompteAdmin />} />
            </Route>

          </Route>
        </Route>

        {/* 404 */}
        <Route path="*" element={<Navigate to="/" replace />} />

      </Routes>
    </BrowserRouter>
  );
}