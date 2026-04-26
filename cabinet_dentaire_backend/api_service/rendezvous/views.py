"""
rendezvous/views.py — api_service
✅ CORRIGÉ :
  - valider/ retourne le RDV sérialisé complet
  - dentiste_nom transmis dans le payload RabbitMQ
  - Variables capturées correctement avant les lambdas
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


class RendezVousViewSet(ModelViewSet):

    http_method_names = ["get", "post", "patch", "delete", "head", "options"]
    filter_backends   = [SearchFilter, DjangoFilterBackend, OrderingFilter]
    search_fields     = ["patient__nom", "patient__prenom", "motif"]
    filterset_fields  = ["statut", "type_soin", "priorite"]
    ordering_fields   = ["date_heure", "created_at", "statut"]
    ordering          = ["-date_heure"]

    def get_permissions(self):
        if self.action in ("create", "stats", "calendar", "list"):
            classes = [IsDentisteOrReceptionniste]
        elif self.action == "annuler":
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
        ctx = super().get_serializer_context()
        if _is_dentiste(self.request):
            ctx["dentiste_id"] = _get_user_id(self.request)
        return ctx

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
            pass  # voit tous les RDV actifs

        elif _is_admin(self.request):
            include_cancelled = (
                self.request.query_params.get("include_cancelled") == "true"
            )
            if include_cancelled:
                qs = RendezVous.all_objects.all().select_related("patient")
        else:
            return RendezVous.objects.none()

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

        if self.request.query_params.get("aujourd_hui") == "true":
            qs = qs.filter(date_heure__date=timezone.now().date())

        return qs

    # ── CRUD ──────────────────────────────────────────────────────────

    def perform_create(self, serializer):
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
            patient = serializer.validated_data.get("patient")
            if not patient:
                raise serializers.ValidationError({"patient": "Patient requis."})

            dentiste_uuid = _to_uuid(patient.dentiste_id)
            if not dentiste_uuid:
                raise serializers.ValidationError(
                    {"patient": "Ce patient n'a pas de dentiste référent assigné."}
                )

            receptionniste_uuid = _to_uuid(_get_user_id(self.request))
            receptionniste_nom  = getattr(self.request.user, "full_name", "") or ""

            rdv = serializer.save(
                dentiste_id       = dentiste_uuid,
                receptionniste_id = receptionniste_uuid,
                statut            = StatutRDV.PENDING,
            )
            logger.info(
                "RDV en attente [receptionniste=%s → dentiste=%s] patient=%s date=%s",
                receptionniste_uuid, dentiste_uuid, rdv.patient_id, rdv.date_heure,
            )

            # ✅ Capturer les variables avant le lambda
            _rdv                = rdv
            _receptionniste_nom = receptionniste_nom
            transaction.on_commit(
                lambda: _notifier_dentiste_nouveau_rdv(
                    _rdv, receptionniste_nom=_receptionniste_nom
                )
            )

        elif _is_admin(self.request):
            dentiste_id_raw = self.request.data.get("dentiste_id")
            dentiste_uuid   = _to_uuid(dentiste_id_raw) if dentiste_id_raw else None
            if not dentiste_uuid:
                raise serializers.ValidationError(
                    {"dentiste_id": "Ce champ est obligatoire pour l'admin."}
                )
            rdv = serializer.save(
                dentiste_id=dentiste_uuid,
                statut=StatutRDV.ACCEPTE,
            )
        else:
            raise serializers.ValidationError(
                {"detail": "Rôle non autorisé à créer un rendez-vous."}
            )

    def perform_update(self, serializer):
        if _is_receptioniste(self.request):
            raise serializers.ValidationError(
                {"detail": "La réceptionniste ne peut pas modifier un rendez-vous."}
            )
        rdv = serializer.save()
        logger.info("RDV modifié [user=%s] rdv=%s", _get_user_id(self.request), rdv.id)

    def perform_destroy(self, instance):
        if not instance.is_active:
            return
        instance.annuler(
            annule_par_id=_to_uuid(_get_user_id(self.request)),
            raison="Supprimé via DELETE",
        )

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        self.perform_destroy(instance)
        return Response({"detail": "Rendez-vous annulé."}, status=status.HTTP_200_OK)

    # ── Action : stats ────────────────────────────────────────────────

    @action(detail=False, methods=["get"], url_path="stats")
    def stats(self, request):
        qs   = self.get_queryset()
        data = {
            "total":         qs.count(),
            "aujourd_hui":   qs.du_jour().count(),
            "cette_semaine": qs.cette_semaine().count(),
            "ce_mois":       qs.ce_mois().count(),
            "en_attente":    qs.en_attente().count(),
            "acceptes":      qs.acceptes().count(),
            "refuses":       qs.filter(statut=StatutRDV.REFUSE).count(),
            "annules":       qs.filter(statut=StatutRDV.ANNULE).count(),
            "termines":      qs.filter(statut=StatutRDV.TERMINE).count(),
            "urgents":       qs.urgents().count(),
            "a_venir":       qs.a_venir().count(),
        }
        return Response(RendezVousStatsSerializer(data).data)

    # ── Action : calendrier ───────────────────────────────────────────

    @action(detail=False, methods=["get"], url_path="calendar")
    def calendar(self, request):
        qs = self.get_queryset().filter(is_active=True)

        date_debut = request.query_params.get("date_debut")
        date_fin   = request.query_params.get("date_fin")

        if not date_debut or not date_fin:
            now        = timezone.now()
            date_debut = now.replace(day=1).date().isoformat()
            import calendar as cal_module
            last_day   = cal_module.monthrange(now.year, now.month)[1]
            date_fin   = now.replace(day=last_day).date().isoformat()

        qs = qs.filter(
            date_heure__date__gte=date_debut,
            date_heure__date__lte=date_fin,
        )
        return Response(
            RendezVousCalendarSerializer(qs, many=True, context={"request": request}).data
        )

    # ── Action : valider ──────────────────────────────────────────────

    @action(detail=True, methods=["patch"], url_path="valider")
    def valider(self, request, pk=None):
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

        # ✅ Capturer dentiste_nom depuis le token AVANT la transaction
        dentiste_nom = getattr(request.user, "full_name", "") or ""

        with transaction.atomic():
            if decision == "ACCEPTE":
                rdv.accepter()
            else:
                rdv.refuser(raison=raison)

            # ✅ Capturer toutes les variables avant le lambda
            _rdv          = rdv
            _accepte      = (decision == "ACCEPTE")
            _dentiste_nom = dentiste_nom

            transaction.on_commit(
                lambda: _notifier_rdv_validation(
                    _rdv,
                    accepte=_accepte,
                    dentiste_nom=_dentiste_nom,
                )
            )

            logger.info(
                "RDV %s %s [dentiste=%s]",
                rdv.id,
                "accepté" if decision == "ACCEPTE" else "refusé",
                _get_user_id(request),
            )

        # ✅ Retourne le RDV sérialisé complet avec le nouveau statut
        rdv.refresh_from_db()
        return Response(
            RendezVousListSerializer(rdv, context={"request": request}).data,
            status=status.HTTP_200_OK,
        )

    # ── Action : annuler ──────────────────────────────────────────────

    @action(detail=True, methods=["patch"], url_path="annuler")
    def annuler(self, request, pk=None):
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
            _rdv = rdv
            transaction.on_commit(lambda: _notifier_rdv_annulation(_rdv))

        return Response({"detail": "Rendez-vous annulé.", "raison": raison})

    # ── Action : terminer ─────────────────────────────────────────────

    @action(detail=True, methods=["patch"], url_path="terminer")
    def terminer(self, request, pk=None):
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
        return Response({"detail": "Rendez-vous marqué comme terminé.", "statut": rdv.statut})


# ── Fonctions notification (hors classe — évite closures sur self) ────────────

def _notifier_dentiste_nouveau_rdv(
    rdv: RendezVous,
    receptionniste_nom: str = "",
) -> None:
    """Notifie le dentiste d'un nouveau RDV en attente."""
    try:
        from common.rabbitmq import publish_notification
        publish_notification("RDV_EN_ATTENTE", {
            "dentiste_id":        str(rdv.dentiste_id),
            "rdv_id":             str(rdv.id),
            "patient_id":         str(rdv.patient_id),
            "patient_nom":        rdv.patient.nom_complet,
            "date_heure":         rdv.date_heure.isoformat(),
            "type_soin":          rdv.type_soin,
            "priorite":           rdv.priorite,
            "receptionniste_id":  str(rdv.receptionniste_id) if rdv.receptionniste_id else None,
            "receptionniste_nom": receptionniste_nom,
        })
        logger.info(
            "Notification RDV_EN_ATTENTE → dentiste=%s", rdv.dentiste_id
        )
    except Exception as exc:
        logger.error("RabbitMQ [RDV_EN_ATTENTE] : %s", exc)


