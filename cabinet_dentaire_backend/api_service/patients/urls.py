"""
patients/urls.py
=================
Routage DRF — ModelViewSet + Router.

Endpoints générés automatiquement :
  GET    /patients/              → PatientViewSet.list
  POST   /patients/              → PatientViewSet.create
  GET    /patients/{id}/         → PatientViewSet.retrieve
  PATCH  /patients/{id}/         → PatientViewSet.partial_update
  DELETE /patients/{id}/         → PatientViewSet.destroy (soft delete)

Actions custom :
  GET    /patients/stats/            → stats()
  GET    /patients/{id}/dossier/     → dossier()
  PATCH  /patients/{id}/valider/     → valider()
  PATCH  /patients/{id}/archiver/    → archiver()
  PATCH  /patients/{id}/restaurer/   → restaurer()
  PATCH  /patients/{id}/note/        → note()
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import PatientViewSet

router = DefaultRouter()
router.register(r"patients", PatientViewSet, basename="patient")

urlpatterns = [
    path("", include(router.urls)),
]