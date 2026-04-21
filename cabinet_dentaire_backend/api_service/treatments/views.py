"""
treatments/views.py — api_service
=====================================
TraitementViewSet — gestion complète des traitements dentaires.

Endpoints (Router DRF) :
  GET    /treatments/                        → liste paginée (par dentiste)
  POST   /treatments/                        → créer un traitement
  GET    /treatments/{id}/                   → fiche détaillée + séances
  PATCH  /treatments/{id}/                   → modifier
  DELETE /treatments/{id}/                   → soft delete

Actions custom :
  GET    /treatments/stats/                  → statistiques tableau de bord
  POST   /treatments/{id}/seances/           → ajouter une séance
  GET    /treatments/{id}/seances/           → liste des séances
  PATCH  /treatments/{id}/demarrer/          → PLANIFIE → EN_COURS
  PATCH  /treatments/{id}/terminer/          → → TERMINE
  PATCH  /treatments/{id}/abandonner/        → → ABANDONNE (raison obligatoire)
  GET    /treatments/par-patient/{patient_id}/  → traitements d'un patient
  GET    /treatments/par-dent/{numero_dent}/    → traitements par dent

Règles métier :
  - Dentiste → voit uniquement ses traitements
  - Admin    → voit tous les traitements
  - Réceptionniste → lecture seule (traitements = données médicales confidentielles)
"""

import logging
import uuid as uuid_module
from decimal import Decimal

from django.db import transaction
from django.db.models import Sum, Count, Q
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet
from django_filters.rest_framework import DjangoFilterBackend

from patients.models import Patient
from .models import Traitement, SeanceSoin, StatutTraitement, TypeActe
from .permissions import (
    IsDentisteOrAdmin,
    IsTraitementOwner,
    IsReceptioniste,
    _get_role,
    _get_user_id,
)
from .serializers import (
    TraitementListSerializer,
    TraitementDetailSerializer,
    TraitementCreateSerializer,
    TraitementUpdateSerializer,
    TraitementAbandonnerSerializer,
    TraitementStatsSerializer,
    SeanceSoinSerializer,
    SeanceSoinCreateSerializer,
)

logger = logging.getLogger(__name__)


# ── Helpers locaux ────────────────────────────────────────────────────────────

def _is_dentiste(request)      -> bool: return _get_role(request) == "dentiste"
def _is_admin(request)         -> bool: return _get_role(request) == "admin"
def _is_receptioniste(request) -> bool: return _get_role(request) == "receptionniste"


def _to_uuid(value) -> uuid_module.UUID | None:
    if isinstance(value, uuid_module.UUID):
        return value
    try:
        return uuid_module.UUID(str(value))
    except (ValueError, AttributeError):
        return None


# ══════════════════════════════════════════════════════════════════════════════
# VIEWSET
# ══════════════════════════════════════════════════════════════════════════════

