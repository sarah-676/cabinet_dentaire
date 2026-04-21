"""
ordonnances/serializers.py
===========================
Serializers spécialisés selon le contexte.

  LigneOrdonnanceSerializer        → sous-objet (lecture + écriture)
  OrdonnanceListSerializer         → GET /ordonnances/         (carte légère)
  OrdonnanceDetailSerializer       → GET /ordonnances/{id}/    (fiche complète)
  OrdonnanceCreateUpdateSerializer → POST / PATCH              (création/modif)
  OrdonnanceAnnulationSerializer   → PATCH /annuler/
  OrdonnanceStatsSerializer        → GET /stats/               (tableau de bord)

Cohérence avec rendezvous/serializers.py :
  - Même pattern PrimaryKeyRelatedField avec queryset=Model.objects.none()
    au niveau classe, surchargé dynamiquement dans __init__
  - Imports des modèles externes DANS __init__ (évite les imports circulaires)
  - Même pattern SerializerMethodField pour les propriétés calculées
  - Même validation croisée dans validate()
  - dentiste_id injecté par la vue (perform_create), jamais exposé en écriture
"""

import uuid as uuid_module
from django.utils import timezone
from rest_framework import serializers

from patients.models import Patient, StatutValidation
from .models import Ordonnance, LigneOrdonnance, StatutOrdonnance


# ── Helper ────────────────────────────────────────────────────────────────────

def _to_uuid(value):
    if isinstance(value, uuid_module.UUID):
        return value
    try:
        return uuid_module.UUID(str(value))
    except (ValueError, AttributeError):
        return None


# ── Ligne d'ordonnance ────────────────────────────────────────────────────────

class LigneOrdonnanceSerializer(serializers.ModelSerializer):
    """
    Serializer pour LigneOrdonnance.
    Utilisé en nested dans OrdonnanceCreateUpdateSerializer (écriture)
    et OrdonnanceDetailSerializer (lecture).
    """

    class Meta:
        model  = LigneOrdonnance
        fields = [
            "id",
            "medicament",
            "dosage",
            "forme",
            "voie",
            "posologie",
            "duree_traitement",
            "quantite",
            "instructions",
            "ordre",
        ]
        extra_kwargs = {
            "id": {"read_only": True},
        }

    def validate_medicament(self, value: str) -> str:
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Le nom du médicament est obligatoire.")
        return value

    def validate_posologie(self, value: str) -> str:
        value = value.strip()
        if not value:
            raise serializers.ValidationError("La posologie est obligatoire.")
        return value

    def validate_quantite(self, value: int) -> int:
        if value < 1:
            raise serializers.ValidationError("La quantité doit être au moins 1.")
        if value > 999:
            raise serializers.ValidationError("La quantité ne peut pas dépasser 999.")
        return value


# ── Liste (carte légère) ──────────────────────────────────────────────────────

class OrdonnanceListSerializer(serializers.ModelSerializer):
    """
    Version allégée pour GET /ordonnances/ et section ordonnances du dossier patient.
    Utilisé aussi dans patients/views.py → _section_ordonnances().
    """
    patient_nom    = serializers.SerializerMethodField()
    patient_id     = serializers.SerializerMethodField()
    est_valide     = serializers.SerializerMethodField()
    est_expiree    = serializers.SerializerMethodField()
    nb_medicaments = serializers.SerializerMethodField()

    class Meta:
        model  = Ordonnance
        fields = [
            "id",
            "numero",
            "patient_id",
            "patient_nom",
            "date_prescription",
            "date_expiration",
            "statut",
            "diagnostic",
            "est_valide",
            "est_expiree",
            "nb_medicaments",
            "created_at",
        ]

    def get_patient_nom(self, obj: Ordonnance) -> str:
        return obj.patient.nom_complet if obj.patient_id else ""

    def get_patient_id(self, obj: Ordonnance) -> str:
        return str(obj.patient_id) if obj.patient_id else ""

    def get_est_valide(self, obj: Ordonnance) -> bool:
        return obj.est_valide

    def get_est_expiree(self, obj: Ordonnance) -> bool:
        return obj.est_expiree

    def get_nb_medicaments(self, obj: Ordonnance) -> int:
        return obj.nb_medicaments


