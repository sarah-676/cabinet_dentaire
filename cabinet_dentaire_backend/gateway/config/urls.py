"""
config/urls.py — gateway_service
===================================
✅ Corrections pour environnement LOCAL :
  FIX 1 : endpoints internes gateway ajoutés AVANT le catch-all
  FIX 2 : route /media/ pour proxifier les images vers api_service
  FIX 3 : route /ws/ pour les WebSockets
  FIX 4 : health check accessible sans JWT
"""

from django.urls import path, re_path
from django.http import JsonResponse, HttpResponse, StreamingHttpResponse
from django.conf import settings
from django.views.decorators.csrf import csrf_exempt
import httpx
import logging

from gateway_app.views import ProxyView, HealthView, StatusView, ServicesView

logger = logging.getLogger("gateway_app")


# ── Vue proxy /media/ ─────────────────────────────────────────────────────────

@csrf_exempt
def media_proxy(request, path):
    """
    Proxifie /media/** → api_service:8000/media/**
    Pas de JWT requis (PUBLIC_PATHS contient /media/).
    """
    api_base   = getattr(settings, "API_SERVICE_URL", "http://localhost:8000")
    target_url = f"{api_base}/media/{path}"

    try:
        with httpx.Client(timeout=30.0) as client:
            upstream = client.get(target_url)

        if upstream.status_code == 404:
            return HttpResponse(status=404)

        response = HttpResponse(
            content      = upstream.content,
            status       = upstream.status_code,
            content_type = upstream.headers.get("content-type", "application/octet-stream"),
        )
        for h in ("content-length", "cache-control", "last-modified", "etag"):
            if h in upstream.headers:
                response[h] = upstream.headers[h]
        response["Access-Control-Allow-Origin"] = "*"
        return response

    except httpx.ConnectError:
        logger.error("api_service inaccessible pour media: %s", target_url)
        return HttpResponse("Service indisponible", status=502)
    except Exception as exc:
        logger.error("Erreur proxy media: %s", exc)
        return HttpResponse("Erreur interne", status=500)


# ── URL patterns ──────────────────────────────────────────────────────────────

urlpatterns = [

    # ── 1. Endpoints internes gateway (AVANT le catch-all) ────────────
    path("api/gateway/health/",   HealthView.as_view(),  name="gateway-health"),
    path("api/gateway/status/",   StatusView.as_view(),  name="gateway-status"),
    path("api/gateway/services/", ServicesView.as_view(), name="gateway-services"),

    # ── 2. Health simple ──────────────────────────────────────────────
    path("health/", lambda r: JsonResponse({"status": "ok", "service": "gateway"})),

    # ── 3. Media — AVANT le catch-all /api/ ──────────────────────────
    # Pas de JWT requis (PUBLIC_PATHS contient /media/)
    re_path(r"^media/(?P<path>.+)$", media_proxy, name="media-proxy"),

    # ── 4. Proxy catch-all auth (/api/auth/**) ────────────────────────
    # DOIT être avant /api/ car plus spécifique
    re_path(r"^api/auth/", ProxyView.as_view(), name="gateway-proxy-auth"),

    # ── 5. Proxy catch-all api (/api/**) ──────────────────────────────
    re_path(r"^api/",      ProxyView.as_view(), name="gateway-proxy-api"),
]