"""
ordonnances/views.py — api_service
=====================================
OrdonnanceViewSet — gestion complète des ordonnances / prescriptions.

Checklist couverte :
  T-02 — Création et gestion des ordonnances / prescriptions
  D-08 — Visible dans le dossier patient (via patients/views.py → _section_ordonnances)
  A-05 — Isolation stricte par dentiste

Pas de notifications — la checklist T-02 ne mentionne aucun workflow
de validation ni de notification pour les ordonnances.

Cohérence avec patients/views.py et rendezvous/views.py :
  - Même helpers _is_dentiste / _is_admin
  - Même _to_uuid()
  - Même pattern perform_create selon le rôle
  - Même pattern d'actions custom DRF
  - Même pattern get_queryset avec isolation par dentiste
"""

import logging
import uuid as uuid_module

from django.db import transaction
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet
from django_filters.rest_framework import DjangoFilterBackend

from .models import Ordonnance, StatutOrdonnance
from .permissions import (
    IsDentisteOrAdmin,
    IsOrdonnanceOwner,
    _get_role,
    _get_user_id,
)
from .serializers import (
    OrdonnanceAnnulationSerializer,
    OrdonnanceCreateUpdateSerializer,
    OrdonnanceDetailSerializer,
    OrdonnanceListSerializer,
    OrdonnanceStatsSerializer,
)

logger = logging.getLogger(__name__)


# ── Helpers locaux ────────────────────────────────────────────────────────────

def _is_dentiste(request) -> bool: return _get_role(request) == "dentiste"
def _is_admin(request)    -> bool: return _get_role(request) == "admin"


def _to_uuid(value) -> uuid_module.UUID | None:
    if isinstance(value, uuid_module.UUID):
        return value
    try:
        return uuid_module.UUID(str(value))
    except (ValueError, AttributeError):
        return None


# ── ViewSet ───────────────────────────────────────────────────────────────────