def _notifier_rdv_validation(
    rdv: RendezVous,
    accepte: bool,
    dentiste_nom: str = "",
) -> None:
    """
    Notifie le réceptionniste du résultat de la validation.
    ✅ receptionniste_id vérifié avant envoi.
    ✅ rdv.refresh_from_db() pour avoir le statut final.
    """
    try:
        rdv.refresh_from_db()

        if not rdv.receptionniste_id:
            logger.info(
                "RDV %s sans réceptionniste — notification ignorée", rdv.id
            )
            return

        from common.rabbitmq import publish_notification
        event_type = "RDV_VALIDE" if accepte else "RDV_REFUSE"

        publish_notification(event_type, {
            # ✅ destinataire = réceptionniste
            "receptionniste_id": str(rdv.receptionniste_id),
            "dentiste_id":       str(rdv.dentiste_id),
            "dentiste_nom":      dentiste_nom,
            "rdv_id":            str(rdv.id),
            "patient_id":        str(rdv.patient_id),
            "patient_nom":       rdv.patient.nom_complet,
            "date_heure":        rdv.date_heure.isoformat(),
            "type_soin":         rdv.type_soin,
            "statut":            rdv.statut,
            "refuse_raison":     rdv.refuse_raison,
        })
        logger.info(
            "Notification %s → receptionniste=%s", event_type, rdv.receptionniste_id
        )
    except Exception as exc:
        logger.error("RabbitMQ [RDV_VALIDATION] : %s", exc)


def _notifier_rdv_annulation(rdv: RendezVous) -> None:
    """Notifie le dentiste d'une annulation."""
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