"""
ordonnances/urls.py
====================
Routage DRF — ModelViewSet + Router.

Endpoints générés automatiquement :
  GET    /ordonnances/               → OrdonnanceViewSet.list
  POST   /ordonnances/               → OrdonnanceViewSet.create
  GET    /ordonnances/{id}/          → OrdonnanceViewSet.retrieve
  PATCH  /ordonnances/{id}/          → OrdonnanceViewSet.partial_update
  DELETE /ordonnances/{id}/          → OrdonnanceViewSet.destroy (soft delete)

Actions custom :
  GET    /ordonnances/stats/                      → stats()
  GET    /ordonnances/patient/{patient_uuid}/     → par_patient()
  PATCH  /ordonnances/{id}/annuler/               → annuler()
  PATCH  /ordonnances/{id}/archiver/              → archiver()
  PATCH  /ordonnances/{id}/restaurer/             → restaurer()
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import OrdonnanceViewSet

router = DefaultRouter()
router.register(r"ordonnances", OrdonnanceViewSet, basename="ordonnance")

urlpatterns = [
    path("", include(router.urls)),
]
