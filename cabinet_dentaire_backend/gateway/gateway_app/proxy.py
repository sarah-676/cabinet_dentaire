"""
gateway_app/proxy.py — API Gateway
=====================================
Moteur de proxy HTTP du gateway.

Responsabilités :
  - Détermine vers quel service envoyer la requête (routing)
  - Transfère la requête complète (méthode, headers, body)
  - Retourne la réponse upstream telle quelle
  - Gère les erreurs de connexion (service down, timeout)

Table de routage :
  /api/auth/** → auth_service (AUTH_SERVICE_URL)
  /api/**      → api_service  (API_SERVICE_URL)

Headers injectés par le gateway :
  X-Gateway-Service     → "cabinet-gateway"
  X-Forwarded-For       → IP client originale
  X-Real-IP             → IP client originale
  X-Forwarded-Host      → Host original
  X-Request-ID          → UUID unique par requête (tracabilité)

Headers supprimés (ne pas transférer vers upstream) :
  Host                  → sera remplacé par l'URL upstream
  Connection, Keep-Alive → gérés par httpx
"""

import uuid
import logging
from typing import NamedTuple

import httpx
from django.conf import settings
from django.http import HttpResponse, StreamingHttpResponse

logger = logging.getLogger("gateway_app")


# ── Configuration ─────────────────────────────────────────────────────────────

# Headers à ne PAS transférer vers l'upstream
_HOP_BY_HOP_HEADERS = frozenset([
    "connection", "keep-alive", "proxy-authenticate",
    "proxy-authorization", "te", "trailers", "transfer-encoding",
    "upgrade", "host",
])

# Headers à ne PAS renvoyer depuis l'upstream vers le client
_SKIP_RESPONSE_HEADERS = frozenset([
    "transfer-encoding", "connection",
])


# ── Table de routage ──────────────────────────────────────────────────────────

class Route(NamedTuple):
    prefix:      str
    target_url:  str
    service_name: str


def _build_routes() -> list[Route]:
    """Construit la table de routage depuis les settings."""
    return [
        Route(
            prefix="/api/auth/",
            target_url=getattr(settings, "AUTH_SERVICE_URL", "http://localhost:8001"),
            service_name="auth_service",
        ),
        Route(
            prefix="/api/",
            target_url=getattr(settings, "API_SERVICE_URL", "http://localhost:8000"),
            service_name="api_service",
        ),
    ]


def resolve_route(path: str) -> Route | None:
    """
    Détermine vers quel service router la requête.
    Retourne None si aucune route ne correspond.
    """
    routes = _build_routes()
    for route in routes:
        if path.startswith(route.prefix) or path == route.prefix.rstrip("/"):
            return route
    return None


# ── Client HTTP partagé (connection pooling) ─────────────────────────────────

def _get_client() -> httpx.Client:
    """
    Retourne un client httpx configuré.
    Utilise un pool de connexions pour la performance.
    """
    return httpx.Client(
        timeout=httpx.Timeout(
            connect=5.0,
            read=float(getattr(settings, "PROXY_TIMEOUT", 30)),
            write=10.0,
            pool=5.0,
        ),
        limits=httpx.Limits(
            max_connections=getattr(settings, "PROXY_MAX_CONNECTIONS", 100),
            max_keepalive_connections=getattr(settings, "PROXY_MAX_KEEPALIVE", 20),
        ),
        follow_redirects=False,
    )


# ── Moteur de proxy ───────────────────────────────────────────────────────────

