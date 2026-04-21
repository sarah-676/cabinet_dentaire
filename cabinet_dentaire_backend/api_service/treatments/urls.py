"""
treatments/urls.py — api_service
=====================================
Routes générées :

  GET    /api/treatments/                               → liste
  POST   /api/treatments/                               → créer
  GET    /api/treatments/{id}/                          → détail + séances
  PATCH  /api/treatments/{id}/                          → modifier
  DELETE /api/treatments/{id}/                          → soft delete

  GET    /api/treatments/stats/                         → statistiques
  GET    /api/treatments/par-patient/{patient_id}/      → par patient
  GET    /api/treatments/par-dent/{numero_dent}/        → par dent (Dental Chart)

  GET    /api/treatments/{id}/seances/                  → liste séances
  POST   /api/treatments/{id}/seances/                  → ajouter séance

  PATCH  /api/treatments/{id}/demarrer/                 → PLANIFIE → EN_COURS
  PATCH  /api/treatments/{id}/terminer/                 → → TERMINE
  PATCH  /api/treatments/{id}/abandonner/               → → ABANDONNE
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import TraitementViewSet

router = DefaultRouter()
router.register(r"treatments", TraitementViewSet, basename="treatment")

urlpatterns = [
    path("", include(router.urls)),
]