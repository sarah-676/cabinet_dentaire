import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { renderWithAppProviders } from "../test/renderWithProviders";
import { ROLES } from "../utils/roles";
import AppRoutes from "./AppRoutes";

vi.mock("../api/notificationsAPI", () => ({
  getNotifications: vi.fn(() => Promise.resolve({ results: [] })),
  getNotificationStats: vi.fn(() =>
    Promise.resolve({ total: 0, non_lues: 0, lues: 0, par_type: {} })
  ),
  marquerLue: vi.fn(() => Promise.resolve({})),
  marquerToutesLues: vi.fn(() => Promise.resolve({})),
  deleteNotification: vi.fn(() => Promise.resolve({})),
}));

vi.mock("../pages/dentiste/DashboardDentiste", () => ({
  default: () => <div data-testid="dentiste-dashboard-stub" />,
}));

const dentistAuth = {
  user: { id: "1", email: "d@test.fr", full_name: "Dr Test", role: ROLES.DENTISTE },
  loading: false,
  error: null,
  login: vi.fn(),
  logout: vi.fn(),
  isAuthenticated: true,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AppRoutes", () => {
  it("redirects unauthenticated users from protected paths to login", async () => {
    render(
      renderWithAppProviders(<AppRoutes />, {
        initialEntries: ["/dentiste/dashboard"],
        authValue: {
          user: null,
          loading: false,
          error: null,
          login: vi.fn(),
          logout: vi.fn(),
          isAuthenticated: false,
        },
      })
    );
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /se connecter/i })).toBeInTheDocument();
    });
  });

  it("redirects wrong role away from another role area", async () => {
    render(
      renderWithAppProviders(<AppRoutes />, {
        initialEntries: ["/admin/dashboard"],
        authValue: dentistAuth,
      })
    );
    await waitFor(() => {
      expect(screen.getByTestId("dentiste-dashboard-stub")).toBeInTheDocument();
    });
  });

  it("sends authenticated users from / to their home route", async () => {
    render(
      renderWithAppProviders(<AppRoutes />, {
        initialEntries: ["/"],
        authValue: dentistAuth,
      })
    );
    await waitFor(() => {
      expect(screen.getByTestId("dentiste-dashboard-stub")).toBeInTheDocument();
    });
  });

  it("sends guests from / to login", async () => {
    render(
      renderWithAppProviders(<AppRoutes />, {
        initialEntries: ["/"],
        authValue: {
          user: null,
          loading: false,
          error: null,
          login: vi.fn(),
          logout: vi.fn(),
          isAuthenticated: false,
        },
      })
    );
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /se connecter/i })).toBeInTheDocument();
    });
  });
});
