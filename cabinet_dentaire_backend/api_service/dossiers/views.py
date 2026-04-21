"""
dossiers/views.py — api_service
==================================
Vue agrégée du dossier patient complet.

Checklist couverte :
  D-08 — Dossier patient complet : infos + RDV + radios + traitements + ordonnances

Architecture :
  DossierViewSet — pas de modèle propre, agrégation à la volée.

  GET /dossiers/                        → liste des dossiers (résumé par patient)
  GET /dossiers/{patient_id}/           → dossier complet d'un patient
  GET /dossiers/{patient_id}/timeline/  → timeline chronologique de tous les événements

Règles d'accès (identiques aux autres apps) :
  - Dentiste → uniquement ses patients
  - Admin    → tous les patients
  - Réceptionniste → accès en lecture seule

Optimisation N+1 :
  Toutes les données sont chargées en une seule passe par section
  avec select_related() et prefetch_related() appropriés.
  Le dossier complet d'un patient fait exactement 5 requêtes SQL :
    1. Patient
    2. RendezVous du patient
    3. Radios du patient
    4. Ordonnances + lignes (prefetch)
    5. Traitements + séances (prefetch)
"""

import logging
import uuid as uuid_module

from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.viewsets import ViewSet

from patients.models import Patient
from patients.serializers import PatientDetailSerializer
from rendezvous.models import RendezVous
from rendezvous.serializers import RendezVousListSerializer
from radios.models import Radio
from radios.serializers import RadioListSerializer
from ordonnances.models import Ordonnance
from ordonnances.serializers import OrdonnanceListSerializer
from treatments.models import Traitement
from treatments.serializers import TraitementListSerializer

from .serializers import DossierPatientSerializer, DossierResumeSerializer
from .permissions import (
    IsDentisteOrAdmin,
    IsReceptioniste,
    _get_role,
    _get_user_id,
)

logger = logging.getLogger(__name__)


# ── Helpers ───────────────────────────────────────────────────────────────────

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


def _get_patient_or_404(patient_id, request) -> Patient | None:
    """
    Récupère un patient en vérifiant les droits d'accès.
    Retourne None si introuvable ou accès refusé.
    """
    patient_uuid = _to_uuid(patient_id)
    if not patient_uuid:
        return None

    try:
        if _is_dentiste(request):
            dentiste_uuid = _to_uuid(_get_user_id(request))
            return Patient.objects.get(pk=patient_uuid, dentiste_id=dentiste_uuid, is_active=True)
        elif _is_admin(request):
            return Patient.objects.get(pk=patient_uuid)
        else:
            # Réceptionniste → patients actifs uniquement
            return Patient.objects.actifs().get(pk=patient_uuid)
    except Patient.DoesNotExist:
        return None


def _charger_rendezvous(patient_id) -> list:
    """Charge les RDV actifs d'un patient, triés par date décroissante."""
    qs = (
        RendezVous.objects
        .filter(patient_id=patient_id, is_active=True)
        .select_related("patient")
        .order_by("-date_heure")
    )
    return RendezVousListSerializer(qs, many=True).data


def _charger_radios(patient_id) -> list:
    """Charge les radios actives d'un patient, triées par date décroissante."""
    qs = (
        Radio.objects
        .filter(patient_id=patient_id, is_active=True)
        .order_by("-date_prise", "-created_at")
    )
    return RadioListSerializer(qs, many=True).data


def _charger_ordonnances(patient_id) -> list:
    """Charge les ordonnances actives avec leurs lignes, triées par date."""
    qs = (
        Ordonnance.objects
        .filter(patient_id=patient_id, is_active=True)
        .prefetch_related("lignes")
        .select_related("patient")
        .order_by("-date_prescription", "-created_at")
    )
    return OrdonnanceListSerializer(qs, many=True).data


def _charger_traitements(patient_id) -> list:
    """Charge les traitements actifs avec leurs séances, triés par date."""
    qs = (
        Traitement.objects
        .filter(patient_id=patient_id, is_active=True)
        .prefetch_related("seances")
        .select_related("patient")
        .order_by("-date_debut")
    )
    return TraitementListSerializer(qs, many=True).data


# ══════════════════════════════════════════════════════════════════════════════
# VIEWSET
# ══════════════════════════════════════════════════════════════════════════════

