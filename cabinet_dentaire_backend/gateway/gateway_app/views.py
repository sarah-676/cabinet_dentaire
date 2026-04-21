"""
gateway_app/views.py — API Gateway
=====================================
Vues principales du gateway :

  ProxyView     → route toutes les requêtes /api/** vers le bon service
  HealthView    → GET /api/gateway/health/ (vérifié par Traefik + Consul)
  StatusView    → GET /api/gateway/status/ (état détaillé du gateway)
  ServicesView  → GET /api/gateway/services/ (liste des services enregistrés)
"""

import logging
import time
from datetime import datetime, timezone

import httpx
from django.conf import settings
from django.http import JsonResponse
from django.views import View
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator

from .proxy import forward_request, resolve_route

logger = logging.getLogger("gateway_app")

# Heure de démarrage (pour le uptime)
_START_TIME = time.monotonic()
_START_DATETIME = datetime.now(tz=timezone.utc).isoformat()


# ── Vue principale : Proxy ────────────────────────────────────────────────────

@method_decorator(csrf_exempt, name="dispatch")
class ProxyView(View):
    """
    Vue universelle — reçoit TOUTES les requêtes /api/**
    et les route vers le bon microservice.

    Routing :
      /api/auth/** → auth_service
      /api/**      → api_service

    Le middleware JWTGatewayMiddleware a déjà validé le JWT
    avant d'arriver ici. Cette vue se contente de router.
    """

    http_method_names = [
        "get", "post", "put", "patch",
        "delete", "head", "options", "trace",
    ]

    def dispatch(self, request, *args, **kwargs):
        path = request.path_info

        # ── Résoudre la route ─────────────────────────────────────────
        route = resolve_route(path)
        if route is None:
            return JsonResponse(
                {
                    "error":  "Not Found",
                    "detail": f"Aucun service configuré pour le chemin : {path}",
                    "code":   "route_not_found",
                },
                status=404,
                headers={"X-Gateway-Service": "cabinet-gateway"},
            )

        logger.info(
            "[%s] %s %s → %s",
            getattr(request, "gateway_user", {}) and
            getattr(request, "gateway_user", {}).get("role", "anonymous") or "anonymous",
            request.method,
            path,
            route.service_name,
        )

        # ── Transférer vers le service upstream ────────────────────────
        return forward_request(
            request      = request,
            target_base_url = route.target_url,
            service_name = route.service_name,
        )

    # Toutes les méthodes HTTP passent par dispatch
    get     = delete = head = options = trace = dispatch
    post    = put = patch = dispatch


# ── Health Check ──────────────────────────────────────────────────────────────

class HealthView(View):
    """
    GET /api/gateway/health/
    Endpoint de santé vérifié par :
      - Traefik (healthCheck dans la configuration)
      - Consul (service health check)
      - Docker (HEALTHCHECK)

    Répond 200 OK si le gateway est opérationnel.
    """

    def get(self, request):
        return JsonResponse(
            {
                "status":  "ok",
                "service": "cabinet-gateway",
                "version": "1.0.0",
            },
            status=200,
        )


# ── Status détaillé ────────────────────────────────────────────────────────────

class StatusView(View):
    """
    GET /api/gateway/status/
    État détaillé du gateway avec la santé des services upstream.
    Utile pour le monitoring et le débogage.
    """

    def get(self, request):
        uptime_seconds = int(time.monotonic() - _START_TIME)

        # Vérifier la santé de chaque service upstream
        services_health = {
            "auth_service": _check_service_health(
                getattr(settings, "AUTH_SERVICE_URL", ""),
                "/api/auth/health/",
            ),
            "api_service": _check_service_health(
                getattr(settings, "API_SERVICE_URL", ""),
                "/api/health/",
            ),
        }

        all_healthy = all(
            s["status"] == "healthy" for s in services_health.values()
        )

        return JsonResponse(
            {
                "gateway": {
                    "status":          "healthy",
                    "service":         "cabinet-gateway",
                    "version":         "1.0.0",
                    "uptime_seconds":  uptime_seconds,
                    "started_at":      _START_DATETIME,
                },
                "services":    services_health,
                "all_healthy": all_healthy,
                "config": {
                    "rate_limit_per_minute": getattr(settings, "RATE_LIMIT_PER_MINUTE", 60),
                    "proxy_timeout":         getattr(settings, "PROXY_TIMEOUT", 30),
                    "consul_enabled":        getattr(settings, "CONSUL_REGISTER", False),
                    "routes": [
                        {"prefix": "/api/auth/", "target": "auth_service"},
                        {"prefix": "/api/",      "target": "api_service"},
                    ],
                },
            },
            status=200 if all_healthy else 207,
        )


# ── Services ───────────────────────────────────────────────────────────────────

class ServicesView(View):
    """
    GET /api/gateway/services/
    Liste les services enregistrés dans Consul.
    Si Consul n'est pas activé, retourne la configuration statique.
    """

    def get(self, request):
        consul_enabled = getattr(settings, "CONSUL_REGISTER", False)

        if consul_enabled:
            try:
                from .consul_client import ConsulClient
                client   = ConsulClient()
                services = client.list_services()
                return JsonResponse({"source": "consul", "services": services})
            except Exception as exc:
                logger.warning("Consul inaccessible: %s", exc)

        # Fallback : configuration statique
        return JsonResponse({
            "source": "static",
            "services": {
                "cabinet-gateway": {
                    "url":  f"http://localhost:{getattr(settings, 'SERVICE_PORT', 8080)}",
                    "port": getattr(settings, "SERVICE_PORT", 8080),
                },
                "auth-service": {
                    "url":  getattr(settings, "AUTH_SERVICE_URL", ""),
                    "port": 8001,
                },
                "api-service": {
                    "url":  getattr(settings, "API_SERVICE_URL", ""),
                    "port": 8000,
                },
            },
        })


# ── Helpers ───────────────────────────────────────────────────────────────────

def _check_service_health(base_url: str, health_path: str) -> dict:
    """
    Vérifie la santé d'un service upstream en appelant son endpoint health.
    Timeout court (2s) pour ne pas bloquer la réponse status.
    """
    if not base_url:
        return {"status": "unknown", "url": None, "latency_ms": None}

    url = f"{base_url}{health_path}"
    start = time.monotonic()
    try:
        with httpx.Client(timeout=2.0) as client:
            response = client.get(url)
        latency_ms = round((time.monotonic() - start) * 1000)

        if response.status_code == 200:
            return {
                "status":     "healthy",
                "url":        base_url,
                "latency_ms": latency_ms,
            }
        return {
            "status":      "degraded",
            "url":         base_url,
            "status_code": response.status_code,
            "latency_ms":  latency_ms,
        }

    except httpx.ConnectError:
        return {"status": "unreachable", "url": base_url, "error": "Connection refused"}
    except httpx.TimeoutException:
        return {"status": "timeout",     "url": base_url, "error": "Health check timeout"}
    except Exception as exc:
        return {"status": "error",       "url": base_url, "error": str(exc)}