def forward_request(request, target_base_url: str, service_name: str) -> HttpResponse:
    """
    Transfère une requête Django vers un service upstream.

    Args:
        request:         Requête Django entrante
        target_base_url: URL de base du service (ex: http://localhost:8001)
        service_name:    Nom du service pour le logging

    Returns:
        HttpResponse avec la réponse du service upstream
    """
    # ── 1. Construire l'URL cible ─────────────────────────────────────
    path_info   = request.path_info
    query       = request.META.get("QUERY_STRING", "")
    target_path = f"{target_base_url}{path_info}"
    if query:
        target_path = f"{target_path}?{query}"

    # ── 2. Construire les headers à transférer ────────────────────────
    headers = {}
    for key, value in request.META.items():
        if key.startswith("HTTP_"):
            # Convertir HTTP_ACCEPT → Accept
            name = key[5:].replace("_", "-").title()
            if name.lower() not in _HOP_BY_HOP_HEADERS:
                headers[name] = value
        elif key == "CONTENT_TYPE" and value:
            headers["Content-Type"] = value
        elif key == "CONTENT_LENGTH" and value:
            headers["Content-Length"] = value

    # ── 3. Injecter les headers gateway ──────────────────────────────
    request_id = str(uuid.uuid4())
    client_ip  = _get_client_ip(request)

    headers["X-Gateway-Service"]  = "cabinet-gateway"
    headers["X-Request-ID"]       = request_id
    headers["X-Forwarded-For"]    = client_ip
    headers["X-Real-IP"]          = client_ip
    headers["X-Forwarded-Host"]   = request.get_host()
    headers["X-Forwarded-Proto"]  = request.scheme

    # Transférer les infos utilisateur (injectées par JWTGatewayMiddleware)
    user = getattr(request, "gateway_user", None)
    if user:
        headers["X-User-ID"]    = str(user.get("id", ""))
        headers["X-User-Role"]  = str(user.get("role", ""))
        headers["X-User-Email"] = str(user.get("email", ""))

    # ── 4. Lire le body ───────────────────────────────────────────────
    try:
        body = request.body
    except Exception:
        body = b""

    # ── 5. Envoyer la requête ─────────────────────────────────────────
    logger.debug(
        "→ %s  %s %s  [request_id=%s]",
        service_name,
        request.method,
        target_path,
        request_id,
    )

    try:
        with _get_client() as client:
            upstream_response = client.request(
                method  = request.method,
                url     = target_path,
                headers = headers,
                content = body,
            )

        logger.debug(
            "← %s  %s  [request_id=%s, status=%s]",
            service_name,
            target_path,
            request_id,
            upstream_response.status_code,
        )

        # ── 6. Construire la réponse Django ───────────────────────────
        response = HttpResponse(
            content      = upstream_response.content,
            status       = upstream_response.status_code,
            content_type = upstream_response.headers.get("content-type", "application/json"),
        )

        # Transférer les headers upstream → client
        for key, value in upstream_response.headers.items():
            if key.lower() not in _SKIP_RESPONSE_HEADERS:
                response[key] = value

        # Ajouter les headers de traçabilité
        response["X-Gateway-Service"] = "cabinet-gateway"
        response["X-Request-ID"]      = request_id
        response["X-Routed-To"]       = service_name

        return response

    except httpx.ConnectError:
        logger.error("Service %s inaccessible — %s", service_name, target_base_url)
        return _error_response(
            503,
            "Service Unavailable",
            f"Le service {service_name} est inaccessible.",
            "service_unavailable",
            request_id,
        )

    except httpx.TimeoutException:
        logger.error("Timeout %s — %s", service_name, target_path)
        return _error_response(
            504,
            "Gateway Timeout",
            f"Le service {service_name} n'a pas répondu dans le délai imparti.",
            "gateway_timeout",
            request_id,
        )

    except httpx.HTTPError as exc:
        logger.error("Erreur HTTP %s — %s: %s", service_name, target_path, exc)
        return _error_response(
            502,
            "Bad Gateway",
            f"Erreur de communication avec {service_name}.",
            "bad_gateway",
            request_id,
        )

    except Exception as exc:
        logger.exception("Erreur inattendue proxy → %s: %s", service_name, exc)
        return _error_response(
            500,
            "Internal Server Error",
            "Erreur interne du gateway.",
            "internal_error",
            request_id,
        )


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_client_ip(request) -> str:
    xff = request.META.get("HTTP_X_FORWARDED_FOR", "")
    if xff:
        return xff.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR", "unknown")


def _error_response(
    status_code: int,
    error:       str,
    detail:      str,
    code:        str,
    request_id:  str,
) -> HttpResponse:
    """Construit une réponse d'erreur JSON standardisée."""
    import json
    return HttpResponse(
        content=json.dumps({
            "error":      error,
            "detail":     detail,
            "code":       code,
            "request_id": request_id,
        }),
        status=status_code,
        content_type="application/json",
        headers={
            "X-Gateway-Service": "cabinet-gateway",
            "X-Request-ID":      request_id,
        },
    )