class DossierViewSet(ViewSet):
    """
    ViewSet pour le dossier patient agrégé.
    Pas de modèle propre — agrégation à la volée.

    Endpoints :
      GET /dossiers/                       → liste résumée des patients
      GET /dossiers/{patient_id}/          → dossier complet
      GET /dossiers/{patient_id}/timeline/ → timeline chronologique
    """

    def get_permissions(self):
        return [(IsDentisteOrAdmin | IsReceptioniste)()]

    # ── Liste des dossiers ────────────────────────────────────────────

    def list(self, request):
        """
        GET /dossiers/
        Liste tous les patients du dentiste avec compteurs par section.
        Optimisé : une seule requête par section grâce à annotate().
        """
        # Récupérer les patients selon le rôle
        if _is_dentiste(request):
            dentiste_uuid = _to_uuid(_get_user_id(request))
            if not dentiste_uuid:
                return Response(
                    {"detail": "ID dentiste invalide."},
                    status=status.HTTP_401_UNAUTHORIZED,
                )
            patients_qs = Patient.objects.filter(
                dentiste_id=dentiste_uuid, is_active=True
            ).order_by("-created_at")

        elif _is_admin(request):
            patients_qs = Patient.objects.filter(is_active=True).order_by("-created_at")

        else:
            # Réceptionniste → tous les patients actifs
            patients_qs = Patient.objects.actifs().order_by("-created_at")

        # Pour chaque patient, calculer les compteurs
        # On fait des requêtes groupées pour éviter N+1
        patient_ids = list(patients_qs.values_list("pk", flat=True))

        if not patient_ids:
            return Response([])

        # Compteurs par patient_id (requêtes groupées)
        from django.db.models import Count, Max

        rdv_counts = dict(
            RendezVous.objects.filter(patient_id__in=patient_ids, is_active=True)
            .values("patient_id")
            .annotate(count=Count("id"), dernier=Max("date_heure"))
            .values_list("patient_id", "count")
        )
        rdv_derniers = dict(
            RendezVous.objects.filter(patient_id__in=patient_ids, is_active=True)
            .values("patient_id")
            .annotate(dernier=Max("date_heure"))
            .values_list("patient_id", "dernier")
        )
        radio_counts = dict(
            Radio.objects.filter(patient_id__in=patient_ids, is_active=True)
            .values("patient_id")
            .annotate(count=Count("id"))
            .values_list("patient_id", "count")
        )
        ord_counts = dict(
            Ordonnance.objects.filter(patient_id__in=patient_ids, is_active=True)
            .values("patient_id")
            .annotate(count=Count("id"))
            .values_list("patient_id", "count")
        )
        trait_counts = dict(
            Traitement.objects.filter(patient_id__in=patient_ids, is_active=True)
            .values("patient_id")
            .annotate(count=Count("id"))
            .values_list("patient_id", "count")
        )

        # Construire la liste des résumés
        resultats = []
        for patient in patients_qs:
            resultats.append({
                "patient_id":        str(patient.pk),
                "nom_complet":       patient.nom_complet,
                "nom":               patient.nom,
                "prenom":            patient.prenom,
                "age":               patient.age,
                "sexe":              patient.sexe,
                "telephone":         patient.telephone,
                "groupe_sanguin":    patient.groupe_sanguin,
                "statut":            patient.statut,
                "nb_rendezvous":     rdv_counts.get(patient.pk, 0),
                "nb_radios":         radio_counts.get(patient.pk, 0),
                "nb_ordonnances":    ord_counts.get(patient.pk, 0),
                "nb_traitements":    trait_counts.get(patient.pk, 0),
                "nb_alertes_critiques": sum(
                    1 for a in patient.alertes_actives if a["niveau"] == "CRITIQUE"
                ),
                "created_at":  patient.created_at,
                "dernier_rdv": rdv_derniers.get(patient.pk),
            })

        serializer = DossierResumeSerializer(resultats, many=True)
        return Response(serializer.data)

    # ── Dossier complet ───────────────────────────────────────────────

    def retrieve(self, request, pk=None):
        """
        GET /dossiers/{patient_id}/
        Dossier complet d'un patient.
        Exactement 5 requêtes SQL.
        """
        patient = _get_patient_or_404(pk, request)
        if patient is None:
            return Response(
                {"detail": "Patient introuvable ou accès non autorisé."},
                status=status.HTTP_404_NOT_FOUND,
            )

        logger.info(
            "Dossier consulté [user=%s] patient=%s",
            _get_user_id(request), patient.pk,
        )

        # Charger toutes les sections (5 requêtes SQL)
        dossier_data = {
            "patient":     PatientDetailSerializer(patient).data,
            "rendezvous":  _charger_rendezvous(patient.pk),
            "radios":      _charger_radios(patient.pk),
            "ordonnances": _charger_ordonnances(patient.pk),
            "traitements": _charger_traitements(patient.pk),
        }

        serializer = DossierPatientSerializer(dossier_data)
        return Response(serializer.data)

    # ── Timeline ──────────────────────────────────────────────────────

    @action(detail=True, methods=["get"], url_path="timeline")
    def timeline(self, request, pk=None):
        """
        GET /dossiers/{patient_id}/timeline/
        Timeline chronologique de tous les événements du patient.

        Retourne une liste unifiée, triée par date décroissante,
        de tous les types d'événements : RDV, radios, ordonnances, traitements.

        Format d'un événement :
          {
            "type":        "RENDEZVOUS" | "RADIO" | "ORDONNANCE" | "TRAITEMENT",
            "date":        "2026-04-15T10:30:00",
            "titre":       "Consultation — Dr Benali",
            "description": "...",
            "statut":      "...",
            "id":          "uuid",
            "meta":        { champs spécifiques au type }
          }
        """
        patient = _get_patient_or_404(pk, request)
        if patient is None:
            return Response(
                {"detail": "Patient introuvable ou accès non autorisé."},
                status=status.HTTP_404_NOT_FOUND,
            )

        evenements = []

        # ── Rendez-vous ───────────────────────────────────────────────
        for rdv in RendezVous.objects.filter(
            patient_id=patient.pk, is_active=True
        ).order_by("-date_heure"):
            evenements.append({
                "type":        "RENDEZVOUS",
                "date":        rdv.date_heure.isoformat(),
                "titre":       f"Rendez-vous — {rdv.get_type_soin_display()}",
                "description": rdv.motif or "",
                "statut":      rdv.statut,
                "id":          str(rdv.pk),
                "meta": {
                    "type_soin":     rdv.type_soin,
                    "duree_minutes": rdv.duree_minutes,
                    "priorite":      rdv.priorite,
                },
            })

        # ── Radios ────────────────────────────────────────────────────
        for radio in Radio.objects.filter(
            patient_id=patient.pk, is_active=True
        ).order_by("-date_prise"):
            evenements.append({
                "type":        "RADIO",
                "date":        radio.date_prise.isoformat(),
                "titre":       f"Radio — {radio.get_type_radio_display()}",
                "description": radio.description or "",
                "statut":      radio.statut_analyse,
                "id":          str(radio.pk),
                "meta": {
                    "type_radio":             radio.type_radio,
                    "ia_anomalies_detectees": radio.ia_anomalies_detectees,
                    "nb_anomalies":           radio.nb_anomalies,
                },
            })

        # ── Ordonnances ───────────────────────────────────────────────
        for ord_ in Ordonnance.objects.filter(
            patient_id=patient.pk, is_active=True
        ).order_by("-date_prescription"):
            evenements.append({
                "type":        "ORDONNANCE",
                "date":        ord_.date_prescription.isoformat(),
                "titre":       f"Ordonnance {ord_.numero}",
                "description": ord_.diagnostic or "",
                "statut":      ord_.statut,
                "id":          str(ord_.pk),
                "meta": {
                    "numero":        ord_.numero,
                    "nb_medicaments": ord_.nb_medicaments,
                    "est_valide":    ord_.est_valide,
                    "est_expiree":   ord_.est_expiree,
                },
            })

        # ── Traitements ───────────────────────────────────────────────
        for trait in Traitement.objects.filter(
            patient_id=patient.pk, is_active=True
        ).order_by("-date_debut"):
            evenements.append({
                "type":        "TRAITEMENT",
                "date":        trait.date_debut.isoformat(),
                "titre":       f"Traitement — {trait.get_type_acte_display()}",
                "description": trait.description or "",
                "statut":      trait.statut,
                "id":          str(trait.pk),
                "meta": {
                    "type_acte":   trait.type_acte,
                    "dent":        trait.dent,
                    "cout_total":  str(trait.cout_total),
                    "progression": trait.progression,
                },
            })

        # Trier tous les événements par date décroissante
        evenements.sort(
            key=lambda e: e["date"],
            reverse=True,
        )

        return Response({
            "patient_id":   str(patient.pk),
            "nom_complet":  patient.nom_complet,
            "nb_evenements": len(evenements),
            "evenements":   evenements,
        })