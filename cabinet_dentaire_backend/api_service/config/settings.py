"""
config/settings.py — api_service
==================================
Compatible avec auth_service de ta camarade.

Informations extraites du auth_service :
  - JWT_SECRET_KEY  : jwt-super-secret-cabinet-dentaire-2026
  - Algorithme JWT  : HS256
  - Claim user ID   : user_id
  - Auth header     : Bearer
  - Port auth       : 8001
"""

import os
from pathlib import Path
from datetime import timedelta

# ── Charger le .env ───────────────────────────────────────────────────────────
from dotenv import load_dotenv
load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

# ── Core ──────────────────────────────────────────────────────────────────────
SECRET_KEY    = os.environ.get("SECRET_KEY", "django-insecure-api-service-changeme")
DEBUG         = os.environ.get("DEBUG", "True") == "True"
ALLOWED_HOSTS = os.environ.get(
    "ALLOWED_HOSTS", "localhost,127.0.0.1,0.0.0.0"
).split(",")

# ── Apps ──────────────────────────────────────────────────────────────────────
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Third-party
    "rest_framework",
    "rest_framework_simplejwt",
    "corsheaders",
    "django_filters",
    "drf_spectacular",
    # Channels (WebSocket)
    "channels",
    # Apps métier
    "patients",
    "rendezvous",
    "radios",
    "ordonnances",
    "dossiers",
    "dental_chart",
    "treatments",
    "notifications",
]

# ── Middleware ────────────────────────────────────────────────────────────────
MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",   # DOIT être en premier
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF     = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

# ── Base de données ───────────────────────────────────────────────────────────
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME":   BASE_DIR / "db.sqlite3",
    }
}
# Pour PostgreSQL en production :
# DATABASES = {
#     "default": {
#         "ENGINE":   "django.db.backends.postgresql",
#         "NAME":     os.environ.get("POSTGRES_DB",       "cabinet_dentaire_api"),
#         "USER":     os.environ.get("POSTGRES_USER",     "cabinet"),
#         "PASSWORD": os.environ.get("POSTGRES_PASSWORD", "cabinet_secret"),
#         "HOST":     os.environ.get("POSTGRES_HOST",     "localhost"),
#         "PORT":     os.environ.get("POSTGRES_PORT",     "5432"),
#     }
# }

# ── Redis / Cache ─────────────────────────────────────────────────────────────
REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
CACHES = {
    "default": {
        "BACKEND":  "django_redis.cache.RedisCache",
        "LOCATION": REDIS_URL,
        "OPTIONS":  {"CLIENT_CLASS": "django_redis.client.DefaultClient"},
        "TIMEOUT":  300,
    }
}

# ── Channels (WebSocket) ──────────────────────────────────────────────────────
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {
            "hosts": [REDIS_URL],
        },
    }
}

# ── DRF ───────────────────────────────────────────────────────────────────────
REST_FRAMEWORK = {
    # Utilise notre authentification déléguée vers auth_service
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "config.authentication.RemoteJWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_SCHEMA_CLASS":     "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
}

# ── JWT — DOIT correspondre exactement au auth_service ───────────────────────
# IMPORTANT : JWT_SECRET_KEY = même valeur que chez ta camarade
# auth_service signe les tokens avec cette clé
# api_service les vérifie avec la MÊME clé
SIMPLE_JWT = {
    "ALGORITHM":    "HS256",
    # ⚠️ Cette valeur DOIT être identique à celle du auth_service
    "SIGNING_KEY":  os.environ.get("JWT_SECRET_KEY", "jwt-super-secret-cabinet-dentaire-2026"),
    "AUTH_HEADER_TYPES":  ("Bearer",),
    # Claim contenant l'ID utilisateur (défini dans auth_service settings.py)
    "USER_ID_CLAIM": "user_id",
    "ACCESS_TOKEN_LIFETIME":  timedelta(minutes=60),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
}

