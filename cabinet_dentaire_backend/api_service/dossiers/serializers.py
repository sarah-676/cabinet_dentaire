"""
dossiers/serializers.py — api_service
========================================
Serializers pour le module dossier patient agrégé.

Checklist couverte :
  D-08 — Dossier patient complet : infos + RDV + radios + traitements + ordonnances

Architecture :
  DossierSectionMeta       → métadonnées de section (count, dernière date)
  DossierPatientSerializer → agrégation complète de toutes les sections
  DossierResumeSerializer  → version légère pour la liste des dossiers

Principe :
  Le dossier n'a PAS de modèle Django propre.
  C'est une vue agrégée construite à la volée depuis les autres apps.
  DossierPatientSerializer est un serializer pur (pas ModelSerializer)
  qui compose les données des autres serializers.
"""

from rest_framework import serializers

from patients.serializers import PatientDetailSerializer
from rendezvous.serializers import RendezVousListSerializer
from radios.serializers import RadioListSerializer
from ordonnances.serializers import OrdonnanceListSerializer
from treatments.serializers import TraitementListSerializer


# ── Métadonnées de section ────────────────────────────────────────────────────

class DossierSectionMetaSerializer(serializers.Serializer):
    """
    Résumé statistique d'une section du dossier.
    Affiché dans les onglets : "Rendez-vous (12) • Dernier : 15/04/2026"
    """
    count        = serializers.IntegerField()
    derniere_date = serializers.DateTimeField(allow_null=True)


# ── Dossier complet ───────────────────────────────────────────────────────────

class DossierPatientSerializer(serializers.Serializer):
    """
    Dossier patient complet — agrégation de toutes les sections.

    Ce serializer est construit manuellement par DossierView.get()
    à partir des données déjà requêtées et passées en contexte.

    Structure de la réponse :
      {
        "patient":       { ...PatientDetailSerializer },
        "resume":        { compteurs globaux },
        "rendezvous":    { "meta": {...}, "items": [...] },
        "radios":        { "meta": {...}, "items": [...] },
        "ordonnances":   { "meta": {...}, "items": [...] },
        "traitements":   { "meta": {...}, "items": [...] },
      }
    """

    patient     = PatientDetailSerializer(read_only=True)
    resume      = serializers.SerializerMethodField()
    rendezvous  = serializers.SerializerMethodField()
    radios      = serializers.SerializerMethodField()
    ordonnances = serializers.SerializerMethodField()
    traitements = serializers.SerializerMethodField()

    def _get_section(self, obj: dict, key: str, serializer_class, date_field: str = "created_at") -> dict:
        """
        Construit une section { meta: {count, derniere_date}, items: [...] }.
        obj est le dict complet passé au serializer (pas un modèle).
        """
        items = obj.get(key, [])

        # Dernière date de la section
        dates = [
            item.get(date_field) or item.get("created_at")
            for item in items
            if item.get(date_field) or item.get("created_at")
        ]
        derniere_date = max(dates, default=None)

        return {
            "meta": {
                "count":        len(items),
                "derniere_date": derniere_date,
            },
            "items": items,
        }

    def get_resume(self, obj: dict) -> dict:
        """Compteurs globaux pour le header du dossier."""
        return {
            "nb_rendezvous":  len(obj.get("rendezvous",  [])),
            "nb_radios":      len(obj.get("radios",      [])),
            "nb_ordonnances": len(obj.get("ordonnances", [])),
            "nb_traitements": len(obj.get("traitements", [])),
            "nb_alertes_critiques": sum(
                1 for a in obj.get("patient", {}).get("alertes", [])
                if a.get("niveau") == "CRITIQUE"
            ),
        }

    def get_rendezvous(self, obj: dict) -> dict:
        return self._get_section(obj, "rendezvous", RendezVousListSerializer, "date_heure")

    def get_radios(self, obj: dict) -> dict:
        return self._get_section(obj, "radios", RadioListSerializer, "date_prise")

    def get_ordonnances(self, obj: dict) -> dict:
        return self._get_section(obj, "ordonnances", OrdonnanceListSerializer, "date_prescription")

    def get_traitements(self, obj: dict) -> dict:
        return self._get_section(obj, "traitements", TraitementListSerializer, "date_debut")


# ── Résumé pour liste des dossiers ────────────────────────────────────────────

class DossierResumeSerializer(serializers.Serializer):
    """
    Version légère pour GET /dossiers/
    Liste tous les patients du dentiste avec compteurs résumés.
    Évite de charger tout le dossier pour chaque patient.
    """
    patient_id       = serializers.UUIDField()
    nom_complet      = serializers.CharField()
    nom              = serializers.CharField()
    prenom           = serializers.CharField()
    age              = serializers.IntegerField()
    sexe             = serializers.CharField()
    telephone        = serializers.CharField()
    groupe_sanguin   = serializers.CharField()
    statut           = serializers.CharField()
    nb_rendezvous    = serializers.IntegerField()
    nb_radios        = serializers.IntegerField()
    nb_ordonnances   = serializers.IntegerField()
    nb_traitements   = serializers.IntegerField()
    nb_alertes_critiques = serializers.IntegerField()
    created_at       = serializers.DateTimeField()
    dernier_rdv      = serializers.DateTimeField(allow_null=True)