class TraitementViewSet(ModelViewSet):
    """
    ViewSet complet — traitements dentaires.
    Checklist T-01 : ajout, suivi et historique médical complet.
    """

    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    filter_backends  = [SearchFilter, DjangoFilterBackend, OrderingFilter]
    search_fields    = ["description", "notes_pre_op", "notes_post_op"]
    filterset_fields = ["statut", "type_acte", "dent", "materiau", "anesthesie_utilisee"]
    ordering_fields  = ["date_debut", "date_fin", "created_at", "cout_total"]
    ordering         = ["-date_debut"]

    # ── Permissions ───────────────────────────────────────────────────

    def get_permissions(self):
        # Lecture : dentiste, admin, réceptionniste (read-only)
        if self.action in ("list", "retrieve", "par_patient", "par_dent", "stats"):
            classes = [IsDentisteOrAdmin | IsReceptioniste]
        else:
            # Écriture : dentiste et admin uniquement
            classes = [IsDentisteOrAdmin]

        # Permission objet pour les actions sur un traitement spécifique
        actions_objet = {
            "retrieve", "partial_update", "destroy",
            "demarrer", "terminer", "abandonner",
            "seances",
        }
        if self.action in actions_objet:
            classes.append(IsTraitementOwner)

        return [cls() for cls in classes]

    # ── Serializer ────────────────────────────────────────────────────

    def get_serializer_class(self):
        mapping = {
            "list":           TraitementListSerializer,
            "retrieve":       TraitementDetailSerializer,
            "create":         TraitementCreateSerializer,
            "partial_update": TraitementUpdateSerializer,
            "stats":          TraitementStatsSerializer,
            "abandonner":     TraitementAbandonnerSerializer,
            "par_patient":    TraitementListSerializer,
            "par_dent":       TraitementListSerializer,
        }
        return mapping.get(self.action, TraitementDetailSerializer)

    # ── QuerySet selon le rôle ────────────────────────────────────────

    def get_queryset(self):
        if not getattr(self.request, "user", None):
            return Traitement.objects.none()

        qs = Traitement.objects.actifs().select_related("patient").prefetch_related("seances")

        if _is_dentiste(self.request):
            dentiste_uuid = _to_uuid(_get_user_id(self.request))
            if not dentiste_uuid:
                return Traitement.objects.none()
            return qs.filter(dentiste_id=dentiste_uuid)

        if _is_admin(self.request):
            include_deleted = (
                self.request.query_params.get("include_deleted") == "true"
            )
            if include_deleted:
                return Traitement.all_objects.all().select_related("patient").prefetch_related("seances")
            return qs

        if _is_receptioniste(self.request):
            # Lecture seule — peut voir les traitements actifs
            return qs

        return Traitement.objects.none()

    # ── Création ──────────────────────────────────────────────────────

    def perform_create(self, serializer):
        dentiste_uuid = _to_uuid(_get_user_id(self.request))

        if _is_dentiste(self.request):
            if not dentiste_uuid:
                raise serializers.ValidationError(
                    {"detail": "ID dentiste invalide dans le token."}
                )
            # Vérifier que le patient appartient à CE dentiste
            patient = serializer.validated_data.get("patient")
            if patient and str(patient.dentiste_id) != str(dentiste_uuid):
                raise serializers.ValidationError(
                    {"patient": "Ce patient ne vous appartient pas."}
                )
            traitement = serializer.save(dentiste_id=dentiste_uuid)

        elif _is_admin(self.request):
            # Admin peut créer pour n'importe quel patient/dentiste
            patient = serializer.validated_data.get("patient")
            if not patient:
                raise serializers.ValidationError({"patient": "Ce champ est obligatoire."})
            # dentiste_id = celui du patient
            traitement = serializer.save(dentiste_id=patient.dentiste_id)

        else:
            raise serializers.ValidationError(
                {"detail": "Rôle non autorisé à créer un traitement."}
            )

        logger.info(
            "Traitement créé [dentiste=%s, patient=%s] : %s",
            dentiste_uuid,
            traitement.patient_id,
            traitement.get_type_acte_display(),
        )

    def perform_update(self, serializer):
        if _is_receptioniste(self.request):
            raise serializers.ValidationError(
                {"detail": "La réceptionniste ne peut pas modifier un traitement."}
            )
        traitement = serializer.save()
        logger.info(
            "Traitement modifié [user=%s] : %s",
            _get_user_id(self.request),
            traitement.id,
        )

    def perform_destroy(self, instance):
        if not instance.is_active:
            return
        user_uuid = _to_uuid(_get_user_id(self.request))
        instance.supprimer(deleted_by_id=user_uuid)
        logger.info(
            "Traitement supprimé [user=%s] : %s",
            _get_user_id(self.request),
            instance.id,
        )

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        self.perform_destroy(instance)
        return Response(
            {"detail": f"Traitement supprimé."},
            status=status.HTTP_200_OK,
        )

    # ── Action : statistiques ─────────────────────────────────────────

    @action(detail=False, methods=["get"], url_path="stats")
    def stats(self, request):
        """
        GET /treatments/stats/
        Tableau de bord : compteurs + chiffre d'affaires + actes fréquents.
        """
        qs = self.get_queryset()

        # Actes les plus fréquents (top 5)
        actes_qs = (
            qs.values("type_acte")
            .annotate(count=Count("id"))
            .order_by("-count")[:5]
        )
        actes_frequents = [
            {
                "type_acte": a["type_acte"],
                "label":     TypeActe(a["type_acte"]).label if a["type_acte"] in TypeActe.values else a["type_acte"],
                "count":     a["count"],
            }
            for a in actes_qs
        ]

        now = timezone.now()
        data = {
            "total":     qs.count(),
            "planifies": qs.filter(statut=StatutTraitement.PLANIFIE).count(),
            "en_cours":  qs.filter(statut=StatutTraitement.EN_COURS).count(),
            "termines":  qs.filter(statut=StatutTraitement.TERMINE).count(),
            "abandonnes": qs.filter(statut=StatutTraitement.ABANDONNE).count(),
            "ce_mois":   qs.filter(
                date_debut__year=now.year,
                date_debut__month=now.month,
            ).count(),
            "chiffre_affaires": (
                qs.filter(statut=StatutTraitement.TERMINE)
                  .aggregate(total=Sum("cout_total"))["total"]
                or Decimal("0")
            ),
            "actes_frequents": actes_frequents,
        }
        return Response(TraitementStatsSerializer(data).data)

    # ── Action : séances ──────────────────────────────────────────────

    @action(detail=True, methods=["get", "post"], url_path="seances")
    def seances(self, request, pk=None):
        """
        GET  /treatments/{id}/seances/ → liste des séances
        POST /treatments/{id}/seances/ → ajouter une séance
        """
        traitement = self.get_object()

        if request.method == "GET":
            seances_qs = traitement.seances.filter(is_active=True).order_by("numero_seance")
            return Response(SeanceSoinSerializer(seances_qs, many=True).data)

        # POST — ajouter une séance
        if _is_receptioniste(request):
            return Response(
                {"detail": "La réceptionniste ne peut pas ajouter de séance."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = SeanceSoinCreateSerializer(
            data=request.data,
            context={"traitement": traitement, "request": request},
        )
        serializer.is_valid(raise_exception=True)
        seance = serializer.save(traitement=traitement)

        # Passer automatiquement en EN_COURS si encore PLANIFIE
        if traitement.statut == StatutTraitement.PLANIFIE:
            traitement.demarrer()

        logger.info(
            "Séance %s ajoutée [traitement=%s, user=%s]",
            seance.numero_seance,
            traitement.id,
            _get_user_id(request),
        )
        return Response(
            SeanceSoinSerializer(seance).data,
            status=status.HTTP_201_CREATED,
        )

    # ── Action : démarrer ─────────────────────────────────────────────

    @action(detail=True, methods=["patch"], url_path="demarrer")
    def demarrer(self, request, pk=None):
        """PATCH /treatments/{id}/demarrer/ → PLANIFIE → EN_COURS"""
        traitement = self.get_object()

        if traitement.statut != StatutTraitement.PLANIFIE:
            return Response(
                {
                    "detail": f"Impossible de démarrer : statut actuel = {traitement.get_statut_display()}. "
                              f"Seul un traitement PLANIFIÉ peut être démarré."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        traitement.demarrer()
        logger.info("Traitement %s démarré [user=%s]", traitement.id, _get_user_id(request))
        return Response(
            {
                "detail": "Traitement démarré.",
                "statut": traitement.statut,
                "statut_label": traitement.get_statut_display(),
            }
        )

    # ── Action : terminer ─────────────────────────────────────────────

    @action(detail=True, methods=["patch"], url_path="terminer")
    def terminer(self, request, pk=None):
        """PATCH /treatments/{id}/terminer/ → TERMINE"""
        traitement = self.get_object()

        if traitement.statut == StatutTraitement.TERMINE:
            return Response(
                {"detail": "Ce traitement est déjà terminé."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if traitement.statut == StatutTraitement.ABANDONNE:
            return Response(
                {"detail": "Impossible de terminer un traitement abandonné."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        traitement.terminer()
        logger.info("Traitement %s terminé [user=%s]", traitement.id, _get_user_id(request))
        return Response(
            {
                "detail":       "Traitement terminé.",
                "statut":       traitement.statut,
                "statut_label": traitement.get_statut_display(),
                "date_fin":     traitement.date_fin,
            }
        )

    # ── Action : abandonner ───────────────────────────────────────────

    @action(detail=True, methods=["patch"], url_path="abandonner")
    def abandonner(self, request, pk=None):
        """PATCH /treatments/{id}/abandonner/ — raison obligatoire"""
        traitement = self.get_object()

        if traitement.statut in (StatutTraitement.TERMINE, StatutTraitement.ABANDONNE):
            return Response(
                {
                    "detail": f"Impossible d'abandonner : statut = {traitement.get_statut_display()}."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = TraitementAbandonnerSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        raison = serializer.validated_data["raison_abandon"]

        traitement.abandonner(raison=raison)
        logger.info(
            "Traitement %s abandonné [user=%s] — %s",
            traitement.id, _get_user_id(request), raison[:50],
        )
        return Response(
            {
                "detail":         "Traitement abandonné.",
                "statut":         traitement.statut,
                "raison_abandon": traitement.raison_abandon,
            }
        )

    # ── Action : par patient ──────────────────────────────────────────

    @action(detail=False, methods=["get"], url_path="par-patient/(?P<patient_id>[^/.]+)")
    def par_patient(self, request, patient_id=None):
        """
        GET /treatments/par-patient/{patient_id}/
        Liste tous les traitements d'un patient (utilisé dans le dossier).
        Vérifie que le dentiste a accès à ce patient.
        """
        patient_uuid = _to_uuid(patient_id)
        if not patient_uuid:
            return Response(
                {"detail": "UUID patient invalide."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Vérifier l'accès au patient
        try:
            if _is_dentiste(request):
                dentiste_uuid = _to_uuid(_get_user_id(request))
                patient = Patient.objects.get(pk=patient_uuid, dentiste_id=dentiste_uuid)
            elif _is_admin(request):
                patient = Patient.objects.get(pk=patient_uuid)
            else:
                # Réceptionniste → peut voir (lecture seule)
                patient = Patient.objects.actifs().get(pk=patient_uuid)
        except Patient.DoesNotExist:
            return Response(
                {"detail": "Patient introuvable ou accès non autorisé."},
                status=status.HTTP_404_NOT_FOUND,
            )

        traitements = (
            Traitement.objects
            .du_patient(patient_uuid)
            .select_related("patient")
            .prefetch_related("seances")
            .order_by("-date_debut")
        )
        serializer = TraitementListSerializer(traitements, many=True)
        return Response(serializer.data)

    # ── Action : par dent ─────────────────────────────────────────────

    @action(detail=False, methods=["get"], url_path="par-dent/(?P<numero_dent>[^/.]+)")
    def par_dent(self, request, numero_dent=None):
        """
        GET /treatments/par-dent/{numero_dent}/
        Historique de tous les traitements sur une dent précise.
        Utile pour le Dental Chart (D-07).
        """
        qs = self.get_queryset().filter(dent=numero_dent).order_by("-date_debut")
        serializer = TraitementListSerializer(qs, many=True)
        return Response(serializer.data)