"""
config/settings.py — auth_service
Version finale compatible avec api_service.
"""
import os
from pathlib import Path
from datetime import timedelta

BASE_DIR = Path(__file__).resolve().parent.parent

# ── Core ──────────────────────────────────────────────────────────────────────
SECRET_KEY    = os.environ.get("SECRET_KEY", "django-insecure-changeme")
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
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "drf_spectacular",
    # Local
    "auth_app",
]

# ── Middleware ────────────────────────────────────────────────────────────────
MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",   # doit être en PREMIER
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

# ── Custom User ───────────────────────────────────────────────────────────────
AUTH_USER_MODEL = "auth_app.User"

# ── Database ──────────────────────────────────────────────────────────────────
# SQLite pour développement local — PostgreSQL pour production/Docker
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME":   BASE_DIR / "db.sqlite3",
    }
}

# Pour PostgreSQL, remplacer par :
# DATABASES = {
#     "default": {
#         "ENGINE":   "django.db.backends.postgresql",
#         "NAME":     os.environ.get("POSTGRES_DB",       "cabinet_dentaire"),
#         "USER":     os.environ.get("POSTGRES_USER",     "cabinet"),
#         "PASSWORD": os.environ.get("POSTGRES_PASSWORD", "cabinet_secret"),
#         "HOST":     os.environ.get("POSTGRES_HOST",     "localhost"),
#         "PORT":     os.environ.get("POSTGRES_PORT",     "5432"),
#     }
# }

# ── Cache / Redis ─────────────────────────────────────────────────────────────
REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
CACHES = {
    "default": {
        "BACKEND": "django_redis.cache.RedisCache",
        "LOCATION": REDIS_URL,
        "OPTIONS":  {"CLIENT_CLASS": "django_redis.client.DefaultClient"},
        "TIMEOUT":  300,
    }
}
SESSION_ENGINE     = "django.contrib.sessions.backends.cache"
SESSION_CACHE_ALIAS = "default"

# ── DRF ───────────────────────────────────────────────────────────────────────
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_SCHEMA_CLASS":      "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_PAGINATION_CLASS":  "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
    "DEFAULT_FILTER_BACKENDS": [
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
}

# ── JWT ───────────────────────────────────────────────────────────────────────
# IMPORTANT : JWT_SECRET_KEY doit être IDENTIQUE dans auth_service ET api_service
# api_service l'utilise dans config/authentication.py pour valider les tokens
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(
        minutes=int(os.environ.get("JWT_ACCESS_TOKEN_LIFETIME_MINUTES", 60))
    ),
    "REFRESH_TOKEN_LIFETIME": timedelta(
        days=int(os.environ.get("JWT_REFRESH_TOKEN_LIFETIME_DAYS", 7))
    ),
    "ROTATE_REFRESH_TOKENS":  True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN":       True,
    "ALGORITHM":               "HS256",
    # Cette clé sert à signer ET vérifier les tokens
    # api_service doit avoir la même valeur dans son .env
    "SIGNING_KEY": os.environ.get("JWT_SECRET_KEY", SECRET_KEY),
    "AUTH_HEADER_TYPES":  ("Bearer",),
    "USER_ID_FIELD":      "id",
    "USER_ID_CLAIM":      "user_id",
    "TOKEN_OBTAIN_SERIALIZER": "auth_app.serializers.CustomTokenObtainPairSerializer",
}

# ── CORS ──────────────────────────────────────────────────────────────────────
CORS_ALLOWED_ORIGINS = os.environ.get(
    "CORS_ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:5173"
).split(",")
CORS_ALLOW_CREDENTIALS = True

# ── Media & Static ────────────────────────────────────────────────────────────
MEDIA_URL  = "/media/"
MEDIA_ROOT = BASE_DIR / "media"
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

# ── Templates ─────────────────────────────────────────────────────────────────
TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS":    [],
        "APP_DIRS": True,
        "OPTIONS": {
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

# ── Password validators ───────────────────────────────────────────────────────
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
     "OPTIONS": {"min_length": 8}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# ── Swagger ───────────────────────────────────────────────────────────────────
SPECTACULAR_SETTINGS = {
    "TITLE":       "Cabinet Dentaire — Auth Service",
    "DESCRIPTION": (
        "Service d'authentification JWT.\n\n"
        "Gestion des utilisateurs (Admin / Dentiste / Réceptionniste), "
        "tokens JWT, rôles et permissions.\n\n"
        "Endpoints utilisés par api_service :\n"
        "  GET /api/auth/verify/          → valider un token\n"
        "  GET /api/auth/users/{id}/      → vérifier un utilisateur\n"
        "  GET /api/auth/users/dentistes/ → liste dentistes actifs"
    ),
    "VERSION":             "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "SECURITY":            [{"BearerAuth": []}],
    "COMPONENT_SECURITY_SCHEMES": {
        "BearerAuth": {
            "type":        "http",
            "scheme":      "bearer",
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
        "auth_app":       {"handlers": ["console"], "level": "DEBUG", "propagate": False},
        "django.request": {"handlers": ["console"], "level": "WARNING"},
    },
}
