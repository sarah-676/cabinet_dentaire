import { MemoryRouter } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import { NotificationProvider } from "../context/NotificationContext";
import { ToastProvider } from "../context/ToastContext";

const noopAuth = {
  user: null,
  loading: false,
  error: null,
  login: async () => "/login",
  logout: async () => {},
  isAuthenticated: false,
};

/**
 * Renders UI with router + the same provider stack as production (minus StrictMode).
 */
export function renderWithAppProviders(
  ui,
  {
    initialEntries = ["/"],
    authValue = noopAuth,
  } = {}
) {
  return (
    <MemoryRouter initialEntries={initialEntries}>
      <AuthContext.Provider value={authValue}>
        <ToastProvider>
          <NotificationProvider>{ui}</NotificationProvider>
        </ToastProvider>
      </AuthContext.Provider>
    </MemoryRouter>
  );
}
