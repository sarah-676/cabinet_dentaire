"""
patients/views.py — api_service
==================================
PatientViewSet — gestion complète des patients.

Corrections appliquées :
  1. _get_user_id() retourne UUID str → comparaison str(obj.dentiste_id)
  2. verifier_dentiste_actif() accepte UUID str
  3. dentiste_id injecté comme UUID (str converti en UUID)
  4. _is_receptioniste → "receptionniste" (orthographe auth_service)
  5. RabbitMQ → common.rabbitmq.publish_notification (raccourci)
"""

import logging
import uuid as uuid_module

from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet
from django_filters.rest_framework import DjangoFilterBackend

from .models import Patient, StatutValidation
from .permissions import (
    IsDentisteOrAdmin,
    IsDentisteOrReceptionniste,
    IsPatientOwner,
    IsReceptioniste,
    _get_role,
    _get_user_id,
)
from .serializers import (
    PatientCreateUpdateSerializer,
    PatientDetailSerializer,
    PatientListSerializer,
    PatientStatsSerializer,
    PatientValidationSerializer,
)

logger = logging.getLogger(__name__)


# ── Helpers locaux ────────────────────────────────────────────────────────────

def _is_dentiste(request)       -> bool: return _get_role(request) == "dentiste"
def _is_admin(request)          -> bool: return _get_role(request) == "admin"
def _is_receptioniste(request)  -> bool: return _get_role(request) == "receptionniste"


def _q_alertes_actives() -> Q:
    """Q pour filtrer les patients ayant au moins une alerte médicale active."""
    return (
        Q(alerte_anticoagulants=True)
        | Q(alerte_diabete=True)
        | Q(alerte_grossesse=True)
        | Q(alerte_allergie_latex=True)
        | Q(alerte_cardiopathie=True)
        | Q(alerte_immunodeprime=True)
    )


def _to_uuid(value) -> uuid_module.UUID | None:
    """Convertit une valeur en UUID. Retourne None si invalide."""
    if isinstance(value, uuid_module.UUID):
        return value
    try:
        return uuid_module.UUID(str(value))
    except (ValueError, AttributeError):
        return None


# ── ViewSet ───────────────────────────────────────────────────────────────────

