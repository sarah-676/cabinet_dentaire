"""
config/settings.py — gateway_service
======================================
✅ Corrections pour environnement LOCAL (sans Docker) :
  FIX 1 : CORS_ALLOWED_ORIGINS inclut tous les ports locaux
  FIX 2 : JWT_SECRET_KEY fallback aligné avec auth_service
  FIX 3 : PUBLIC_PATHS inclut /media/ (pas de JWT sur les images)
  FIX 4 : CORS_ALLOW_ALL_ORIGINS=True pour simplifier le dev local
"""

import os
import sys
import time
import logging
from pathlib import Path
from collections import defaultdict
from threading import Lock

from dotenv import load_dotenv
load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY    = 'gateway-django-secret-key-do-not-use-in-production'
DEBUG         = True
ALLOWED_HOSTS = ['*']

INSTALLED_APPS = [
    'daphne',
    'channels',
    'corsheaders',
    'django.contrib.contenttypes',
    'django.contrib.auth',
    'gateway_app',
]

MIDDLEWARE = [
    # ✅ FIX : CorsMiddleware DOIT être en PREMIER
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'config.settings.RateLimitMiddleware',
    'config.settings.JWTGatewayMiddleware',
]

ROOT_URLCONF     = 'config.urls'
ASGI_APPLICATION = 'config.asgi.application'
WSGI_APPLICATION = 'config.wsgi.application'

TEMPLATES = [
    {
        'BACKEND':  'django.template.backends.django.DjangoTemplates',
        'DIRS':     [],
        'APP_DIRS': True,
        'OPTIONS':  {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
            ],
        },
    },
]

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME':   BASE_DIR / 'db.sqlite3',
    }
}

# ── Services upstream ─────────────────────────────────────────────────────────
SERVICE_PORT       = 8080
AUTH_SERVICE_URL   = os.environ.get("AUTH_SERVICE_URL",   "http://localhost:8001")
API_SERVICE_URL    = os.environ.get("API_SERVICE_URL",    "http://localhost:8000")
API_SERVICE_WS_URL = os.environ.get("API_SERVICE_WS_URL", "ws://localhost:8000/ws/notifications/")

# ── CORS ──────────────────────────────────────────────────────────────────────
# ✅ FIX 1 : tous les ports locaux autorisés
CORS_ALLOW_ALL_ORIGINS  = True   # simplifie le dev local
CORS_ALLOW_CREDENTIALS  = True
CORS_ALLOW_HEADERS = [
    "authorization",
    "content-type",
    "x-requested-with",
]
CORS_ALLOW_METHODS = [
    "GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD",
]

# ── Chemins publics (pas de JWT requis) ───────────────────────────────────────
# ✅ FIX 3 : /media/ ajouté → les images ne demandent pas de token
PUBLIC_PATHS = [
    '/api/auth/login/',
    '/api/auth/token/refresh/',
    '/api/auth/token/verify/',
    '/api/auth/health/',
    '/api/gateway/health/',
    '/api/gateway/status/',
    '/api/gateway/services/',
    '/api/health/',
    '/media/',          # ✅ images radios — pas de JWT
    '/ws/',
]

# ── Rate limiting ─────────────────────────────────────────────────────────────
RATE_LIMIT_PER_MINUTE = 120   # plus permissif en dev local

# ── Proxy ─────────────────────────────────────────────────────────────────────
PROXY_TIMEOUT         = 30
PROXY_MAX_CONNECTIONS = 100
PROXY_MAX_KEEPALIVE   = 20

# ── JWT — DOIT correspondre exactement à auth_service ────────────────────────
# ✅ FIX 2 : fallback aligné avec auth_service/config/settings.py
SIMPLE_JWT = {
    'SIGNING_KEY':   os.environ.get('JWT_SECRET_KEY', 'jwt-super-secret-cabinet-dentaire-2026'),
    'ALGORITHM':     'HS256',
    'USER_ID_CLAIM': 'user_id',
}

# ── Logging ───────────────────────────────────────────────────────────────────
LOGGING = {
    'version':                  1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {message}',
            'style':  '{',
        },
    },
    'handlers': {
        'console': {
            'class':     'logging.StreamHandler',
            'formatter': 'verbose',
        },
    },
    'root': {'handlers': ['console'], 'level': 'INFO'},
    'loggers': {
        'gateway_app': {'handlers': ['console'], 'level': 'DEBUG', 'propagate': False},
    },
}

