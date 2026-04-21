"""
gateway_app/urls.py — API Gateway
=====================================
Routes du gateway :

  /api/gateway/health/    → HealthView   (Traefik + Consul health check)
  /api/gateway/status/    → StatusView   (état détaillé)
  /api/gateway/services/  → ServicesView (services Consul)
  /api/**                 → ProxyView    (proxy vers auth_service ou api_service)
"""

from django.urls import path, re_path
from .views import ProxyView, HealthView, StatusView, ServicesView

urlpatterns = [
    # ── Endpoints internes du gateway ─────────────────────────────────
    path("api/gateway/health/",   HealthView.as_view(),   name="gateway-health"),
    path("api/gateway/status/",   StatusView.as_view(),   name="gateway-status"),
    path("api/gateway/services/", ServicesView.as_view(), name="gateway-services"),

    # ── Proxy catch-all — DOIT être en DERNIER ────────────────────────
    # Capture toutes les requêtes /api/** et les route vers les services
    re_path(r"^api/", ProxyView.as_view(), name="gateway-proxy"),
]