class PatientViewSet(ModelViewSet):
    """
    ViewSet complet — patients du cabinet dentaire.

    Endpoints (Router DRF) :
      GET    /patients/                  → liste paginée
      POST   /patients/                  → créer
      GET    /patients/{id}/             → fiche détaillée
      PATCH  /patients/{id}/             → modifier
      DELETE /patients/{id}/             → archiver (soft delete)

    Actions custom :
      GET    /patients/stats/            → statistiques tableau de bord
      GET    /patients/{id}/dossier/     → dossier complet
      PATCH  /patients/{id}/valider/     → accepter/refuser (dentiste)
      PATCH  /patients/{id}/archiver/    → archiver explicitement
      PATCH  /patients/{id}/restaurer/   → réactiver (admin/dentiste)
      PATCH  /patients/{id}/note/        → auto-save note libre
    """

    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    filter_backends  = [SearchFilter, DjangoFilterBackend, OrderingFilter]
    search_fields    = ["nom", "prenom", "telephone", "email"]
    filterset_fields = ["statut", "groupe_sanguin", "sexe"]
    ordering_fields  = ["nom", "prenom", "created_at", "date_naissance"]
    ordering         = ["-created_at"]

    # ── Permissions ───────────────────────────────────────────────────

    def get_permissions(self):
        if self.action == "create":
            classes = [IsDentisteOrReceptionniste]
        else:
            classes = [IsDentisteOrReceptionniste]

        actions_objet = {
            "retrieve", "update", "partial_update", "destroy",
            "dossier", "archiver", "note", "valider",
        }
        if self.action in actions_objet:
            classes.append(IsPatientOwner)

        return [cls() for cls in classes]

    # ── Serializer ────────────────────────────────────────────────────

    def get_serializer_class(self):
        mapping = {
            "list":           PatientListSerializer,
            "create":         PatientCreateUpdateSerializer,
            "update":         PatientCreateUpdateSerializer,
            "partial_update": PatientCreateUpdateSerializer,
            "note":           PatientCreateUpdateSerializer,
            "stats":          PatientStatsSerializer,
            "valider":        PatientValidationSerializer,
        }
        return mapping.get(self.action, PatientDetailSerializer)

    # ── QuerySet selon le rôle ────────────────────────────────────────

    def get_queryset(self):
        if not getattr(self.request, "user", None):
            return Patient.objects.none()

        if _is_dentiste(self.request):
            dentiste_uuid = _to_uuid(_get_user_id(self.request))
            if not dentiste_uuid:
                return Patient.objects.none()
            return Patient.objects.du_dentiste(dentiste_uuid)

        if _is_admin(self.request):
            include_archived = (
                self.request.query_params.get("include_archived") == "true"
            )
            return (
                Patient.all_objects.all()
                if include_archived
                else Patient.objects.actifs()
            )

        if _is_receptioniste(self.request):
            return Patient.objects.actifs()

        return Patient.objects.none()

    # ── CRUD ──────────────────────────────────────────────────────────

    def perform_create(self, serializer):
        if _is_dentiste(self.request):
            dentiste_uuid = _to_uuid(_get_user_id(self.request))
            if not dentiste_uuid:
                raise serializers.ValidationError(
                    {"detail": "ID dentiste invalide dans le token."}
                )
            patient = serializer.save(
                dentiste_id=dentiste_uuid,
                statut=StatutValidation.ACCEPTE,
            )
            logger.info(
                "Patient créé [dentiste=%s] : %s",
                dentiste_uuid,
                patient.nom_complet,
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
                    {"dentiste_id": "UUID invalide. Format attendu : xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"}
                )

            # Vérifier que ce dentiste existe et est actif dans auth_service
            from common.services import verifier_dentiste_actif
            if not verifier_dentiste_actif(str(dentiste_uuid)):
                raise serializers.ValidationError(
                    {"dentiste_id": "Dentiste introuvable ou inactif dans le système."}
                )

            patient = serializer.save(
                dentiste_id=dentiste_uuid,
                statut=StatutValidation.PENDING,
                receptionniste_id=_to_uuid(_get_user_id(self.request)),
            )
            self._receptionniste_nom = getattr(self.request.user, "full_name", "")
            logger.info(
                "Patient en attente [receptionniste=%s → dentiste=%s] : %s",
                _get_user_id(self.request),
                dentiste_uuid,
                patient.nom_complet,
            )
            transaction.on_commit(
                lambda: self._notifier_dentiste_nouveau_patient(patient)
            )

        elif _is_admin(self.request):
            dentiste_id_raw = self.request.data.get("dentiste_id")
            dentiste_uuid   = _to_uuid(dentiste_id_raw) if dentiste_id_raw else None
            if not dentiste_uuid:
                raise serializers.ValidationError(
                    {"dentiste_id": "Ce champ est obligatoire."}
                )
            patient = serializer.save(
                dentiste_id=dentiste_uuid,
                statut=StatutValidation.ACCEPTE,
            )
            logger.info(
                "Patient créé [admin=%s] : %s",
                _get_user_id(self.request),
                patient.nom_complet,
            )
        else:
            raise serializers.ValidationError(
                {"detail": "Rôle non autorisé à créer un patient."}
            )

    def perform_update(self, serializer):
        patient = serializer.save()
        logger.info(
            "Patient modifié [user=%s] : %s",
            _get_user_id(self.request),
            patient.nom_complet,
        )

    def perform_destroy(self, instance):
        if not instance.is_active:
            return
        instance.archiver(archived_by_id=_to_uuid(_get_user_id(self.request)))
        logger.info(
            "Patient archivé via DELETE [user=%s] : %s",
            _get_user_id(self.request),
            instance.nom_complet,
        )

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        self.perform_destroy(instance)
        return Response(
            {"detail": f"Patient {instance.nom_complet} archivé."},
            status=status.HTTP_200_OK,
        )

    # ── Action : statistiques ─────────────────────────────────────────

    @action(detail=False, methods=["get"], url_path="stats")
    def stats(self, request):
        qs = self.get_queryset()
        if _is_dentiste(request):
            dentiste_uuid = _to_uuid(_get_user_id(request))
            total_qs = Patient.all_objects.filter(dentiste_id=dentiste_uuid)
        else:
            total_qs = Patient.all_objects.all()

        now = timezone.now()
        data = {
            "total":            total_qs.count(),
            "actifs":           qs.count(),
            "archives":         total_qs.filter(is_active=False).count(),
            "nouveaux_ce_mois": qs.filter(
                created_at__year=now.year,
                created_at__month=now.month,
            ).count(),
            "en_attente":       qs.filter(statut=StatutValidation.PENDING).count(),
            "refuses":          qs.filter(statut=StatutValidation.REFUSE).count(),
            "mineurs":          qs.mineurs().count(),
            "avec_alertes":     qs.filter(_q_alertes_actives()).count(),
        }
        return Response(PatientStatsSerializer(data).data)

    # ── Action : dossier complet ──────────────────────────────────────

    @action(detail=True, methods=["get"], url_path="dossier")
    def dossier(self, request, pk=None):
        patient      = self.get_object()
        dossier_data = {"patient": PatientDetailSerializer(patient).data}
        dossier_data["rendezvous"]   = self._section_rendezvous(patient)
        dossier_data["ordonnances"]  = self._section_ordonnances(patient)
        dossier_data["radios"]       = self._section_radios(patient)
        dossier_data["dental_chart"] = self._section_dental_chart(patient)
        dossier_data["treatments"]   = self._section_treatments(patient)
        return Response(dossier_data)

    def _section_rendezvous(self, patient):
        try:
            from rendezvous.serializers import RendezVousListSerializer
            return RendezVousListSerializer(
                patient.rendezvous_set.order_by("-date_heure"), many=True
            ).data
        except ImportError:
            return []

    def _section_ordonnances(self, patient):
        try:
            from ordonnances.serializers import OrdonnanceListSerializer
            return OrdonnanceListSerializer(
                patient.ordonnances.order_by("-created_at"), many=True
            ).data
        except ImportError:
            return []

    def _section_radios(self, patient):
        try:
            from radios.serializers import RadioListSerializer
            return RadioListSerializer(
                patient.radios.order_by("-created_at"), many=True
            ).data
        except ImportError:
            return []

    def _section_dental_chart(self, patient):
        try:
            from dental_chart.serializers import ToothSerializer
            return ToothSerializer(patient.teeth.all(), many=True).data
        except ImportError:
            return []

    def _section_treatments(self, patient):
        try:
            from treatments.serializers import TraitementListSerializer  # ✅ CORRIGÉ
            return TraitementListSerializer(
                patient.treatments.filter(is_active=True).order_by("-date_debut"),
                many=True
            ).data
        except ImportError:
            return []

    # ── Action : valider ──────────────────────────────────────────────

    @action(detail=True, methods=["patch"], url_path="valider")
    def valider(self, request, pk=None):
        patient = self.get_object()

        if patient.statut != StatutValidation.PENDING:
            return Response(
                {"detail": "Ce patient n'est pas en attente de validation."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = PatientValidationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        decision = serializer.validated_data["decision"]
        raison   = serializer.validated_data.get("refuse_raison", "")

        with transaction.atomic():
            if decision == "ACCEPTE":
                patient.accepter()
                transaction.on_commit(
                    lambda: self._notifier_patient_validation(patient, accepte=True)
                )
                logger.info(
                    "Patient %s accepté [dentiste=%s]",
                    patient.id, _get_user_id(request)
                )
                return Response(
                    {"detail": f"Patient {patient.nom_complet} accepté."},
                    status=status.HTTP_200_OK,
                )
            else:
                patient.refuser(raison=raison)
                transaction.on_commit(
                    lambda: self._notifier_patient_validation(patient, accepte=False)
                )
                logger.info(
                    "Patient %s refusé [dentiste=%s]",
                    patient.id, _get_user_id(request)
                )
                return Response(
                    {"detail": f"Patient {patient.nom_complet} refusé.", "raison": raison},
                    status=status.HTTP_200_OK,
                )

    # ── Action : archiver ─────────────────────────────────────────────

    @action(detail=True, methods=["patch"], url_path="archiver")
    def archiver(self, request, pk=None):
        patient = self.get_object()
        if not patient.is_active:
            return Response(
                {"detail": "Ce patient est déjà archivé."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        patient.archiver(archived_by_id=_to_uuid(_get_user_id(request)))
        logger.info(
            "Patient %s archivé [user=%s]", patient.id, _get_user_id(request)
        )
        return Response(
            {"detail": f"Patient {patient.nom_complet} archivé."},
            status=status.HTTP_200_OK,
        )

    # ── Action : restaurer ────────────────────────────────────────────

    @action(detail=True, methods=["patch"], url_path="restaurer")
    def restaurer(self, request, pk=None):
        if not (_is_admin(request) or _is_dentiste(request)):
            return Response(
                {"detail": "Accès réservé aux dentistes et administrateurs."},
                status=status.HTTP_403_FORBIDDEN,
            )
        try:
            patient = Patient.all_objects.get(pk=pk)
        except Patient.DoesNotExist:
            return Response(
                {"detail": "Patient introuvable."},
                status=status.HTTP_404_NOT_FOUND,
            )
        if _is_dentiste(request):
            dentiste_uuid = _to_uuid(_get_user_id(request))
            if str(patient.dentiste_id) != str(dentiste_uuid):
                return Response(
                    {"detail": "Vous n'êtes pas le dentiste référent de ce patient."},
                    status=status.HTTP_403_FORBIDDEN,
                )
        if patient.is_active:
            return Response(
                {"detail": "Ce patient est déjà actif."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        patient.restaurer()
        logger.info(
            "Patient %s restauré [user=%s]", patient.id, _get_user_id(request)
        )
        return Response(
            {"detail": f"Patient {patient.nom_complet} restauré."},
            status=status.HTTP_200_OK,
        )

    # ── Action : note ─────────────────────────────────────────────────

    @action(detail=True, methods=["patch"], url_path="note")
    def note(self, request, pk=None):
        patient = self.get_object()
        contenu = request.data.get("note_generale", "")
        patient.note_generale = contenu
        patient.save(update_fields=["note_generale", "updated_at"])
        return Response(
            {"detail": "Note mise à jour.", "note_generale": patient.note_generale},
            status=status.HTTP_200_OK,
        )

    # ── Notifications (RabbitMQ) ──────────────────────────────────────

    def _notifier_dentiste_nouveau_patient(self, patient: Patient) -> None:
        try:
            from common.rabbitmq import publish_notification
            publish_notification("PATIENT_EN_ATTENTE", {
                "dentiste_id": str(patient.dentiste_id),
                "patient_id":  str(patient.id),
                "patient_nom": patient.nom_complet,
                "receptionniste_id": str(patient.receptionniste_id) if patient.receptionniste_id else None,
                "receptionniste_nom": self._receptionniste_nom,
            })
        except Exception as exc:
            logger.error("RabbitMQ [PATIENT_EN_ATTENTE] : %s", exc)

    def _notifier_patient_validation(self, patient: Patient, accepte: bool) -> None:
        try:
            from common.rabbitmq import publish_notification
            event_type = "PATIENT_VALIDE" if accepte else "PATIENT_REFUSE"
            publish_notification(event_type, {
                "dentiste_id":   str(patient.dentiste_id),
                "patient_id":    str(patient.id),
                "patient_nom":   patient.nom_complet,
                "refuse_raison": patient.refuse_raison,
                "receptionniste_id": str(patient.receptionniste_id) if patient.receptionniste_id else None,
            })
        except Exception as exc:
            logger.error("RabbitMQ [PATIENT_VALIDATION] : %s", exc)