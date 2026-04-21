/**
 * App.jsx — MISE À JOUR PHASE 6
 * ================================
 * Ajoute :
 *   - <NotificationProvider> autour de tout le router
 *   - AppLayout comme wrapper des routes protégées
 *   - Route /notifications pour chaque rôle
 *
 * IMPORTANT : remplace votre App.jsx existant entièrement.
 */

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth }                  from "./context/AuthContext";
import { NotificationProvider }                   from "./context/NotificationContext";
import { ROLES }                                   from "./utils/roles";

// Layout
import AppLayout from "./components/layout/AppLayout";

// Auth
import LoginPage from "./pages/auth/LoginPage";

// Admin
import DashboardAdmin       from "./pages/admin/DashboardAdmin";
import GestionUtilisateurs  from "./pages/admin/GestionUtilisateurs";
import MonCompteAdmin        from "./pages/admin/MonComptePage";

// Dentiste
import DashboardDentiste    from "./pages/dentiste/DashboardDentiste";
import MesPatientsPage      from "./pages/dentiste/MesPatientsPage";
import PatientDetailPage    from "./pages/dentiste/PatientDetailPage";
import MonAgendaPage        from "./pages/dentiste/MonAgendaPage";
import MonCompteDentiste    from "./pages/dentiste/MonComptePage";

// Réceptionniste
import DashboardReceptionniste from "./pages/receptionniste/DashboardReceptionniste";
import PatientsPageRecep       from "./pages/receptionniste/PatientsPage";
import AgendaPageRecep         from "./pages/receptionniste/AgendaPage";
import MonCompteRecep          from "./pages/receptionniste/MonComptePage";

// Notifications (page dédiée — réutilise NotificationList)
import NotificationList from "./components/notifications/NotificationList";

// ─── Garde de route ───────────────────────────────────────────────────────
function ProtectedRoute({ children, roles }) {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f8fafc",
      }}>
        <div style={{ textAlign: "center", color: "#6b7280" }}>
          <div style={{ fontSize: "32px", marginBottom: "12px" }}>🦷</div>
          <div>Chargement…</div>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (roles && !roles.includes(role)) {
    // Mauvais rôle → rediriger vers son propre dashboard
    const redirects = {
      [ROLES.ADMIN]:          "/admin/dashboard",
      [ROLES.DENTISTE]:       "/dentiste/dashboard",
      [ROLES.RECEPTIONNISTE]: "/receptionniste/dashboard",
    };
    return <Navigate to={redirects[role] || "/login"} replace />;
  }

  return children;
}

// ─── Application ──────────────────────────────────────────────────────────
function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      {/* ── Publique ── */}
      <Route
        path="/login"
        element={user ? <Navigate to="/" replace /> : <LoginPage />}
      />

      {/* ── Admin ── */}
      <Route
        element={
          <ProtectedRoute roles={[ROLES.ADMIN]}>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/admin/dashboard"     element={<DashboardAdmin />} />
        <Route path="/admin/utilisateurs"  element={<GestionUtilisateurs />} />
        <Route path="/admin/compte"        element={<MonCompteAdmin />} />
        <Route path="/admin/notifications" element={<NotificationList />} />
      </Route>

      {/* ── Dentiste ── */}
      <Route
        element={
          <ProtectedRoute roles={[ROLES.DENTISTE]}>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dentiste/dashboard"           element={<DashboardDentiste />} />
        <Route path="/dentiste/patients"            element={<MesPatientsPage />} />
        <Route path="/dentiste/patients/:id"        element={<PatientDetailPage />} />
        <Route path="/dentiste/agenda"              element={<MonAgendaPage />} />
        <Route path="/dentiste/compte"              element={<MonCompteDentiste />} />
        <Route path="/dentiste/notifications"       element={<NotificationList />} />
      </Route>

      {/* ── Réceptionniste ── */}
      <Route
        element={
          <ProtectedRoute roles={[ROLES.RECEPTIONNISTE]}>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/receptionniste/dashboard"      element={<DashboardReceptionniste />} />
        <Route path="/receptionniste/patients"       element={<PatientsPageRecep />} />
        <Route path="/receptionniste/agenda"         element={<AgendaPageRecep />} />
        <Route path="/receptionniste/compte"         element={<MonCompteRecep />} />
        <Route path="/receptionniste/notifications"  element={<NotificationList />} />
      </Route>

      {/* ── Redirections ── */}
      <Route path="/"        element={<Navigate to="/login" replace />} />
      <Route path="*"        element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        {/* NotificationProvider DOIT être dans AuthProvider (utilise useAuth) */}
        <NotificationProvider>
          <AppRoutes />
        </NotificationProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}