"""
Django settings for gateway service
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from .env
load_dotenv()

# Build paths
BASE_DIR = Path(__file__).resolve().parent.parent
SECRET_KEY = 'gateway-django-secret-key-do-not-use-in-production'
DEBUG = True
ALLOWED_HOSTS = ['*']

# Applications
INSTALLED_APPS = [
    'django.contrib.contenttypes',
    'django.contrib.auth',
    'gateway_app',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'config.settings.RateLimitMiddleware',
    'config.settings.JWTGatewayMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'

# Database (on n'en a pas besoin pour le gateway, mais Django en demande une)
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}

# Logging
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {process:d} {thread:d} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'DEBUG',
    },
    'loggers': {
        'gateway_app': {
            'handlers': ['console'],
            'level': 'DEBUG',
            'propagate': False,
        },
    },
}

# Gateway Configuration
SERVICE_PORT = 8080
AUTH_SERVICE_URL = 'http://localhost:8001'
API_SERVICE_URL = 'http://localhost:8000'

# CORS
CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
]

# Public paths (no JWT required)
PUBLIC_PATHS = [
    '/api/auth/login/',
    '/api/auth/refresh/',
    '/api/auth/health/',
    '/api/gateway/health/',
    '/api/gateway/status/',
    '/api/gateway/services/',
]

# Rate limiting
RATE_LIMIT_PER_MINUTE = 60

# Proxy timeout
PROXY_TIMEOUT = 30
PROXY_MAX_CONNECTIONS = 100
PROXY_MAX_KEEPALIVE = 20

# JWT Configuration (MUST MATCH auth_service)
SIMPLE_JWT = {
    'SIGNING_KEY': os.environ.get('JWT_SECRET_KEY', os.environ.get('SECRET_KEY', 'django-insecure-changeme')),
    'ALGORITHM': 'HS256',
    'USER_ID_CLAIM': 'user_id',
}

# Middleware implementation
import time
import logging
from collections import defaultdict
from threading import Lock

import jwt as pyjwt
from django.conf import settings
from django.http import JsonResponse

logger = logging.getLogger("gateway_app")

_rate_store = defaultdict(list)
_rate_lock = Lock()

def _is_rate_limited(ip: str, limit: int, window: int = 60) -> bool:
    """Sliding window rate limiter."""
    now = time.monotonic()
    with _rate_lock:
        timestamps = _rate_store[ip]
        timestamps[:] = [t for t in timestamps if now - t < window]
        if len(timestamps) >= limit:
            return True
        timestamps.append(now)
        return False

def _get_client_ip(request) -> str:
    """Extrait l'IP réelle — supporte X-Forwarded-For."""
    xff = request.META.get("HTTP_X_FORWARDED_FOR", "")
    if xff:
        return xff.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR", "unknown")

class RateLimitMiddleware:
    """Limite le débit par IP."""
    def __init__(self, get_response):
        self.get_response = get_response
        self.limit_per_minute = getattr(settings, "RATE_LIMIT_PER_MINUTE", 60)

    def __call__(self, request):
        ip = _get_client_ip(request)
        if _is_rate_limited(ip, limit=self.limit_per_minute, window=60):
            logger.warning("Rate limit dépassé — IP=%s", ip)
            return JsonResponse(
                {
                    "error": "Too Many Requests",
                    "detail": f"Limite de {self.limit_per_minute} requêtes/minute dépassée.",
                    "code": "rate_limit_exceeded",
                },
                status=429,
            )
        response = self.get_response(request)
        response["X-RateLimit-Limit"] = str(self.limit_per_minute)
        return response

class JWTGatewayMiddleware:
    """Valide le JWT Bearer token localement via PyJWT."""
    def __init__(self, get_response):
        self.get_response = get_response
        jwt_conf = getattr(settings, "SIMPLE_JWT", {})
        self._secret = jwt_conf.get(
            "SIGNING_KEY",
            getattr(settings, "SECRET_KEY", ""),
        )
        self._algorithm = jwt_conf.get("ALGORITHM", "HS256")
        self._user_id_claim = jwt_conf.get("USER_ID_CLAIM", "user_id")
        self._public_paths = getattr(settings, "PUBLIC_PATHS", [])

    def __call__(self, request):
        path = request.path_info

        if self._is_public(path):
            request.gateway_user = None
            request.gateway_token = None
            return self.get_response(request)

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

        request.gateway_user = user_data
        request.gateway_token = raw_token
        return self.get_response(request)

    def _is_public(self, path: str) -> bool:
        return any(path.startswith(p) or path == p for p in self._public_paths)

    def _decode_token(self, token: str):
        """Décode et vérifie le JWT avec PyJWT."""
        try:
            payload = pyjwt.decode(
                token,
                self._secret,
                algorithms=[self._algorithm],
                options={"verify_exp": True},
            )

            if payload.get("token_type") != "access":
                logger.debug("Token type invalide: %s", payload.get("token_type"))
                return None

            return {
                "id": str(payload.get(self._user_id_claim, "")),
                "user_id": str(payload.get(self._user_id_claim, "")),
                "email": payload.get("email", ""),
                "full_name": payload.get("full_name", ""),
                "role": payload.get("role", ""),
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
                "error": "Unauthorized",
                "detail": detail,
                "code": "authentication_failed",
            },
            status=401,
        )