class OrdonnanceViewSet(ModelViewSet):
    """
    ViewSet complet — ordonnances du cabinet dentaire.

    Endpoints (Router DRF) :
      GET    /ordonnances/               → liste paginée
      POST   /ordonnances/               → créer
      GET    /ordonnances/{id}/          → fiche détaillée
      PATCH  /ordonnances/{id}/          → modifier
      DELETE /ordonnances/{id}/          → archiver (soft delete)

    Actions custom :
      GET    /ordonnances/stats/             → statistiques tableau de bord
      PATCH  /ordonnances/{id}/annuler/      → annulation de l'ordonnance
      PATCH  /ordonnances/{id}/archiver/     → archiver explicitement
      PATCH  /ordonnances/{id}/restaurer/    → réactiver (admin/dentiste)
      GET    /ordonnances/patient/{pid}/     → toutes les ordonnances d'un patient
    """

    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    filter_backends  = [SearchFilter, DjangoFilterBackend, OrderingFilter]
    search_fields    = ["patient__nom", "patient__prenom", "numero", "diagnostic", "lignes__medicament"]
    filterset_fields = ["statut"]
    ordering_fields  = ["date_prescription", "created_at", "statut"]
    ordering         = ["-date_prescription", "-created_at"]

    # ── Permissions ───────────────────────────────────────────────────

    def get_permissions(self):
        # Toutes les actions nécessitent d'être dentiste ou admin
        classes = [IsDentisteOrAdmin]

        actions_objet = {
            "retrieve", "update", "partial_update", "destroy",
            "annuler", "archiver", "restaurer",
        }
        if self.action in actions_objet:
            classes.append(IsOrdonnanceOwner)

        return [cls() for cls in classes]

    # ── Serializer ────────────────────────────────────────────────────

    def get_serializer_class(self):
        mapping = {
            "list":           OrdonnanceListSerializer,
            "create":         OrdonnanceCreateUpdateSerializer,
            "update":         OrdonnanceCreateUpdateSerializer,
            "partial_update": OrdonnanceCreateUpdateSerializer,
            "stats":          OrdonnanceStatsSerializer,
            "annuler":        OrdonnanceAnnulationSerializer,
            "par_patient":    OrdonnanceListSerializer,
        }
        return mapping.get(self.action, OrdonnanceDetailSerializer)

    # ── QuerySet selon le rôle ────────────────────────────────────────

    def get_queryset(self):
        if not getattr(self.request, "user", None):
            return Ordonnance.objects.none()

        # Précharger les lignes pour éviter N+1 dans la liste et le détail
        qs = Ordonnance.objects.actives().select_related("patient").prefetch_related("lignes")

        if _is_dentiste(self.request):
            dentiste_uuid = _to_uuid(_get_user_id(self.request))
            if not dentiste_uuid:
                return Ordonnance.objects.none()
            qs = qs.filter(dentiste_id=dentiste_uuid)

        elif _is_admin(self.request):
            include_archived = (
                self.request.query_params.get("include_archived") == "true"
            )
            if include_archived:
                qs = (
                    Ordonnance.all_objects.all()
                    .select_related("patient")
                    .prefetch_related("lignes")
                )

        else:
            return Ordonnance.objects.none()

        # ── Filtres additionnels via query params ─────────────────────
        patient_id = self.request.query_params.get("patient_id")
        if patient_id:
            patient_uuid = _to_uuid(patient_id)
            if patient_uuid:
                qs = qs.filter(patient_id=patient_uuid)

        date_debut = self.request.query_params.get("date_debut")
        date_fin   = self.request.query_params.get("date_fin")
        if date_debut:
            qs = qs.filter(date_prescription__gte=date_debut)
        if date_fin:
            qs = qs.filter(date_prescription__lte=date_fin)

        return qs

    # ── CRUD ──────────────────────────────────────────────────────────

    def perform_create(self, serializer):
        if _is_dentiste(self.request):
            dentiste_uuid = _to_uuid(_get_user_id(self.request))
            if not dentiste_uuid:
                raise serializers.ValidationError(
                    {"detail": "ID dentiste invalide dans le token."}
                )
            ordonnance = serializer.save(dentiste_id=dentiste_uuid)
            logger.info(
                "Ordonnance créée [dentiste=%s] : %s — patient=%s",
                dentiste_uuid,
                ordonnance.numero,
                ordonnance.patient_id,
            )

        elif _is_admin(self.request):
            # L'admin doit fournir dentiste_id dans le body
            dentiste_id_raw = self.request.data.get("dentiste_id")
            dentiste_uuid   = _to_uuid(dentiste_id_raw) if dentiste_id_raw else None
            if not dentiste_uuid:
                raise serializers.ValidationError(
                    {"dentiste_id": "Ce champ est obligatoire."}
                )
            ordonnance = serializer.save(dentiste_id=dentiste_uuid)
            logger.info(
                "Ordonnance créée [admin=%s] : %s — patient=%s",
                _get_user_id(self.request),
                ordonnance.numero,
                ordonnance.patient_id,
            )

        else:
            raise serializers.ValidationError(
                {"detail": "Rôle non autorisé à créer une ordonnance."}
            )

    def perform_update(self, serializer):
        ordonnance = serializer.save()
        logger.info(
            "Ordonnance modifiée [user=%s] : %s",
            _get_user_id(self.request),
            ordonnance.numero,
        )

    def perform_destroy(self, instance):
        if not instance.is_active:
            return
        instance.archiver(archived_by_id=_to_uuid(_get_user_id(self.request)))
        logger.info(
            "Ordonnance archivée via DELETE [user=%s] : %s",
            _get_user_id(self.request),
            instance.numero,
        )

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        self.perform_destroy(instance)
        return Response(
            {"detail": f"Ordonnance {instance.numero} archivée."},
            status=status.HTTP_200_OK,
        )

    # ── Action : statistiques ─────────────────────────────────────────

    @action(detail=False, methods=["get"], url_path="stats")
    def stats(self, request):
        """Tableau de bord ordonnances."""
        qs = self.get_queryset()

        if _is_dentiste(request):
            dentiste_uuid = _to_uuid(_get_user_id(request))
            all_qs = Ordonnance.all_objects.filter(dentiste_id=dentiste_uuid)
        else:
            all_qs = Ordonnance.all_objects.all()

        now = timezone.now()

        data = {
            "total":           all_qs.count(),
            "actives":         qs.filter(statut=StatutOrdonnance.ACTIVE).count(),
            "expirees":        qs.expirees().count(),
            "annulees":        qs.filter(statut=StatutOrdonnance.ANNULEE).count(),
            "archivees":       all_qs.filter(is_active=False).count(),
            "ce_mois":         qs.filter(
                created_at__year=now.year,
                created_at__month=now.month,
            ).count(),
            "avec_rendezvous": qs.avec_rendezvous().count(),
        }
        return Response(OrdonnanceStatsSerializer(data).data)

    # ── Action : par patient ──────────────────────────────────────────

    @action(detail=False, methods=["get"], url_path=r"patient/(?P<patient_id>[^/.]+)")
    def par_patient(self, request, patient_id=None):
        """
        GET /ordonnances/patient/{patient_uuid}/
        Retourne toutes les ordonnances actives d'un patient spécifique.
        Utilisé dans le dossier patient.
        """
        patient_uuid = _to_uuid(patient_id)
        if not patient_uuid:
            return Response(
                {"detail": "UUID patient invalide."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Vérifier l'isolation — le dentiste ne voit que ses propres patients
        if _is_dentiste(request):
            dentiste_uuid = _to_uuid(_get_user_id(request))
            from patients.models import Patient
            try:
                Patient.objects.get(
                    id=patient_uuid,
                    dentiste_id=dentiste_uuid,
                    is_active=True,
                )
            except Patient.DoesNotExist:
                return Response(
                    {"detail": "Patient introuvable ou non autorisé."},
                    status=status.HTTP_404_NOT_FOUND,
                )

        qs = (
            Ordonnance.objects.filter(patient_id=patient_uuid, is_active=True)
            .select_related("patient")
            .prefetch_related("lignes")
            .order_by("-date_prescription")
        )

        serializer = OrdonnanceListSerializer(qs, many=True, context={"request": request})
        return Response(serializer.data)

    # ── Action : annuler ──────────────────────────────────────────────

    @action(detail=True, methods=["patch"], url_path="annuler")
    def annuler(self, request, pk=None):
        """Annulation de l'ordonnance — irréversible."""
        ordonnance = self.get_object()

        if ordonnance.statut == StatutOrdonnance.ANNULEE:
            return Response(
                {"detail": "Cette ordonnance est déjà annulée."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = OrdonnanceAnnulationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        ordonnance.annuler()
        logger.info(
            "Ordonnance %s annulée [user=%s]",
            ordonnance.numero,
            _get_user_id(request),
        )
        return Response(
            {
                "detail": f"Ordonnance {ordonnance.numero} annulée.",
                "statut": ordonnance.statut,
            },
            status=status.HTTP_200_OK,
        )

    # ── Action : archiver ─────────────────────────────────────────────

    @action(detail=True, methods=["patch"], url_path="archiver")
    def archiver(self, request, pk=None):
        """Archivage explicite de l'ordonnance (soft delete)."""
        ordonnance = self.get_object()

        if not ordonnance.is_active:
            return Response(
                {"detail": "Cette ordonnance est déjà archivée."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        ordonnance.archiver(archived_by_id=_to_uuid(_get_user_id(request)))
        logger.info(
            "Ordonnance %s archivée [user=%s]",
            ordonnance.numero,
            _get_user_id(request),
        )
        return Response(
            {"detail": f"Ordonnance {ordonnance.numero} archivée."},
            status=status.HTTP_200_OK,
        )

    # ── Action : restaurer ────────────────────────────────────────────

    @action(detail=True, methods=["patch"], url_path="restaurer")
    def restaurer(self, request, pk=None):
        """Réactivation d'une ordonnance archivée — réservé admin/dentiste."""
        try:
            ordonnance = Ordonnance.all_objects.get(pk=pk)
        except Ordonnance.DoesNotExist:
            return Response(
                {"detail": "Ordonnance introuvable."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Vérification isolation pour le dentiste
        if _is_dentiste(request):
            dentiste_uuid = _to_uuid(_get_user_id(request))
            if str(ordonnance.dentiste_id) != str(dentiste_uuid):
                return Response(
                    {"detail": "Vous n'êtes pas le dentiste prescripteur de cette ordonnance."},
                    status=status.HTTP_403_FORBIDDEN,
                )

        if ordonnance.is_active:
            return Response(
                {"detail": "Cette ordonnance est déjà active."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        ordonnance.restaurer()
        logger.info(
            "Ordonnance %s restaurée [user=%s]",
            ordonnance.numero,
            _get_user_id(request),
        )
        return Response(
            {"detail": f"Ordonnance {ordonnance.numero} restaurée."},
            status=status.HTTP_200_OK,
        )