# ── Détail (fiche complète) ───────────────────────────────────────────────────

class OrdonnanceDetailSerializer(serializers.ModelSerializer):
    """Fiche complète en lecture seule — inclut toutes les lignes."""
    patient_nom  = serializers.SerializerMethodField()
    patient_id   = serializers.SerializerMethodField()
    est_valide   = serializers.SerializerMethodField()
    est_expiree  = serializers.SerializerMethodField()
    lignes       = LigneOrdonnanceSerializer(many=True, read_only=True)

    class Meta:
        model  = Ordonnance
        fields = [
            "id",
            "numero",
            "patient_id",
            "patient_nom",
            "rendezvous",
            "date_prescription",
            "date_expiration",
            "statut",
            "diagnostic",
            "instructions_generales",
            "note_pharmacien",
            "est_valide",
            "est_expiree",
            "lignes",
            "dentiste_id",
            "is_active",
            "archived_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    def get_patient_nom(self, obj: Ordonnance) -> str:
        return obj.patient.nom_complet if obj.patient_id else ""

    def get_patient_id(self, obj: Ordonnance) -> str:
        return str(obj.patient_id) if obj.patient_id else ""

    def get_est_valide(self, obj: Ordonnance) -> bool:
        return obj.est_valide

    def get_est_expiree(self, obj: Ordonnance) -> bool:
        return obj.est_expiree


# ── Création / Modification ───────────────────────────────────────────────────

class OrdonnanceCreateUpdateSerializer(serializers.ModelSerializer):
    """
    POST /ordonnances/ et PATCH /ordonnances/{id}/.

    Pattern identique à RendezVousCreateUpdateSerializer :
      - patient    → queryset=Patient.objects.none() au niveau classe,
                     surchargé dans __init__ selon le rôle
      - rendezvous → queryset=None au niveau classe (import circulaire impossible
                     ici), surchargé dans __init__ via import local de RendezVous
                     — même technique que rendezvous/serializers.py qui importe
                     ses permissions localement dans __init__ et validate()
      - lignes     → nested write, géré dans create() et update()
      - dentiste_id injecté par perform_create(), jamais exposé ici
    """

    # ── patient — même pattern exact que RendezVousCreateUpdateSerializer ─────
    patient = serializers.PrimaryKeyRelatedField(
        queryset=Patient.objects.none(),  # surchargé dans __init__
    )

    # ── rendezvous — queryset=None car import circulaire au niveau module ──────
    # La surcharge se fait dans __init__ avec un import local
    # C'est la même technique que rendezvous/serializers.py utilise pour
    # importer _get_role / _get_user_id dans __init__ et validate()
    rendezvous = serializers.PrimaryKeyRelatedField(
        queryset=None,         # surchargé dans __init__
        required=False,
        allow_null=True,
    )

    # ── lignes — nested write ─────────────────────────────────────────────────
    lignes = LigneOrdonnanceSerializer(many=True)

    class Meta:
        model  = Ordonnance
        fields = [
            "patient",
            "rendezvous",
            "date_prescription",
            "date_expiration",
            "diagnostic",
            "instructions_generales",
            "note_pharmacien",
            "lignes",
        ]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        if not request:
            return

        from ordonnances.permissions import _get_role, _get_user_id

        role    = _get_role(request)
        user_id = _to_uuid(_get_user_id(request))

        # ── Filtre patient — même logique que RendezVousCreateUpdateSerializer ─
        if role == "dentiste" and user_id:
            self.fields["patient"].queryset = Patient.objects.filter(
                dentiste_id=user_id,
                statut=StatutValidation.ACCEPTE,
                is_active=True,
            )
        elif role == "admin":
            self.fields["patient"].queryset = Patient.objects.filter(
                statut=StatutValidation.ACCEPTE,
                is_active=True,
            )
        else:
            self.fields["patient"].queryset = Patient.objects.none()

        # ── Filtre rendezvous — import local pour éviter l'import circulaire ───
        # rendezvous/serializers.py fait la même chose : il importe
        # _get_role et _get_user_id localement dans __init__ et validate()
        # au lieu de les importer en haut du fichier
        try:
            from rendezvous.models import RendezVous
            if role == "dentiste" and user_id:
                self.fields["rendezvous"].queryset = RendezVous.objects.filter(
                    dentiste_id=user_id,
                    is_active=True,
                )
            elif role == "admin":
                self.fields["rendezvous"].queryset = RendezVous.objects.filter(
                    is_active=True,
                )
            else:
                self.fields["rendezvous"].queryset = RendezVous.objects.none()
        except ImportError:
            self.fields["rendezvous"].queryset = Ordonnance.objects.none()

    # ── Validations ───────────────────────────────────────────────────

    def validate_date_prescription(self, value):
        if value > timezone.now().date():
            raise serializers.ValidationError(
                "La date de prescription ne peut pas être dans le futur."
            )
        return value

    def validate_date_expiration(self, value):
        if value and value < timezone.now().date():
            raise serializers.ValidationError(
                "La date d'expiration ne peut pas être dans le passé."
            )
        return value

    def validate_lignes(self, value: list) -> list:
        if not value:
            raise serializers.ValidationError(
                "L'ordonnance doit contenir au moins un médicament."
            )
        if len(value) > 20:
            raise serializers.ValidationError(
                "Une ordonnance ne peut pas contenir plus de 20 médicaments."
            )
        return value

    def validate(self, attrs: dict) -> dict:
        # Vérification croisée dates prescription / expiration
        date_pres = attrs.get("date_prescription", getattr(self.instance, "date_prescription", None))
        date_exp  = attrs.get("date_expiration",   getattr(self.instance, "date_expiration",   None))

        if date_pres and date_exp and date_exp <= date_pres:
            raise serializers.ValidationError({
                "date_expiration": (
                    "La date d'expiration doit être postérieure à la date de prescription."
                )
            })

        # Vérification que le rendez-vous appartient au même patient
        patient    = attrs.get("patient",    getattr(self.instance, "patient",    None))
        rendezvous = attrs.get("rendezvous", getattr(self.instance, "rendezvous", None))
        if patient and rendezvous:
            if str(rendezvous.patient_id) != str(patient.pk):
                raise serializers.ValidationError({
                    "rendezvous": "Ce rendez-vous n'appartient pas au patient sélectionné."
                })

        return attrs

    # ── Nested write ──────────────────────────────────────────────────

    def create(self, validated_data: dict) -> Ordonnance:
        lignes_data = validated_data.pop("lignes")
        validated_data["numero"] = Ordonnance.generer_numero()
        ordonnance = Ordonnance.objects.create(**validated_data)
        for idx, ligne_data in enumerate(lignes_data, start=1):
            ligne_data.setdefault("ordre", idx)
            LigneOrdonnance.objects.create(ordonnance=ordonnance, **ligne_data)
        return ordonnance

    def update(self, instance: Ordonnance, validated_data: dict) -> Ordonnance:
        lignes_data = validated_data.pop("lignes", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        # Suppression + re-création — simple et atomique
        if lignes_data is not None:
            instance.lignes.all().delete()
            for idx, ligne_data in enumerate(lignes_data, start=1):
                ligne_data["ordre"] = idx
                LigneOrdonnance.objects.create(ordonnance=instance, **ligne_data)
        return instance


# ── Annulation ────────────────────────────────────────────────────────────────

class OrdonnanceAnnulationSerializer(serializers.Serializer):
    """PATCH /ordonnances/{id}/annuler/"""
    raison = serializers.CharField(required=False, allow_blank=True, default="")


# ── Statistiques ──────────────────────────────────────────────────────────────

class OrdonnanceStatsSerializer(serializers.Serializer):
    """GET /ordonnances/stats/"""
    total           = serializers.IntegerField()
    actives         = serializers.IntegerField()
    expirees        = serializers.IntegerField()
    annulees        = serializers.IntegerField()
    archivees       = serializers.IntegerField()
    ce_mois         = serializers.IntegerField()
    avec_rendezvous = serializers.IntegerField()
