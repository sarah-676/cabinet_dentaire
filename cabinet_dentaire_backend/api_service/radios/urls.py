"""
radios/urls.py — api_service
===============================
Routes DRF via Router.

Endpoints :
  GET    /api/radios/                   → liste radios (filtrée par rôle)
  POST   /api/radios/                   → upload nouvelle radio
  GET    /api/radios/{id}/              → détail + résultat IA
  PATCH  /api/radios/{id}/              → modifier description/type
  DELETE /api/radios/{id}/              → supprimer (soft)
  POST   /api/radios/{id}/analyser/     → bouton IA → analyser
  GET    /api/radios/stats/             → statistiques

Filtres query params :
  ?patient_id=<uuid>       → radios d'un patient
  ?statut_analyse=ANALYSE  → radios analysées
  ?type_radio=PANORAMIQUE  → par type
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import RadioViewSet

router = DefaultRouter()
router.register(r"radios", RadioViewSet, basename="radio")

urlpatterns = [
    path("", include(router.urls)),
]
