/**
 * Application route tree (used inside BrowserRouter / MemoryRouter).
 */
import { Routes, Route, Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ROLES, getHomeRoute } from "../utils/roles";

import LoginPage from "../pages/auth/LoginPage";
import AppLayout from "../components/layout/AppLayout";

import DashboardDentiste from "../pages/dentiste/DashboardDentiste";
import MesPatientsPage from "../pages/dentiste/MesPatientsPage";
import PatientDetailPage from "../pages/dentiste/PatientDetailPage";
import MonAgendaPage from "../pages/dentiste/MonAgendaPage";
import MonCompteDentiste from "../pages/dentiste/MonComptePage";
import RadiosPage from "../pages/dentiste/RadiosPage";
import TraitementsPage from "../pages/dentiste/TraitementsPage";
import OrdonnancesPage from "../pages/dentiste/OrdonnancesPage";

import DashboardReceptionniste from "../pages/receptionniste/DashboardReceptionniste";
import PatientsReceptionniste from "../pages/receptionniste/PatientsPage";
import AgendaReceptionniste from "../pages/receptionniste/AgendaPage";
import MonCompteReceptionniste from "../pages/receptionniste/MonComptePage";

import DashboardAdmin from "../pages/admin/DashboardAdmin";
import GestionUtilisateurs from "../pages/admin/GestionUtilisateurs";
import MonCompteAdmin from "../pages/admin/MonComptePage";

export function ProtectedRoute() {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
}

export function RoleRoute({ allowed }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!allowed.includes(user.role)) {
    return <Navigate to={getHomeRoute(user.role)} replace />;
  }
  return <Outlet />;
}

export function RootRedirect() {
  const { user, isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Navigate to={getHomeRoute(user?.role)} replace />;
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<RootRedirect />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route element={<RoleRoute allowed={[ROLES.DENTISTE]} />}>
            <Route path="/dentiste/dashboard" element={<DashboardDentiste />} />
            <Route path="/dentiste/patients" element={<MesPatientsPage />} />
            <Route path="/dentiste/patients/:id" element={<PatientDetailPage />} />
            <Route path="/dentiste/agenda" element={<MonAgendaPage />} />
            <Route path="/dentiste/radios" element={<RadiosPage />} />
            <Route path="/dentiste/traitements" element={<TraitementsPage />} />
            <Route path="/dentiste/ordonnances" element={<OrdonnancesPage />} />
            <Route path="/dentiste/compte" element={<MonCompteDentiste />} />
          </Route>

          <Route element={<RoleRoute allowed={[ROLES.RECEPTIONNISTE]} />}>
            <Route path="/receptionniste/dashboard" element={<DashboardReceptionniste />} />
            <Route path="/receptionniste/patients" element={<PatientsReceptionniste />} />
            <Route path="/receptionniste/agenda" element={<AgendaReceptionniste />} />
            <Route path="/receptionniste/compte" element={<MonCompteReceptionniste />} />
          </Route>

          <Route element={<RoleRoute allowed={[ROLES.ADMIN]} />}>
            <Route path="/admin/dashboard" element={<DashboardAdmin />} />
            <Route path="/admin/utilisateurs" element={<GestionUtilisateurs />} />
            <Route path="/admin/compte" element={<MonCompteAdmin />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
