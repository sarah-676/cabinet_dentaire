"""
gateway_app/middleware.py — API Gateway
=========================================
CORRECTION : validation JWT via PyJWT directement.
PyJWT est déjà installé (dépendance de djangorestframework_simplejwt).
On ne passe plus par TokenBackend de simplejwt — zéro dépendance
aux modèles Django (ContentType, AbstractBaseUser).

Les deux middlewares fonctionnent exactement comme avant :
  1. RateLimitMiddleware  → limite par IP (sliding window)
  2. JWTGatewayMiddleware → valide le Bearer token localement
"""

import time
import logging
from collections import defaultdict
from threading import Lock

import jwt as pyjwt
from django.conf import settings
from django.http import JsonResponse

logger = logging.getLogger("gateway_app")
DEBUG = True
ALLOWED_HOSTS = ["*"]

# ══════════════════════════════════════════════════════════════════════════════
# RATE LIMITER — stockage en mémoire (thread-safe)
# ══════════════════════════════════════════════════════════════════════════════

_rate_store: dict[str, list[float]] = defaultdict(list)
_rate_lock  = Lock()
ROOT_URLCONF = "config.urls" 

def _is_rate_limited(ip: str, limit: int, window: int = 60) -> bool:
    """
    Sliding window rate limiter.
    Retourne True si la requête doit être bloquée.
    """
    now = time.monotonic()
    with _rate_lock:
        timestamps = _rate_store[ip]
        timestamps[:] = [t for t in timestamps if now - t < window]
        if len(timestamps) >= limit:
            return True
        timestamps.append(now)
        return False


def _get_client_ip(request) -> str:
    """Extrait l'IP réelle — supporte X-Forwarded-For (derrière Traefik)."""
    xff = request.META.get("HTTP_X_FORWARDED_FOR", "")
    if xff:
        return xff.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR", "unknown")


# ══════════════════════════════════════════════════════════════════════════════
# MIDDLEWARE 1 — Rate Limit
# ══════════════════════════════════════════════════════════════════════════════

class RateLimitMiddleware:
    """Limite le débit par IP — configurable via settings.RATE_LIMIT_PER_MINUTE."""

    def __init__(self, get_response):
        self.get_response     = get_response
        self.limit_per_minute = getattr(settings, "RATE_LIMIT_PER_MINUTE", 60)

    def __call__(self, request):
        ip = _get_client_ip(request)

        if _is_rate_limited(ip, limit=self.limit_per_minute, window=60):
            logger.warning("Rate limit dépassé — IP=%s", ip)
            return JsonResponse(
                {
                    "error":  "Too Many Requests",
                    "detail": f"Limite de {self.limit_per_minute} requêtes/minute dépassée.",
                    "code":   "rate_limit_exceeded",
                },
                status=429,
                headers={
                    "Retry-After":       "60",
                    "X-RateLimit-Limit": str(self.limit_per_minute),
                    "X-Gateway-Service": "cabinet-gateway",
                },
            )

        response = self.get_response(request)
        response["X-RateLimit-Limit"] = str(self.limit_per_minute)
        return response


# ══════════════════════════════════════════════════════════════════════════════
# MIDDLEWARE 2 — JWT Gateway Auth (via PyJWT — sans dépendance modèles Django)
# ══════════════════════════════════════════════════════════════════════════════

class JWTGatewayMiddleware:
    """
    Valide le JWT Bearer token localement via PyJWT.

    Avantage vs simplejwt.TokenBackend :
      - PyJWT ne dépend PAS de django.contrib.contenttypes ni auth
      - Même résultat : décode et vérifie la signature avec JWT_SECRET_KEY
      - Zéro appel réseau → ultra rapide

    Chemins PUBLIC_PATHS → passent sans token.
    Tous les autres /api/** → token Bearer obligatoire.

    Injecte dans request :
      request.gateway_user  → dict {id, email, role, full_name}
      request.gateway_token → str du token brut
    """

    def __init__(self, get_response):
        self.get_response   = get_response
        jwt_conf            = getattr(settings, "SIMPLE_JWT", {})
        self._secret        = jwt_conf.get(
            "SIGNING_KEY",
            getattr(settings, "SECRET_KEY", ""),
        )
        self._algorithm     = jwt_conf.get("ALGORITHM", "HS256")
        self._user_id_claim = jwt_conf.get("USER_ID_CLAIM", "user_id")
        self._public_paths  = getattr(settings, "PUBLIC_PATHS", [])

    def __call__(self, request):
        path = request.path_info

        # ── Chemins publics → pas de vérification ────────────────────
        if self._is_public(path):
            request.gateway_user  = None
            request.gateway_token = None
            return self.get_response(request)

        # ── Chemins non-API → laisser Django gérer ────────────────────
        if not path.startswith("/api/"):
            return self.get_response(request)

        # ── Extraire le Bearer token ──────────────────────────────────
        auth_header = request.META.get("HTTP_AUTHORIZATION", "")
        if not auth_header.startswith("Bearer "):
            return self._unauthorized("Token d'authentification manquant.")

        raw_token = auth_header.split(" ", 1)[1].strip()
        if not raw_token:
            return self._unauthorized("Token vide.")

        # ── Valider localement via PyJWT ──────────────────────────────
        user_data = self._decode_token(raw_token)
        if user_data is None:
            return self._unauthorized("Token invalide ou expiré.")

        if not user_data.get("is_active", True):
            return self._unauthorized("Compte désactivé.")

        # ── Injecter dans la requête ──────────────────────────────────
        request.gateway_user  = user_data
        request.gateway_token = raw_token
        return self.get_response(request)

    # ── Helpers ───────────────────────────────────────────────────────

    def _is_public(self, path: str) -> bool:
        return any(path.startswith(p) or path == p for p in self._public_paths)

    def _decode_token(self, token: str) -> dict | None:
        """
        Décode et vérifie le JWT avec PyJWT.
        Même résultat que simplejwt.TokenBackend — sans ses dépendances.
        """
        try:
            payload = pyjwt.decode(
                token,
                self._secret,
                algorithms=[self._algorithm],
                options={"verify_exp": True},
            )

            # Vérifier que c'est un access token (pas refresh)
            if payload.get("token_type") != "access":
                logger.debug("Token type invalide: %s", payload.get("token_type"))
                return None

            return {
                "id":        str(payload.get(self._user_id_claim, "")),
                "user_id":   str(payload.get(self._user_id_claim, "")),
                "email":     payload.get("email",     ""),
                "full_name": payload.get("full_name", ""),
                "role":      payload.get("role",      ""),
                "is_active": payload.get("is_active", True),
            }

        except pyjwt.ExpiredSignatureError:
            logger.debug("Token expiré")
            return None
        except pyjwt.InvalidTokenError as e:
            logger.debug("Token invalide: %s", e)
            return None
        except Exception as e:
            logger.error("Erreur inattendue décodage JWT: %s", e)
            return None

    def _unauthorized(self, detail: str) -> JsonResponse:
        return JsonResponse(
            {
                "error":  "Unauthorized",
                "detail": detail,
                "code":   "authentication_failed",
            },
            status=401,
            headers={
                "WWW-Authenticate":  "Bearer",
                "X-Gateway-Service": "cabinet-gateway",
            },
        )