# ── Auth service (appels inter-services) ──────────────────────────────────────
AUTH_SERVICE_URL = os.environ.get("AUTH_SERVICE_URL", "http://localhost:8001")
# Token partagé pour les appels internes (internal/users/{id}/)
INTERNAL_SERVICE_TOKEN = os.environ.get("INTERNAL_SERVICE_TOKEN", "")

# ── CORS ──────────────────────────────────────────────────────────────────────
CORS_ALLOWED_ORIGINS = os.environ.get(
    "CORS_ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:5173"
).split(",")
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_HEADERS = [
    "content-type",
    "authorization",
]    

# ── Media & Static ────────────────────────────────────────────────────────────
MEDIA_URL   = "/media/"
MEDIA_ROOT  = BASE_DIR / "media"
STATIC_URL  = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

# ── Templates ─────────────────────────────────────────────────────────────────
TEMPLATES = [
    {
        "BACKEND":  "django.template.backends.django.DjangoTemplates",
        "DIRS":     [],
        "APP_DIRS": True,
        "OPTIONS":  {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ]
        },
    }
]

# ── i18n ──────────────────────────────────────────────────────────────────────
LANGUAGE_CODE = "fr-fr"
TIME_ZONE     = "Africa/Algiers"
USE_I18N      = True
USE_TZ        = True
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ── Celery (tâches asynchrones) ───────────────────────────────────────────────
CELERY_BROKER_URL    = os.environ.get("CELERY_BROKER_URL", "amqp://guest:guest@localhost:5672//")
CELERY_RESULT_BACKEND = REDIS_URL
CELERY_TIMEZONE      = TIME_ZONE
CELERY_ACCEPT_CONTENT  = ["json"]
CELERY_TASK_SERIALIZER = "json"

# ── RabbitMQ (communication inter-services) ───────────────────────────────────
RABBITMQ_URL = os.environ.get("RABBITMQ_URL", "amqp://guest:guest@localhost:5672/")

# ── Swagger ───────────────────────────────────────────────────────────────────
SPECTACULAR_SETTINGS = {
    "TITLE":        "Cabinet Dentaire — API Service",
    "DESCRIPTION":  (
        "Service métier principal.\n\n"
        "Modules : Patients, Rendez-vous, Dental Chart, "
        "Traitements, Radios, Ordonnances, Dossiers.\n\n"
        "Authentification : JWT Bearer (émis par auth_service :8001)."
    ),
    "VERSION":              "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "SECURITY":             [{"BearerAuth": []}],
    "COMPONENT_SECURITY_SCHEMES": {
        "BearerAuth": {
            "type":         "http",
            "scheme":       "bearer",
            "bearerFormat": "JWT",
        }
    },
}

# ── Logging ───────────────────────────────────────────────────────────────────
LOGGING = {
    "version":                  1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "[{levelname}] {asctime} | {name} | {message}",
            "style":  "{",
        }
    },
    "handlers": {
        "console": {"class": "logging.StreamHandler", "formatter": "verbose"}
    },
    "root":    {"handlers": ["console"], "level": "INFO"},
    "loggers": {
        "notifications":  {"handlers": ["console"], "level": "DEBUG", "propagate": False},
        "patients":       {"handlers": ["console"], "level": "DEBUG", "propagate": False},
        "rendezvous":     {"handlers": ["console"], "level": "DEBUG", "propagate": False},
        "radios":         {"handlers": ["console"], "level": "DEBUG", "propagate": False},
        "ordonnances":    {"handlers": ["console"], "level": "DEBUG", "propagate": False},
        "dossiers":       {"handlers": ["console"], "level": "DEBUG", "propagate": False},
        "dental_chart":   {"handlers": ["console"], "level": "DEBUG", "propagate": False},
        "treatments":     {"handlers": ["console"], "level": "DEBUG", "propagate": False},
        "common":         {"handlers": ["console"], "level": "DEBUG", "propagate": False},
        "django.request": {"handlers": ["console"], "level": "WARNING"},
    },
}
CORS_ALLOW_ALL_ORIGINS = True

CSRF_TRUSTED_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:8080",
]
CORS_ALLOW_METHODS = [
    "GET",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
    "OPTIONS",
]
MEDIA_URL = '/media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')