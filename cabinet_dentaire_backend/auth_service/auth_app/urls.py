"""
auth_app/urls.py — version finale
Ajout : InternalUserView pour api_service.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from auth_app.views import (
    LoginView,
    LogoutView,
    VerifyTokenView,
    ProfileView,
    ChangePasswordView,
    UserViewSet,
    InternalUserView,
    HealthView,
)

router = DefaultRouter()
router.register(r"users", UserViewSet, basename="users")

urlpatterns = [
    # ── JWT ───────────────────────────────────────────────────────────
    path("login/",         LoginView.as_view(),       name="auth-login"),
    path("logout/",        LogoutView.as_view(),       name="auth-logout"),
    path("token/refresh/", TokenRefreshView.as_view(), name="auth-token-refresh"),
    path("verify/",        VerifyTokenView.as_view(),  name="auth-verify"),

    # ── Profil personnel ──────────────────────────────────────────────
    path("profile/",                 ProfileView.as_view(),        name="auth-profile"),
    path("profile/change-password/", ChangePasswordView.as_view(), name="auth-change-password"),

    # ── CRUD utilisateurs (router) ────────────────────────────────────
    path("", include(router.urls)),

    # ── Endpoint interne pour api_service ─────────────────────────────
    # Utilisé par common/services.py → verifier_dentiste_actif()
    # Sécurisé par Bearer token
    path(
        "internal/users/<uuid:user_id>/",
        InternalUserView.as_view(),
        name="auth-internal-user",
    ),

    # ── Health check ──────────────────────────────────────────────────
    path("health/", HealthView.as_view(), name="auth-health"),
]

"""
Toutes les routes disponibles :

  POST   /api/auth/login/                        → access + refresh + user
  POST   /api/auth/logout/                       → blacklist refresh
  POST   /api/auth/token/refresh/                → renouveler access
  GET    /api/auth/verify/                       → vérifier token [api_service]

  GET    /api/auth/profile/                      → mon profil
  PATCH  /api/auth/profile/                      → modifier mon profil
  POST   /api/auth/profile/change-password/      → changer mot de passe

  GET    /api/auth/users/                        → liste users [Admin]
  POST   /api/auth/users/                        → créer user [Admin]
  GET    /api/auth/users/{id}/                   → détail [Admin]
  PATCH  /api/auth/users/{id}/                   → modifier [Admin]
  DELETE /api/auth/users/{id}/                   → désactiver [Admin]
  PATCH  /api/auth/users/{id}/toggle-actif/      → activer/désactiver [Admin]
  GET    /api/auth/users/dentistes/              → liste dentistes [Auth]
  GET    /api/auth/users/receptionnistes/        → liste réceptionnistes [Auth]
  GET    /api/auth/users/stats/                  → stats [Admin]

  GET    /api/auth/internal/users/{id}/          → vérif user [api_service]

  GET    /api/auth/health/                       → health check
"""
