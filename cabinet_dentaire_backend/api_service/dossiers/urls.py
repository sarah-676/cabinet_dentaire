"""
dossiers/urls.py — api_service
==================================
Routes :

  GET  /api/dossiers/                          → liste résumée des patients
  GET  /api/dossiers/{patient_id}/             → dossier complet
  GET  /api/dossiers/{patient_id}/timeline/    → timeline chronologique
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import DossierViewSet

router = DefaultRouter()
router.register(r"dossiers", DossierViewSet, basename="dossier")

urlpatterns = [
    path("", include(router.urls)),
]