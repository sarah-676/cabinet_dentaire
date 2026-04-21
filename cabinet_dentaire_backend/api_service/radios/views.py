"""
radios/views.py — api_service
================================
RadioViewSet — gestion des radiographies + analyse IA.

Endpoints :
  GET    /radios/                     → liste (filtrée par patient ou dentiste)
  POST   /radios/                     → upload image
  GET    /radios/{id}/                → détail + résultat IA
  PATCH  /radios/{id}/                → modifier description/type
  DELETE /radios/{id}/                → soft delete
  POST   /radios/{id}/analyser/       → envoyer vers ia_service ← BOUTON IA
  GET    /radios/stats/               → statistiques

Workflow bouton "Analyser" :
  1. Frontend : PATCH /radios/{id}/analyser/
  2. ViewSet  : marque statut EN_COURS
  3. ViewSet  : envoie image vers ia_service via HTTP
  4. ia_service retourne { resultat, anomalies, confidence }
  5. ViewSet  : sauvegarde résultat → statut ANALYSE
  6. Frontend : affiche résultat
"""

import logging

from django.db.models import Count
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from .models import Radio, StatutAnalyse, TypeRadio
from .permissions import IsRadioOwner, _get_role, _get_user_id
from .serializers import (
    RadioAnalyseResultatSerializer,
    RadioDetailSerializer,
    RadioListSerializer,
    RadioStatsSerializer,
    RadioUpdateSerializer,
    RadioUploadSerializer,
)

logger = logging.getLogger(__name__)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _is_dentiste(request) -> bool:
    return _get_role(request) == "dentiste"

def _is_admin(request) -> bool:
    return _get_role(request) == "admin"


# ── ViewSet ───────────────────────────────────────────────────────────────────

