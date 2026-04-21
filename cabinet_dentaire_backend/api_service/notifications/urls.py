"""
notifications/urls.py — api_service
======================================
Routes REST pour le module notifications.

À inclure dans config/urls.py :
  path("api/", include("notifications.urls"))

Endpoints générés :
  GET    /api/notifications/              → liste (mes notifications)
  GET    /api/notifications/{id}/         → détail
  DELETE /api/notifications/{id}/         → supprimer

Actions custom :
  PATCH  /api/notifications/{id}/lire/    → marquer une notification lue
  POST   /api/notifications/lire-tout/    → tout marquer lu
  GET    /api/notifications/stats/        → compteurs badge navbar
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import NotificationViewSet

router = DefaultRouter()
router.register(r"notifications", NotificationViewSet, basename="notification")

urlpatterns = [
    path("", include(router.urls)),
]