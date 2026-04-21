from django.shortcuts import render

# Create your views here.
"""
notifications/views.py — api_service
=======================================
API REST des notifications.

Endpoints :
  GET    /notifications/              → liste paginée (mes notifications)
  GET    /notifications/{id}/         → détail
  PATCH  /notifications/{id}/lire/    → marquer une notification lue
  POST   /notifications/lire-tout/    → marquer toutes lues
  DELETE /notifications/{id}/         → supprimer une notification
  GET    /notifications/stats/        → compteurs (badge navbar)

Règles d'accès :
  - Chaque utilisateur ne voit que SES notifications (filtrage par destinataire_id)
  - Aucun accès cross-user
"""

import logging

from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet
from rest_framework.mixins import (
    ListModelMixin,
    RetrieveModelMixin,
    DestroyModelMixin,
)

from .models import Notification
from .serializers import (
    NotificationSerializer,
    NotificationDetailSerializer,
    NotificationStatsSerializer,
)
from .permissions import IsNotificationOwner
from .services import marquer_toutes_lues

logger = logging.getLogger("notifications")


def _get_user_id(request) -> str | None:
    """Retourne l'ID utilisateur depuis request.user (RemoteUser ou dict)."""
    user = getattr(request, "user", None)
    if user is None:
        return None
    if hasattr(user, "id"):
        return str(user.id)
    if isinstance(user, dict):
        return str(user.get("user_id") or user.get("id", ""))
    return None


class NotificationViewSet(
    ListModelMixin,
    RetrieveModelMixin,
    DestroyModelMixin,
    GenericViewSet,
):
    """
    ViewSet notifications — chaque utilisateur gère uniquement les siennes.

    Endpoints via Router :
      GET    /notifications/              → liste
      GET    /notifications/{id}/         → détail
      DELETE /notifications/{id}/         → supprimer

    Actions custom :
      PATCH  /notifications/{id}/lire/    → marquer lue
      POST   /notifications/lire-tout/    → tout marquer lu
      GET    /notifications/stats/        → compteurs
    """

    permission_classes = [IsAuthenticated, IsNotificationOwner]

    def get_queryset(self):
        user_id = _get_user_id(self.request)
        if not user_id:
            return Notification.objects.none()

        qs = Notification.objects.pour_utilisateur(user_id).order_by("-created_at")

        # Filtres optionnels
        is_read = self.request.query_params.get("is_read")
        type_f  = self.request.query_params.get("type")

        if is_read is not None:
            qs = qs.filter(is_read=is_read.lower() == "true")
        if type_f:
            qs = qs.filter(type=type_f)

        return qs

    def get_serializer_class(self):
        if self.action == "retrieve":
            return NotificationDetailSerializer
        if self.action == "stats":
            return NotificationStatsSerializer
        return NotificationSerializer

    # ── Action : marquer lue ──────────────────────────────────────────

    @action(detail=True, methods=["patch"], url_path="lire")
    def lire(self, request, pk=None):
        """PATCH /notifications/{id}/lire/ → marquer une notification comme lue."""
        try:
            notif = self.get_object()
        except Exception:
            return Response(
                {"detail": "Notification introuvable."},
                status=status.HTTP_404_NOT_FOUND,
            )

        notif.marquer_lue()
        logger.info(
            "Notification marquée lue [user=%s, notif=%s]",
            _get_user_id(request), pk,
        )
        return Response(NotificationSerializer(notif).data)

    # ── Action : tout marquer lu ──────────────────────────────────────

    @action(detail=False, methods=["post"], url_path="lire-tout")
    def lire_tout(self, request):
        """POST /notifications/lire-tout/ → marquer toutes les notifications comme lues."""
        user_id = _get_user_id(request)
        if not user_id:
            return Response(
                {"detail": "Utilisateur non identifié."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        count = marquer_toutes_lues(user_id)
        logger.info("Toutes notifications lues [user=%s] : %d", user_id, count)
        return Response({
            "detail": f"{count} notification(s) marquée(s) comme lues.",
            "count":  count,
        })

    # ── Action : statistiques ─────────────────────────────────────────

    @action(detail=False, methods=["get"], url_path="stats")
    def stats(self, request):
        """GET /notifications/stats/ → compteurs pour le badge navbar."""
        user_id = _get_user_id(request)
        if not user_id:
            return Response({"total": 0, "non_lues": 0, "lues": 0, "par_type": {}})

        qs = Notification.objects.pour_utilisateur(user_id)

        # Comptage par type
        from django.db.models import Count
        par_type_qs = (
            qs.values("type")
              .annotate(count=Count("id"))
              .order_by()
        )
        par_type = {item["type"]: item["count"] for item in par_type_qs}

        data = {
            "total":    qs.count(),
            "non_lues": qs.non_lues().count(),
            "lues":     qs.lues().count(),
            "par_type": par_type,
        }
        return Response(NotificationStatsSerializer(data).data)

    # ── Surcharge destroy ─────────────────────────────────────────────

    def destroy(self, request, *args, **kwargs):
        """DELETE /notifications/{id}/ → suppression définitive."""
        instance = self.get_object()
        instance.delete()
        logger.info(
            "Notification supprimée [user=%s, notif=%s]",
            _get_user_id(request), kwargs.get("pk"),
        )
        return Response(
            {"detail": "Notification supprimée."},
            status=status.HTTP_200_OK,
        )