class RadioViewSet(ModelViewSet):
    """
    ViewSet radiographies.

    Endpoints DRF Router :
      GET    /radios/              → liste
      POST   /radios/              → upload
      GET    /radios/{id}/         → détail
      PATCH  /radios/{id}/         → modifier
      DELETE /radios/{id}/         → supprimer

    Actions custom :
      POST   /radios/{id}/analyser/ → envoyer vers IA
      GET    /radios/stats/         → statistiques
    """

    http_method_names = ["get", "post", "patch", "delete", "head", "options"]
    filter_backends   = [SearchFilter, OrderingFilter]
    search_fields     = ["description", "type_radio"]
    ordering_fields   = ["date_prise", "created_at", "statut_analyse"]
    ordering          = ["-date_prise"]

    def get_permissions(self):
        if self.action in ("retrieve", "partial_update", "update",
                           "destroy", "analyser"):
            return [IsAuthenticated(), IsRadioOwner()]
        return [IsAuthenticated()]

    def get_serializer_class(self):
        if self.action == "create":
            return RadioUploadSerializer
        if self.action in ("partial_update", "update"):
            return RadioUpdateSerializer
        if self.action == "retrieve":
            return RadioDetailSerializer
        if self.action == "analyser":
            return RadioAnalyseResultatSerializer
        if self.action == "stats":
            return RadioStatsSerializer
        return RadioListSerializer

    def get_queryset(self):
        """
        Filtrage selon le rôle :
          Dentiste → ses radios uniquement
          Admin    → toutes les radios

        Filtre optionnel : ?patient_id=<uuid>
        """
        if not getattr(self.request, "user", None):
            return Radio.objects.none()

        # Filtre de base selon le rôle
        if _is_dentiste(self.request):
            qs = Radio.objects.du_dentiste(_get_user_id(self.request))
        elif _is_admin(self.request):
            qs = Radio.objects.actives()
        else:
            return Radio.objects.none()

        # Filtre optionnel par patient
        patient_id = self.request.query_params.get("patient_id")
        if patient_id:
            qs = qs.filter(patient_id=patient_id)

        # Filtre optionnel par statut analyse
        statut = self.request.query_params.get("statut_analyse")
        if statut:
            qs = qs.filter(statut_analyse=statut)

        # Filtre optionnel par type
        type_radio = self.request.query_params.get("type_radio")
        if type_radio:
            qs = qs.filter(type_radio=type_radio)

        return qs.select_related("patient")

    # ── CRUD ──────────────────────────────────────────────────────────

    def perform_create(self, serializer):
        """
        Upload d'une radio.
        Injecte automatiquement dentiste_id depuis le token JWT.
        """
        user_id = _get_user_id(self.request)
        radio   = serializer.save(
            dentiste_id    = user_id,
            statut_analyse = StatutAnalyse.EN_ATTENTE,
        )
        logger.info(
            "Radio uploadée [dentiste=%s, patient=%s, type=%s]",
            user_id, radio.patient_id, radio.type_radio,
        )

    def perform_destroy(self, instance):
        """Soft delete — ne supprime pas le fichier physiquement."""
        instance.supprimer()
        logger.info(
            "Radio supprimée [dentiste=%s, radio=%s]",
            _get_user_id(self.request), instance.id,
        )

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        self.perform_destroy(instance)
        return Response(
            {"detail": "Radiographie supprimée."},
            status=status.HTTP_200_OK,
        )

    # ── @action : analyser ────────────────────────────────────────────

    @action(detail=True, methods=["post"], url_path="analyser")
    def analyser(self, request, pk=None):
        """
        POST /radios/{id}/analyser/
        ────────────────────────────
        Bouton "Analyser" dans la fiche patient.

        Workflow :
          1. Vérifier que la radio n'est pas déjà en cours d'analyse
          2. Marquer statut = EN_COURS
          3. Envoyer l'image vers ia_service
          4. Sauvegarder le résultat → statut = ANALYSE
          5. Retourner le résultat au frontend

        Si ia_service est indisponible → statut = ERREUR
        """
        radio = self.get_object()

        # Empêcher une double analyse simultanée
        if radio.statut_analyse == StatutAnalyse.EN_COURS:
            return Response(
                {"detail": "Analyse déjà en cours, veuillez patienter."},
                status=status.HTTP_409_CONFLICT,
            )

        # Marquer EN_COURS
        radio.marquer_en_cours()
        logger.info(
            "Analyse IA démarrée [radio=%s, patient=%s]",
            radio.id, radio.patient_id,
        )

        # Envoyer vers ia_service
        resultat = _appeler_ia_service(radio)

        if resultat is None:
            # ia_service indisponible ou erreur
            radio.marquer_erreur("Service IA indisponible. Veuillez réessayer.")
            return Response(
                {
                    "detail": "Le service d'analyse est temporairement indisponible.",
                    "statut": radio.statut_analyse,
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        if "erreur" in resultat:
            radio.marquer_erreur(resultat["erreur"])
            return Response(
                {
                    "detail": f"Erreur d'analyse : {resultat['erreur']}",
                    "statut": radio.statut_analyse,
                },
                status=status.HTTP_422_UNPROCESSABLE_ENTITY,
            )

        # Sauvegarder le résultat
        radio.sauvegarder_resultat(
            resultat   = resultat.get("resultat",   ""),
            anomalies  = resultat.get("anomalies",  []),
            confidence = resultat.get("confidence", 0.0),
        )

        logger.info(
            "Analyse IA terminée [radio=%s, anomalies=%d, confidence=%.2f]",
            radio.id,
            radio.nb_anomalies,
            radio.ia_confidence or 0.0,
        )

        serializer = RadioAnalyseResultatSerializer(radio)
        return Response(serializer.data, status=status.HTTP_200_OK)

    # ── @action : stats ───────────────────────────────────────────────

    @action(detail=False, methods=["get"], url_path="stats")
    def stats(self, request):
        """
        GET /radios/stats/
        Statistiques radiographies pour le dashboard dentiste.
        """
        qs = self.get_queryset()

        # Comptage par type
        par_type_qs = (
            qs.values("type_radio")
              .annotate(count=Count("id"))
              .order_by()
        )
        par_type = {item["type_radio"]: item["count"] for item in par_type_qs}

        data = {
            "total":          qs.count(),
            "analysees":      qs.filter(statut_analyse=StatutAnalyse.ANALYSE).count(),
            "en_attente":     qs.filter(statut_analyse=StatutAnalyse.EN_ATTENTE).count(),
            "avec_anomalies": qs.filter(ia_anomalies_detectees=True).count(),
            "par_type":       par_type,
        }
        return Response(data)


# ── Appel ia_service ──────────────────────────────────────────────────────────

def _appeler_ia_service(radio: Radio) -> dict | None:
    """
    Envoie l'image vers ia_service et retourne le résultat.

    ia_service expose :
      POST /api/ia/analyser/
      Body : multipart/form-data avec "image" (fichier)
      Réponse :
        {
          "resultat":   "Carie détectée sur la dent 16...",
          "anomalies":  [{"type": "carie", "dent": "16", "confidence": 0.92}],
          "confidence": 0.89
        }

    En cas d'erreur → retourne {"erreur": "message"} ou None.

    NOTE : quand ia_service n'est pas encore développé,
           cette fonction retourne un résultat simulé en mode dev.
    """
    import requests
    from django.conf import settings

    ia_url = getattr(settings, "IA_SERVICE_URL", None)

    # ── Mode simulation (ia_service pas encore développé) ─────────────
    if not ia_url or getattr(settings, "IA_SERVICE_MOCK", False):
        logger.warning(
            "IA_SERVICE_URL non configuré — mode simulation activé"
        )
        return _resultat_simule(radio)

    # ── Appel réel vers ia_service ─────────────────────────────────────
    try:
        with radio.image.open("rb") as img_file:
            response = requests.post(
                f"{ia_url}/api/ia/analyser/",
                files   = {"image": (radio.image.name, img_file, "image/jpeg")},
                data    = {
                    "radio_id":   str(radio.id),
                    "type_radio": radio.type_radio,
                    "patient_id": str(radio.patient_id),
                },
                timeout = 60,   # l'analyse peut prendre du temps
                headers = {
                    "Authorization": f"Bearer {getattr(settings, 'INTERNAL_SERVICE_TOKEN', '')}",
                },
            )

        if response.status_code == 200:
            return response.json()

        logger.error(
            "ia_service HTTP %s [radio=%s]",
            response.status_code, radio.id,
        )
        return {"erreur": f"Service IA a retourné HTTP {response.status_code}"}

    except requests.Timeout:
        logger.error("ia_service timeout [radio=%s]", radio.id)
        return {"erreur": "Délai d'attente dépassé. Veuillez réessayer."}

    except requests.ConnectionError:
        logger.error("ia_service inaccessible [radio=%s]", radio.id)
        return None   # → 503 Service Unavailable

    except Exception as exc:
        logger.error("ia_service erreur inattendue [radio=%s] : %s", radio.id, exc)
        return {"erreur": str(exc)}


def _resultat_simule(radio: Radio) -> dict:
    """
    Résultat simulé quand ia_service n'est pas encore développé.
    Permet de tester le workflow complet en dev.

    À supprimer quand ia_service est prêt.
    """
    import random

    anomalies_possibles = [
        {"type": "carie",         "dent": "16", "confidence": 0.92, "description": "Carie interproximale"},
        {"type": "carie",         "dent": "26", "confidence": 0.85, "description": "Carie occlusale"},
        {"type": "abces",         "dent": "11", "confidence": 0.78, "description": "Abcès péri-apical"},
        {"type": "perte_osseuse", "dent": "36", "confidence": 0.88, "description": "Perte osseuse alvéolaire"},
        {"type": "calcul",        "dent": "46", "confidence": 0.95, "description": "Tartre sous-gingival"},
    ]

    # 70% de chance de détecter des anomalies
    if random.random() < 0.7:
        nb    = random.randint(1, 3)
        found = random.sample(anomalies_possibles, min(nb, len(anomalies_possibles)))
        conf  = round(sum(a["confidence"] for a in found) / len(found), 2)
        desc  = ", ".join(a["description"] for a in found)
        return {
            "resultat":   f"Analyse terminée. {len(found)} anomalie(s) détectée(s) : {desc}.",
            "anomalies":  found,
            "confidence": conf,
        }
    else:
        return {
            "resultat":   "Aucune anomalie détectée. Dentition en bon état apparent.",
            "anomalies":  [],
            "confidence": 0.94,
        }
