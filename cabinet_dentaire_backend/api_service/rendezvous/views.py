"""
rendezvous/views.py — api_service
=====================================
RendezVousViewSet — gestion complète des rendez-vous.

Checklist couverte :
  T-05 — CRUD RDV avec liaison obligatoire au patient
  R-06 — Création par réceptionniste → validation dentiste (statut PENDING)
  R-07 — États pending/accepté/refusé + notifications automatiques via RabbitMQ
  D-01 — stats() pour tableau de bord (total RDV, RDV du jour, en attente)
  D-04 — RDV visibles dans le dossier patient (via patients/views.py)
  N-01 — Notifications temps réel via RabbitMQ (publish_notification)
  N-05 — Tâches asynchrones Celery (rappels de RDV)
  A-05 — Isolation stricte par dentiste

Cohérence avec patients/views.py :
  - Même helpers _is_dentiste / _is_admin / _is_receptioniste
  - Même _to_uuid()
  - Même pattern perform_create selon le rôle
  - Même pattern RabbitMQ transaction.on_commit
  - Même pattern d'actions custom DRF
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

from .models import RendezVous, StatutRDV
from .permissions import (
    IsDentisteOrAdmin,
    IsDentisteOrReceptionniste,
    IsRDVOwner,
    IsReceptionniste,
    _get_role,
    _get_user_id,
)
from .serializers import (
    RendezVousAnnulationSerializer,
    RendezVousCalendarSerializer,
    RendezVousCreateUpdateSerializer,
    RendezVousDetailSerializer,
    RendezVousListSerializer,
    RendezVousStatsSerializer,
    RendezVousValidationSerializer,
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


# ── ViewSet ───────────────────────────────────────────────────────────────────

class RendezVousViewSet(ModelViewSet):
    """
    ViewSet complet — rendez-vous du cabinet dentaire.

    Endpoints (Router DRF) :
      GET    /rendezvous/                → liste paginée
      POST   /rendezvous/                → créer
      GET    /rendezvous/{id}/           → fiche détaillée
      PATCH  /rendezvous/{id}/           → modifier
      DELETE /rendezvous/{id}/           → annuler (soft delete)

    Actions custom :
      GET    /rendezvous/stats/          → statistiques tableau de bord (D-01)
      GET    /rendezvous/calendar/       → vue calendrier / agenda
      PATCH  /rendezvous/{id}/valider/   → accepter ou refuser (dentiste, R-06/R-07)
      PATCH  /rendezvous/{id}/annuler/   → annulation avec raison
      PATCH  /rendezvous/{id}/terminer/  → marquer comme terminé
    """

    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    filter_backends  = [SearchFilter, DjangoFilterBackend, OrderingFilter]
    search_fields    = ["patient__nom", "patient__prenom", "motif"]
    filterset_fields = ["statut", "type_soin", "priorite"]
    ordering_fields  = ["date_heure", "created_at", "statut"]
    ordering         = ["-date_heure"]

    # ── Permissions ───────────────────────────────────────────────────

    def get_permissions(self):
        if self.action == "create":
            classes = [IsDentisteOrReceptionniste]
        elif self.action in ("stats", "calendar", "list"):
            classes = [IsDentisteOrReceptionniste]
        else:
            classes = [IsDentisteOrAdmin]

        actions_objet = {
            "retrieve", "update", "partial_update", "destroy",
            "valider", "annuler", "terminer",
        }
        if self.action in actions_objet:
            classes.append(IsRDVOwner)

        return [cls() for cls in classes]

    # ── Serializer ────────────────────────────────────────────────────

    def get_serializer_class(self):
        mapping = {
            "list":           RendezVousListSerializer,
            "create":         RendezVousCreateUpdateSerializer,
            "update":         RendezVousCreateUpdateSerializer,
            "partial_update": RendezVousCreateUpdateSerializer,
            "stats":          RendezVousStatsSerializer,
            "valider":        RendezVousValidationSerializer,
            "annuler":        RendezVousAnnulationSerializer,
            "calendar":       RendezVousCalendarSerializer,
        }
        return mapping.get(self.action, RendezVousDetailSerializer)

    def get_serializer_context(self):
        """
        Injecte dentiste_id dans le contexte pour la validation
        de chevauchement des créneaux (serializers.py → validate()).
        """
        ctx = super().get_serializer_context()
        if _is_dentiste(self.request):
            ctx["dentiste_id"] = _get_user_id(self.request)
        return ctx

    # ── QuerySet selon le rôle ────────────────────────────────────────

    def get_queryset(self):
        if not getattr(self.request, "user", None):
            return RendezVous.objects.none()

        qs = RendezVous.objects.actifs().select_related("patient")

        if _is_dentiste(self.request):
            dentiste_uuid = _to_uuid(_get_user_id(self.request))
            if not dentiste_uuid:
                return RendezVous.objects.none()
            qs = qs.filter(dentiste_id=dentiste_uuid)

        elif _is_receptioniste(self.request):
            # La réceptionniste voit tous les RDV actifs (lecture seule)
            pass

        elif _is_admin(self.request):
            include_cancelled = (
                self.request.query_params.get("include_cancelled") == "true"
            )
            if include_cancelled:
                qs = RendezVous.all_objects.all().select_related("patient")

        else:
            return RendezVous.objects.none()

        # ── Filtres additionnels via query params ─────────────────────
        patient_id = self.request.query_params.get("patient_id")
        if patient_id:
            patient_uuid = _to_uuid(patient_id)
            if patient_uuid:
                qs = qs.filter(patient_id=patient_uuid)

        date_debut = self.request.query_params.get("date_debut")
        date_fin   = self.request.query_params.get("date_fin")
        if date_debut:
            qs = qs.filter(date_heure__date__gte=date_debut)
        if date_fin:
            qs = qs.filter(date_heure__date__lte=date_fin)

        aujourd_hui_only = self.request.query_params.get("aujourd_hui") == "true"
        if aujourd_hui_only:
            qs = qs.filter(date_heure__date=timezone.now().date())

        return qs

    # ── CRUD ──────────────────────────────────────────────────────────

    def perform_create(self, serializer):
        """
        Checklist R-06 :
          Réceptionniste → statut PENDING, notification au dentiste
          Dentiste       → statut ACCEPTE directement
          Admin          → statut ACCEPTE, dentiste_id requis dans le body
        """
        if _is_dentiste(self.request):
            dentiste_uuid = _to_uuid(_get_user_id(self.request))
            if not dentiste_uuid:
                raise serializers.ValidationError(
                    {"detail": "ID dentiste invalide dans le token."}
                )
            rdv = serializer.save(
                dentiste_id=dentiste_uuid,
                statut=StatutRDV.ACCEPTE,
            )
            logger.info(
                "RDV créé [dentiste=%s] patient=%s date=%s",
                dentiste_uuid, rdv.patient_id, rdv.date_heure,
            )

        elif _is_receptioniste(self.request):
            dentiste_id_raw = self.request.data.get("dentiste_id")
            if not dentiste_id_raw:
                raise serializers.ValidationError(
                    {"dentiste_id": "Ce champ est obligatoire pour la réceptionniste."}
                )
            dentiste_uuid = _to_uuid(dentiste_id_raw)
            if not dentiste_uuid:
                raise serializers.ValidationError(
                    {"dentiste_id": "UUID invalide."}
                )

            # Vérifier que le patient appartient bien à ce dentiste
            patient = serializer.validated_data.get("patient")
            if patient and str(patient.dentiste_id) != str(dentiste_uuid):
                raise serializers.ValidationError({
                    "patient": "Ce patient n'appartient pas au dentiste sélectionné."
                })

            # Vérifier que le dentiste est actif dans auth_service
            from common.services import verifier_dentiste_actif
            if not verifier_dentiste_actif(str(dentiste_uuid)):
                raise serializers.ValidationError(
                    {"dentiste_id": "Dentiste introuvable ou inactif dans le système."}
                )

            receptionniste_uuid = _to_uuid(_get_user_id(self.request))
            self._receptionniste_nom = getattr(self.request.user, "full_name", "")

            rdv = serializer.save(
                dentiste_id=dentiste_uuid,
                receptionniste_id=receptionniste_uuid,
                statut=StatutRDV.PENDING,
            )
            logger.info(
                "RDV en attente [receptionniste=%s → dentiste=%s] patient=%s date=%s",
                receptionniste_uuid, dentiste_uuid, rdv.patient_id, rdv.date_heure,
            )
            transaction.on_commit(
                lambda: self._notifier_dentiste_nouveau_rdv(rdv)
            )

        elif _is_admin(self.request):
            dentiste_id_raw = self.request.data.get("dentiste_id")
            dentiste_uuid   = _to_uuid(dentiste_id_raw) if dentiste_id_raw else None
            if not dentiste_uuid:
                raise serializers.ValidationError(
                    {"dentiste_id": "Ce champ est obligatoire."}
                )
            rdv = serializer.save(
                dentiste_id=dentiste_uuid,
                statut=StatutRDV.ACCEPTE,
            )
            logger.info(
                "RDV créé [admin=%s] patient=%s date=%s",
                _get_user_id(self.request), rdv.patient_id, rdv.date_heure,
            )
        else:
            raise serializers.ValidationError(
                {"detail": "Rôle non autorisé à créer un rendez-vous."}
            )

    def perform_update(self, serializer):
        """
        Seul le dentiste propriétaire ou l'admin peut modifier un RDV.
        La réceptionniste ne peut pas modifier (permission gérée en amont).
        """
        if _is_receptioniste(self.request):
            raise serializers.ValidationError(
                {"detail": "La réceptionniste ne peut pas modifier un rendez-vous."}
            )
        rdv = serializer.save()
        logger.info(
            "RDV modifié [user=%s] rdv=%s",
            _get_user_id(self.request), rdv.id,
        )

    def perform_destroy(self, instance):
        """DELETE → annulation soft (is_active=False, statut=ANNULE)."""
        if not instance.is_active:
            return
        instance.annuler(
            annule_par_id=_to_uuid(_get_user_id(self.request)),
            raison="Supprimé via DELETE",
        )
        logger.info(
            "RDV annulé via DELETE [user=%s] rdv=%s",
            _get_user_id(self.request), instance.id,
        )

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        self.perform_destroy(instance)
        return Response(
            {"detail": "Rendez-vous annulé."},
            status=status.HTTP_200_OK,
        )

    # ── Action : statistiques (D-01) ──────────────────────────────────

    @action(detail=False, methods=["get"], url_path="stats")
    def stats(self, request):
        """
        Tableau de bord — checklist D-01 :
          total RDV, RDV du jour, en attente, cette semaine, ce mois, etc.
        """
        qs = self.get_queryset()

        # Pour le dentiste, on a déjà le filtre dentiste_id dans get_queryset
        all_qs = qs  # actifs uniquement

        data = {
            "total":         all_qs.count(),
            "aujourd_hui":   all_qs.du_jour().count(),
            "cette_semaine": all_qs.cette_semaine().count(),
            "ce_mois":       all_qs.ce_mois().count(),
            "en_attente":    all_qs.en_attente().count(),
            "acceptes":      all_qs.acceptes().count(),
            "refuses":       all_qs.filter(statut=StatutRDV.REFUSE).count(),
            "annules":       all_qs.filter(statut=StatutRDV.ANNULE).count(),
            "termines":      all_qs.filter(statut=StatutRDV.TERMINE).count(),
            "urgents":       all_qs.urgents().count(),
            "a_venir":       all_qs.a_venir().count(),
        }
        return Response(RendezVousStatsSerializer(data).data)

    # ── Action : calendrier ───────────────────────────────────────────

    @action(detail=False, methods=["get"], url_path="calendar")
    def calendar(self, request):
        """
        Vue calendrier — format FullCalendar.
        Accepte date_debut / date_fin en query params (YYYY-MM-DD).
        """
        qs = self.get_queryset().filter(is_active=True)

        # Filtre plage de dates obligatoire pour le calendrier
        date_debut = request.query_params.get("date_debut")
        date_fin   = request.query_params.get("date_fin")

        if not date_debut or not date_fin:
            # Par défaut : mois courant
            now        = timezone.now()
            date_debut = now.replace(day=1).date().isoformat()
            import calendar as cal_module
            last_day   = cal_module.monthrange(now.year, now.month)[1]
            date_fin   = now.replace(day=last_day).date().isoformat()

        qs = qs.filter(
            date_heure__date__gte=date_debut,
            date_heure__date__lte=date_fin,
        )

        serializer = RendezVousCalendarSerializer(
            qs, many=True, context={"request": request}
        )
        return Response(serializer.data)

    # ── Action : valider (R-06, R-07) ─────────────────────────────────

    @action(detail=True, methods=["patch"], url_path="valider")
    def valider(self, request, pk=None):
        """
        Validation du RDV par le dentiste.
        Checklist R-06 — validation obligatoire après création par réceptionniste.
        Checklist R-07 — notifications automatiques selon la décision.
        """
        rdv = self.get_object()

        if rdv.statut != StatutRDV.PENDING:
            return Response(
                {"detail": "Ce rendez-vous n'est pas en attente de validation."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = RendezVousValidationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        decision = serializer.validated_data["decision"]
        raison   = serializer.validated_data.get("refuse_raison", "")

        with transaction.atomic():
            if decision == "ACCEPTE":
                rdv.accepter()
                transaction.on_commit(
                    lambda: self._notifier_rdv_validation(rdv, accepte=True)
                )
                logger.info(
                    "RDV %s accepté [dentiste=%s]", rdv.id, _get_user_id(request)
                )
                return Response(
                    {
                        "detail": "Rendez-vous accepté.",
                        "rdv_id": str(rdv.id),
                        "statut": rdv.statut,
                    },
                    status=status.HTTP_200_OK,
                )
            else:
                rdv.refuser(raison=raison)
                transaction.on_commit(
                    lambda: self._notifier_rdv_validation(rdv, accepte=False)
                )
                logger.info(
                    "RDV %s refusé [dentiste=%s]", rdv.id, _get_user_id(request)
                )
                return Response(
                    {
                        "detail": "Rendez-vous refusé.",
                        "rdv_id": str(rdv.id),
                        "statut": rdv.statut,
                        "raison": raison,
                    },
                    status=status.HTTP_200_OK,
                )

    # ── Action : annuler ──────────────────────────────────────────────

    @action(detail=True, methods=["patch"], url_path="annuler")
    def annuler(self, request, pk=None):
        """Annulation explicite avec raison optionnelle."""
        rdv = self.get_object()

        if rdv.statut == StatutRDV.ANNULE:
            return Response(
                {"detail": "Ce rendez-vous est déjà annulé."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if rdv.statut == StatutRDV.TERMINE:
            return Response(
                {"detail": "Impossible d'annuler un rendez-vous terminé."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = RendezVousAnnulationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        raison = serializer.validated_data.get("raison", "")

        with transaction.atomic():
            rdv.annuler(
                annule_par_id=_to_uuid(_get_user_id(request)),
                raison=raison,
            )
            transaction.on_commit(
                lambda: self._notifier_rdv_annulation(rdv)
            )

        logger.info(
            "RDV %s annulé [user=%s]", rdv.id, _get_user_id(request)
        )
        return Response(
            {"detail": "Rendez-vous annulé.", "raison": raison},
            status=status.HTTP_200_OK,
        )

    # ── Action : terminer ─────────────────────────────────────────────

    @action(detail=True, methods=["patch"], url_path="terminer")
    def terminer(self, request, pk=None):
        """Marque le RDV comme terminé — réservé au dentiste."""
        if not (_is_dentiste(request) or _is_admin(request)):
            return Response(
                {"detail": "Accès réservé aux dentistes."},
                status=status.HTTP_403_FORBIDDEN,
            )

        rdv = self.get_object()

        if rdv.statut != StatutRDV.ACCEPTE:
            return Response(
                {"detail": "Seul un rendez-vous accepté peut être marqué comme terminé."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        rdv.marquer_termine()
        logger.info(
            "RDV %s terminé [dentiste=%s]", rdv.id, _get_user_id(request)
        )
        return Response(
            {"detail": "Rendez-vous marqué comme terminé.", "statut": rdv.statut},
            status=status.HTTP_200_OK,
        )

    # ── Notifications RabbitMQ ────────────────────────────────────────

    def _notifier_dentiste_nouveau_rdv(self, rdv: RendezVous) -> None:
        """
        Notifie le dentiste qu'un nouveau RDV est en attente de validation.
        Checklist R-06 — création par réceptionniste.
        """
        try:
            from common.rabbitmq import publish_notification
            publish_notification("RDV_EN_ATTENTE", {
                "dentiste_id":       str(rdv.dentiste_id),
                "rdv_id":            str(rdv.id),
                "patient_id":        str(rdv.patient_id),
                "patient_nom":       rdv.patient.nom_complet,
                "date_heure":        rdv.date_heure.isoformat(),
                "type_soin":         rdv.type_soin,
                "priorite":          rdv.priorite,
                "receptionniste_id": str(rdv.receptionniste_id) if rdv.receptionniste_id else None,
                "receptionniste_nom": getattr(self, "_receptionniste_nom", ""),
            })
        except Exception as exc:
            logger.error("RabbitMQ [RDV_EN_ATTENTE] : %s", exc)

    def _notifier_rdv_validation(self, rdv: RendezVous, accepte: bool) -> None:
        """
        Notifie la réceptionniste de la décision du dentiste.
        Checklist R-07 — notification automatique accepté/refusé.
        """
        try:
            from common.rabbitmq import publish_notification
            event_type = "RDV_ACCEPTE" if accepte else "RDV_REFUSE"
            publish_notification(event_type, {
                "dentiste_id":       str(rdv.dentiste_id),
                "rdv_id":            str(rdv.id),
                "patient_id":        str(rdv.patient_id),
                "patient_nom":       rdv.patient.nom_complet,
                "date_heure":        rdv.date_heure.isoformat(),
                "type_soin":         rdv.type_soin,
                "statut":            rdv.statut,
                "refuse_raison":     rdv.refuse_raison,
                "receptionniste_id": str(rdv.receptionniste_id) if rdv.receptionniste_id else None,
            })
        except Exception as exc:
            logger.error("RabbitMQ [RDV_VALIDATION] : %s", exc)

    def _notifier_rdv_annulation(self, rdv: RendezVous) -> None:
        """Notifie les parties concernées lors d'une annulation."""
        try:
            from common.rabbitmq import publish_notification
            publish_notification("RDV_ANNULE", {
                "dentiste_id":       str(rdv.dentiste_id),
                "rdv_id":            str(rdv.id),
                "patient_id":        str(rdv.patient_id),
                "patient_nom":       rdv.patient.nom_complet,
                "date_heure":        rdv.date_heure.isoformat(),
                "refuse_raison":     rdv.refuse_raison,
                "receptionniste_id": str(rdv.receptionniste_id) if rdv.receptionniste_id else None,
            })
        except Exception as exc:
            logger.error("RabbitMQ [RDV_ANNULE] : %s", exc)