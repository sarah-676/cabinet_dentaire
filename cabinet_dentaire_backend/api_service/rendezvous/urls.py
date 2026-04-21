"""
rendezvous/urls.py
===================
Routage DRF — ModelViewSet + Router.

Endpoints générés automatiquement :
  GET    /rendezvous/              → RendezVousViewSet.list
  POST   /rendezvous/              → RendezVousViewSet.create
  GET    /rendezvous/{id}/         → RendezVousViewSet.retrieve
  PATCH  /rendezvous/{id}/         → RendezVousViewSet.partial_update
  DELETE /rendezvous/{id}/         → RendezVousViewSet.destroy (soft delete → ANNULE)

Actions custom :
  GET    /rendezvous/stats/            → stats()          — tableau de bord D-01
  GET    /rendezvous/calendar/         → calendar()       — vue agenda / FullCalendar
  PATCH  /rendezvous/{id}/valider/     → valider()        — accepter/refuser R-06/R-07
  PATCH  /rendezvous/{id}/annuler/     → annuler()        — annulation avec raison
  PATCH  /rendezvous/{id}/terminer/    → terminer()       — marquer terminé
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import RendezVousViewSet

router = DefaultRouter()
router.register(r"rendezvous", RendezVousViewSet, basename="rendezvous")

urlpatterns = [
    path("", include(router.urls)),
]