# ── Middleware classes (définies ici, référencées dans MIDDLEWARE) ────────────

import jwt as pyjwt
from django.conf import settings
from django.http import JsonResponse

logger = logging.getLogger("gateway_app")

_rate_store = defaultdict(list)
_rate_lock  = Lock()


def _is_rate_limited(ip: str, limit: int, window: int = 60) -> bool:
    now = time.monotonic()
    with _rate_lock:
        timestamps = _rate_store[ip]
        timestamps[:] = [t for t in timestamps if now - t < window]
        if len(timestamps) >= limit:
            return True
        timestamps.append(now)
        return False


def _get_client_ip(request) -> str:
    xff = request.META.get("HTTP_X_FORWARDED_FOR", "")
    if xff:
        return xff.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR", "unknown")


class RateLimitMiddleware:
    def __init__(self, get_response):
        self.get_response       = get_response
        self.limit_per_minute   = getattr(settings, "RATE_LIMIT_PER_MINUTE", 120)

    def __call__(self, request):
        ip = _get_client_ip(request)
        if _is_rate_limited(ip, limit=self.limit_per_minute, window=60):
            logger.warning("Rate limit dépassé — IP=%s", ip)
            return JsonResponse(
                {"error": "Too Many Requests", "code": "rate_limit_exceeded"},
                status=429,
            )
        response = self.get_response(request)
        response["X-RateLimit-Limit"] = str(self.limit_per_minute)
        return response


class JWTGatewayMiddleware:
    def __init__(self, get_response):
        self.get_response    = get_response
        jwt_conf             = getattr(settings, "SIMPLE_JWT", {})
        self._secret         = jwt_conf.get("SIGNING_KEY", "")
        self._algorithm      = jwt_conf.get("ALGORITHM", "HS256")
        self._user_id_claim  = jwt_conf.get("USER_ID_CLAIM", "user_id")
        self._public_paths   = getattr(settings, "PUBLIC_PATHS", [])

    def __call__(self, request):
        path = request.path_info

        # OPTIONS (preflight CORS) → jamais de JWT
        if request.method == "OPTIONS":
            return self.get_response(request)

        # Chemins publics → pas de vérification JWT
        if self._is_public(path):
            request.gateway_user  = None
            request.gateway_token = None
            return self.get_response(request)

        # Seules les routes /api/ sont protégées
        if not path.startswith("/api/"):
            return self.get_response(request)

        auth_header = request.META.get("HTTP_AUTHORIZATION", "")
        if not auth_header.startswith("Bearer "):
            return self._unauthorized("Token d'authentification manquant.")

        raw_token = auth_header.split(" ", 1)[1].strip()
        if not raw_token:
            return self._unauthorized("Token vide.")

        user_data = self._decode_token(raw_token)
        if user_data is None:
            return self._unauthorized("Token invalide ou expiré.")

        if not user_data.get("is_active", True):
            return self._unauthorized("Compte désactivé.")

        request.gateway_user  = user_data
        request.gateway_token = raw_token
        return self.get_response(request)

    def _is_public(self, path: str) -> bool:
        return any(path.startswith(p) or path == p for p in self._public_paths)

    def _decode_token(self, token: str):
        try:
            payload = pyjwt.decode(
                token,
                self._secret,
                algorithms=[self._algorithm],
                options={"verify_exp": True},
            )
            if payload.get("token_type") != "access":
                return None
            return {
                "id":        str(payload.get(self._user_id_claim, "")),
                "user_id":   str(payload.get(self._user_id_claim, "")),
                "email":     payload.get("email", ""),
                "full_name": payload.get("full_name", ""),
                "role":      payload.get("role", ""),
                "is_active": payload.get("is_active", True),
            }
        except pyjwt.ExpiredSignatureError:
            logger.debug("Token expiré")
            return None
        except pyjwt.InvalidTokenError as e:
            logger.debug("Token invalide: %s", e)
            return None
        except Exception as e:
            logger.error("Erreur décodage JWT: %s", e)
            return None

    def _unauthorized(self, detail: str) -> JsonResponse:
        return JsonResponse(
            {"error": "Unauthorized", "detail": detail, "code": "authentication_failed"},
            status=401,
        )