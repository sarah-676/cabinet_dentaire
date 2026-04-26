"""
config/settings.py — auth_service
====================================
✅ Corrections pour environnement LOCAL :
  FIX 1 : CORS_ALLOW_ALL_ORIGINS=True (dev local)
  FIX 2 : CORS_ALLOWED_ORIGINS inclut :8080 (gateway) et :5173 (frontend)
  FIX 3 : JWT_SECRET_KEY fallback clair et documenté
"""

import os
from pathlib import Path
from datetime import timedelta
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY    = os.environ.get("SECRET_KEY", "django-insecure-auth-service-changeme")
DEBUG         = os.environ.get("DEBUG", "True") == "True"
ALLOWED_HOSTS = os.environ.get("ALLOWED_HOSTS", "localhost,127.0.0.1,0.0.0.0").split(",")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "drf_spectacular",
    "auth_app",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",  # PREMIER obligatoire
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
AUTH_USER_MODEL  = "auth_app.User"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME":   BASE_DIR / "db.sqlite3",
    }
}

REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
CACHES = {
    "default": {
        "BACKEND":  "django_redis.cache.RedisCache",
        "LOCATION": REDIS_URL,
        "OPTIONS":  {"CLIENT_CLASS": "django_redis.client.DefaultClient"},
        "TIMEOUT":  300,
    }
}

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
}

# ── JWT ───────────────────────────────────────────────────────────────────────
# ✅ FIX 3 : fallback explicite — MÊME valeur dans api_service et gateway
# Si JWT_SECRET_KEY n'est pas dans .env, cette valeur est utilisée partout.
# Elle DOIT être identique dans les 3 services.
JWT_SECRET_KEY_DEFAULT = "jwt-super-secret-cabinet-dentaire-2026"

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME":  timedelta(minutes=int(os.environ.get("JWT_ACCESS_TOKEN_LIFETIME_MINUTES", 60))),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=int(os.environ.get("JWT_REFRESH_TOKEN_LIFETIME_DAYS", 7))),
    "ROTATE_REFRESH_TOKENS":  True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN":      True,
    "ALGORITHM":              "HS256",
    "SIGNING_KEY":            os.environ.get("JWT_SECRET_KEY", JWT_SECRET_KEY_DEFAULT),
    "AUTH_HEADER_TYPES":      ("Bearer",),
    "USER_ID_FIELD":          "id",
    "USER_ID_CLAIM":          "user_id",
    "TOKEN_OBTAIN_SERIALIZER": "auth_app.serializers.CustomTokenObtainPairSerializer",
}

# ── CORS ──────────────────────────────────────────────────────────────────────
# ✅ FIX 1 & 2 : tous les ports locaux autorisés
CORS_ALLOW_ALL_ORIGINS  = True   # dev local — désactiver en production
CORS_ALLOW_CREDENTIALS  = True
CORS_ALLOW_HEADERS = ["content-type", "authorization", "x-requested-with"]
CORS_ALLOW_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]

CSRF_TRUSTED_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:8080",
    "http://localhost:8000",
    "http://localhost:8001",
]

MEDIA_URL   = "/media/"
MEDIA_ROOT  = BASE_DIR / "media"
STATIC_URL  = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

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

LANGUAGE_CODE = "fr-fr"
TIME_ZONE     = "Africa/Algiers"
USE_I18N      = True
USE_TZ        = True
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator", "OPTIONS": {"min_length": 8}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

SPECTACULAR_SETTINGS = {
    "TITLE":               "Cabinet Dentaire — Auth Service",
    "VERSION":             "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
}

LOGGING = {
    "version":                  1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {"format": "[{levelname}] {asctime} | {name} | {message}", "style": "{"}
    },
    "handlers": {"console": {"class": "logging.StreamHandler", "formatter": "verbose"}},
    "root":    {"handlers": ["console"], "level": "INFO"},
    "loggers": {
        "auth_app":       {"handlers": ["console"], "level": "DEBUG", "propagate": False},
        "django.request": {"handlers": ["console"], "level": "WARNING"},
    },
}