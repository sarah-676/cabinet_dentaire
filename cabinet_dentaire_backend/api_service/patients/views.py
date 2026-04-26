"""
patients/views.py — api_service
✅ CORRIGÉ : notifications via RabbitMQ + receptionniste_id garanti
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


# ── Helpers ───────────────────────────────────────────────────────────────────

def _is_dentiste(request)      -> bool: return _get_role(request) == "dentiste"
def _is_admin(request)         -> bool: return _get_role(request) == "admin"
def _is_receptioniste(request) -> bool: return _get_role(request) == "receptionniste"


def _q_alertes_actives() -> Q:
    return (
        Q(alerte_anticoagulants=True)
        | Q(alerte_diabete=True)
        | Q(alerte_grossesse=True)
        | Q(alerte_allergie_latex=True)
        | Q(alerte_cardiopathie=True)
        | Q(alerte_immunodeprime=True)
    )


def _to_uuid(value) -> uuid_module.UUID | None:
    if isinstance(value, uuid_module.UUID):
        return value
    try:
        return uuid_module.UUID(str(value))
    except (ValueError, AttributeError):
        return None


# ── ViewSet ───────────────────────────────────────────────────────────────────

class PatientViewSet(ModelViewSet):

    http_method_names = ["get", "post", "patch", "delete", "head", "options"]
    filter_backends   = [SearchFilter, DjangoFilterBackend, OrderingFilter]
    search_fields     = ["nom", "prenom", "telephone", "email"]
    filterset_fields  = ["statut", "groupe_sanguin", "sexe"]
    ordering_fields   = ["nom", "prenom", "created_at", "date_naissance"]
    ordering          = ["-created_at"]

    def get_permissions(self):
        classes = [IsDentisteOrReceptionniste]
        actions_objet = {
            "retrieve", "update", "partial_update", "destroy",
            "dossier", "archiver", "note", "valider",
        }
        if self.action in actions_objet:
            classes.append(IsPatientOwner)
        return [cls() for cls in classes]

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

    def get_queryset(self):
        if not getattr(self.request, "user", None):
            return Patient.objects.none()

        if _is_dentiste(self.request):
            dentiste_uuid = _to_uuid(_get_user_id(self.request))
            if not dentiste_uuid:
                return Patient.objects.none()
            # ✅ Dentiste voit tous ses patients (PENDING inclus pour valider)
            return Patient.objects.filter(
                dentiste_id=dentiste_uuid,
                is_active=True,
            )

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
            # ✅ Réceptionniste voit tous les patients actifs (tous statuts)
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
                dentiste_uuid, patient.nom_complet,
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

            from common.services import verifier_dentiste_actif
            if not verifier_dentiste_actif(str(dentiste_uuid)):
                raise serializers.ValidationError(
                    {"dentiste_id": "Dentiste introuvable ou inactif."}
                )

            receptionniste_uuid = _to_uuid(_get_user_id(self.request))
            # ✅ Récupérer le nom du réceptionniste depuis le token
            receptionniste_nom = getattr(self.request.user, "full_name", "") or ""

            patient = serializer.save(
                dentiste_id       = dentiste_uuid,
                receptionniste_id = receptionniste_uuid,
                statut            = StatutValidation.PENDING,
            )

            logger.info(
                "Patient créé [receptionniste=%s, dentiste=%s] : %s — PENDING",
                receptionniste_uuid, dentiste_uuid, patient.nom_complet,
            )

            # ✅ Capturer les variables pour le lambda (évite closure bug)
            _patient             = patient
            _receptionniste_nom  = receptionniste_nom
            _receptionniste_uuid = str(receptionniste_uuid) if receptionniste_uuid else None

            transaction.on_commit(
                lambda: _notifier_dentiste_nouveau_patient(
                    _patient,
                    receptionniste_nom=_receptionniste_nom,
                    receptionniste_id=_receptionniste_uuid,
                )
            )

    # ── Action : stats ────────────────────────────────────────────────

    @action(detail=False, methods=["get"], url_path="stats")
    def stats(self, request):
        qs = self.get_queryset()
        data = {
            "total":            qs.count(),
            "actifs":           qs.filter(statut=StatutValidation.ACCEPTE).count(),
            "archives":         Patient.all_objects.filter(is_active=False).count(),
            "nouveaux_ce_mois": qs.filter(
                created_at__year  = timezone.now().year,
                created_at__month = timezone.now().month,
            ).count(),
            "en_attente":   qs.filter(statut=StatutValidation.PENDING).count(),
            "refuses":      qs.filter(statut=StatutValidation.REFUSE).count(),
            "mineurs":      qs.filter(
                date_naissance__gt=timezone.now().date().replace(
                    year=timezone.now().year - 18
                )
            ).count(),
            "avec_alertes": qs.filter(_q_alertes_actives()).count(),
        }
        return Response(data)

    # ── Action : dossier ──────────────────────────────────────────────

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
            from treatments.serializers import TraitementListSerializer
            return TraitementListSerializer(
                patient.treatments.filter(is_active=True).order_by("-date_debut"),
                many=True,
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

        # ✅ Récupérer le nom du dentiste depuis le token
        dentiste_nom = getattr(request.user, "full_name", "") or ""
        dentiste_id  = str(_get_user_id(request))

        with transaction.atomic():
            if decision == "ACCEPTE":
                patient.accepter()
            else:
                patient.refuser(raison=raison)

            # ✅ Capturer toutes les variables AVANT le lambda
            _patient      = patient
            _accepte      = (decision == "ACCEPTE")
            _dentiste_nom = dentiste_nom
            _dentiste_id  = dentiste_id

            transaction.on_commit(
                lambda: _notifier_patient_validation(
                    patient=_patient,
                    accepte=_accepte,
                    dentiste_id=_dentiste_id,
                    dentiste_nom=_dentiste_nom,
                )
            )

            logger.info(
                "Patient %s %s [dentiste=%s]",
                patient.id,
                "accepté" if decision == "ACCEPTE" else "refusé",
                dentiste_id,
            )

        # ✅ Retourne le patient sérialisé complet avec le nouveau statut
        patient.refresh_from_db()
        return Response(
            PatientListSerializer(patient).data,
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
        logger.info("Patient %s archivé [user=%s]", patient.id, _get_user_id(request))
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
        return Response(
            {"detail": f"Patient {patient.nom_complet} restauré."},
            status=status.HTTP_200_OK,
        )

    # ── Action : note ─────────────────────────────────────────────────

    @action(detail=True, methods=["patch"], url_path="note")
    def note(self, request, pk=None):
        patient = self.get_object()
        patient.note_generale = request.data.get("note_generale", "")
        patient.save(update_fields=["note_generale", "updated_at"])
        return Response(
            {"detail": "Note mise à jour.", "note_generale": patient.note_generale},
            status=status.HTTP_200_OK,
        )


# ── Fonctions de notification (hors classe) ───────────────────────────────────
# Placées hors de la classe pour éviter les problèmes de closure avec self

def _notifier_dentiste_nouveau_patient(
    patient: Patient,
    receptionniste_nom: str = "",
    receptionniste_id: str = None,
) -> None:
    """
    Notifie le dentiste qu'un nouveau patient est en attente.
    Appelé via transaction.on_commit().
    """
    try:
        from common.rabbitmq import publish_notification
        publish_notification("PATIENT_EN_ATTENTE", {
            "dentiste_id":        str(patient.dentiste_id),
            "patient_id":         str(patient.id),
            "patient_nom":        patient.nom_complet,
            # ✅ receptionniste_id transmis pour notification retour
            "receptionniste_id":  receptionniste_id or (
                str(patient.receptionniste_id) if patient.receptionniste_id else None
            ),
            "receptionniste_nom": receptionniste_nom,
        })
        logger.info(
            "Notification PATIENT_EN_ATTENTE publiée [dentiste=%s, patient=%s]",
            patient.dentiste_id, patient.id,
        )
    except Exception as exc:
        logger.error("Notification [PATIENT_EN_ATTENTE] : %s", exc)


def _notifier_patient_validation(
    patient: Patient,
    accepte: bool,
    dentiste_id: str = "",
    dentiste_nom: str = "",
) -> None:
    """
    Notifie le réceptionniste du résultat de la validation.
    Appelé via transaction.on_commit().

    ✅ Vérifie que receptionniste_id existe avant d'envoyer.
    ✅ Relit le patient depuis la DB pour avoir le statut à jour.
    """
    try:
        # ✅ Relire depuis la DB pour avoir le statut final
        patient.refresh_from_db()

        if not patient.receptionniste_id:
            logger.info(
                "Patient %s sans réceptionniste — notification ignorée",
                patient.id,
            )
            return

        from common.rabbitmq import publish_notification
        event_type = "PATIENT_VALIDE" if accepte else "PATIENT_REFUSE"

        publish_notification(event_type, {
            # ✅ destinataire = réceptionniste
            "receptionniste_id":  str(patient.receptionniste_id),
            "dentiste_id":        dentiste_id or str(patient.dentiste_id),
            "dentiste_nom":       dentiste_nom,
            "patient_id":         str(patient.id),
            "patient_nom":        patient.nom_complet,
            "refuse_raison":      patient.refuse_raison,
            # ✅ Statut final inclus pour mise à jour frontend
            "statut":             patient.statut,
        })
        logger.info(
            "Notification %s publiée [receptionniste=%s, patient=%s]",
            event_type, patient.receptionniste_id, patient.id,
        )
    except Exception as exc:
        logger.error("Notification [PATIENT_VALIDATION] : %s", exc)

        