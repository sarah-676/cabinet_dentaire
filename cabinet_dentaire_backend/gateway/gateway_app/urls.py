"""
gateway_app/urls.py — API Gateway

✅ FIX : ajout du pattern /media/ AVANT le catch-all /api/
         → proxifie les fichiers media vers api_service:8000
         → résout le 404 sur http://localhost:8080/media/radios/...
"""

from django.urls import path, re_path
from django.conf import settings
from django.http import StreamingHttpResponse, HttpResponse
from django.views.decorators.csrf import csrf_exempt
import httpx
import logging

from .views import ProxyView, HealthView, StatusView, ServicesView

logger = logging.getLogger("gateway_app")


# ── Vue proxy media ───────────────────────────────────────────────────────────

@csrf_exempt
def media_proxy(request, path):
    """
    Proxifie les fichiers /media/** vers api_service (port 8000).

    ✅ Pas de JWT requis — les fichiers media sont publics (images radios).
    ✅ Streaming — ne charge pas le fichier entier en mémoire.
    ✅ Préserve le Content-Type (image/png, image/jpeg, etc.).

    Exemple :
      GET /media/radios/uuid/2026/04/image.png (gateway :8080)
      →   GET http://localhost:8000/media/radios/uuid/2026/04/image.png
    """
    api_base = getattr(settings, "API_SERVICE_URL", "http://localhost:8000")
    target_url = f"{api_base}/media/{path}"

    try:
        with httpx.Client(timeout=30.0) as client:
            upstream = client.get(target_url)

        if upstream.status_code == 404:
            logger.warning("Media introuvable upstream : %s", target_url)
            return HttpResponse(status=404)

        content_type = upstream.headers.get("content-type", "application/octet-stream")

        response = HttpResponse(
            content      = upstream.content,
            status       = upstream.status_code,
            content_type = content_type,
        )

        # Préserve les headers utiles
        for header in ("content-length", "cache-control", "last-modified", "etag"):
            if header in upstream.headers:
                response[header] = upstream.headers[header]

        # CORS pour le frontend
        response["Access-Control-Allow-Origin"] = "*"

        logger.debug("Media proxifié : %s → %d", target_url, upstream.status_code)
        return response

    except httpx.ConnectError:
        logger.error("api_service inaccessible pour media : %s", target_url)
        return HttpResponse("Service indisponible", status=502)
    except httpx.TimeoutException:
        logger.error("Timeout media : %s", target_url)
        return HttpResponse("Timeout", status=504)
    except Exception as exc:
        logger.error("Erreur proxy media : %s", exc)
        return HttpResponse("Erreur interne", status=500)


# ── URL patterns ──────────────────────────────────────────────────────────────

urlpatterns = [
    # ── Endpoints internes du gateway ─────────────────────────────
    path("api/gateway/health/",   HealthView.as_view(),   name="gateway-health"),
    path("api/gateway/status/",   StatusView.as_view(),   name="gateway-status"),
    path("api/gateway/services/", ServicesView.as_view(), name="gateway-services"),

    # ── ✅ AJOUT : proxy media — AVANT le catch-all /api/ ─────────
    # Sans ce pattern, /media/... ne correspond à aucune règle → 404
    # DOIT être placé avant re_path(r"^api/") car celui-ci ne capture pas /media/
    # mais on le met explicitement ici pour la clarté et l'ordre.
    re_path(r"^media/(?P<path>.+)$", media_proxy, name="media-proxy"),

    # ── Proxy catch-all — DOIT être en DERNIER ────────────────────
    re_path(r"^api/", ProxyView.as_view(), name="gateway-proxy"),
]