"""
config/urls.py — auth_service
================================
✅ FIX : suppression de la double définition JWT
  AVANT : routes dupliquées /api/auth/ ET /auth/
  APRÈS : une seule source → /api/auth/ via auth_app.urls

Toutes les routes JWT passent par /api/auth/ :
  POST /api/auth/login/           → obtenir access + refresh token
  POST /api/auth/token/refresh/   → rafraîchir l'access token
  POST /api/auth/token/verify/    → vérifier un token
  POST /api/auth/logout/          → blacklister le refresh token
  GET  /api/auth/me/              → profil utilisateur courant
  GET  /api/auth/users/           → liste utilisateurs (admin)
  GET  /api/auth/users/{id}/      → détail utilisateur
"""

from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path("admin/", admin.site.urls),

    # ✅ Une seule source de vérité pour toutes les routes auth
    # auth_app/urls.py définit login, refresh, verify, logout, me, users
    path("api/auth/", include("auth_app.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)