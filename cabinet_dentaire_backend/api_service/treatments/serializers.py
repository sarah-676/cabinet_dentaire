"""
treatments/serializers.py — api_service
=========================================
Serializers pour l'app traitements.

  SeanceSoinSerializer            → lecture/écriture d'une séance
  TraitementListSerializer        → liste allégée (GET /treatments/)
  TraitementDetailSerializer      → fiche complète en lecture seule
  TraitementCreateSerializer      → création d'un traitement
  TraitementUpdateSerializer      → modification partielle
  TraitementStatutSerializer      → changer le statut (demarrer/terminer/abandonner)
  TraitementStatsSerializer       → statistiques tableau de bord
  SeanceSoinCreateSerializer      → ajouter une séance à un traitement
"""

from decimal import Decimal

from django.utils import timezone
from rest_framework import serializers

from .models import (
    Traitement,
    SeanceSoin,
    StatutTraitement,
    TypeActe,
    Materiau,
    NumeroDent,
)


# ══════════════════════════════════════════════════════════════════════════════
# SÉANCES
# ══════════════════════════════════════════════════════════════════════════════

class SeanceSoinSerializer(serializers.ModelSerializer):
    """Lecture complète d'une séance."""

    class Meta:
        model  = SeanceSoin
        fields = [
            "id",
            "numero_seance",
            "date",
            "duree_minutes",
            "acte_realise",
            "observations",
            "prochain_rdv_notes",
            "rendezvous",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class SeanceSoinCreateSerializer(serializers.ModelSerializer):
    """
    Création d'une séance.
    Le traitement est injecté par le ViewSet (perform_create).
    """

    class Meta:
        model  = SeanceSoin
        fields = [
            "numero_seance",
            "date",
            "duree_minutes",
            "acte_realise",
            "observations",
            "prochain_rdv_notes",
            "rendezvous",
        ]

    def validate_date(self, value):
        if value > timezone.now().date():
            raise serializers.ValidationError(
                "La date d'une séance ne peut pas être dans le futur."
            )
        return value

    def validate_numero_seance(self, value):
        traitement = self.context.get("traitement")
        if traitement and value > traitement.nombre_seances_prevues:
            raise serializers.ValidationError(
                f"Le numéro de séance ({value}) dépasse le nombre de "
                f"séances prévues ({traitement.nombre_seances_prevues})."
            )
        return value


# ══════════════════════════════════════════════════════════════════════════════
# TRAITEMENT — LISTE
# ══════════════════════════════════════════════════════════════════════════════

class TraitementListSerializer(serializers.ModelSerializer):
    """
    Version allégée pour GET /treatments/ et le dossier patient.
    Utilisé aussi dans patients/views.py → _section_treatments().
    """
    type_acte_label   = serializers.CharField(source="get_type_acte_display", read_only=True)
    statut_label      = serializers.CharField(source="get_statut_display",    read_only=True)
    dent_label        = serializers.CharField(source="get_dent_display",      read_only=True)
    materiau_label    = serializers.CharField(source="get_materiau_display",  read_only=True)
    progression       = serializers.ReadOnlyField()
    nb_seances_faites = serializers.ReadOnlyField(source="nombre_seances_realisees")

    class Meta:
        model  = Traitement
        fields = [
            "id",
            "patient",
            "type_acte",
            "type_acte_label",
            "dent",
            "dent_label",
            "materiau",
            "materiau_label",
            "statut",
            "statut_label",
            "date_debut",
            "date_fin",
            "cout_total",
            "cout_patient",
            "progression",
            "nb_seances_faites",
            "nombre_seances_prevues",
            "anesthesie_utilisee",
            "created_at",
        ]


# ══════════════════════════════════════════════════════════════════════════════
# TRAITEMENT — DÉTAIL
# ══════════════════════════════════════════════════════════════════════════════

class TraitementDetailSerializer(serializers.ModelSerializer):
    """Fiche complète en lecture seule — inclut les séances."""
    type_acte_label       = serializers.CharField(source="get_type_acte_display", read_only=True)
    statut_label          = serializers.CharField(source="get_statut_display",    read_only=True)
    dent_label            = serializers.CharField(source="get_dent_display",      read_only=True)
    materiau_label        = serializers.CharField(source="get_materiau_display",  read_only=True)
    progression           = serializers.ReadOnlyField()
    nb_seances_faites     = serializers.ReadOnlyField(source="nombre_seances_realisees")
    duree_traitement_jours= serializers.ReadOnlyField()
    est_multi_seances     = serializers.ReadOnlyField()
    part_mutuelle         = serializers.ReadOnlyField()
    seances               = SeanceSoinSerializer(many=True, read_only=True)

    class Meta:
        model  = Traitement
        fields = [
            # identité
            "id",
            "patient",
            "dentiste_id",
            # acte
            "type_acte",
            "type_acte_label",
            "description",
            # localisation
            "dent",
            "dent_label",
            "face_dentaire",
            # matériau
            "materiau",
            "materiau_label",
            "materiau_detail",
            # planification
            "date_debut",
            "date_fin",
            "duree_estimee_minutes",
            "nombre_seances_prevues",
            "nb_seances_faites",
            "progression",
            "duree_traitement_jours",
            "est_multi_seances",
            # statut
            "statut",
            "statut_label",
            "raison_abandon",
            # coût
            "cout_total",
            "cout_patient",
            "part_mutuelle",
            "est_couvert_mutuelle",
            "reference_mutuelle",
            # anesthésie
            "anesthesie_utilisee",
            "type_anesthesie",
            # notes
            "notes_pre_op",
            "notes_per_op",
            "notes_post_op",
            "instructions_patient",
            # relations
            "rendezvous",
            "seances",
            # timestamps
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


# ══════════════════════════════════════════════════════════════════════════════
# TRAITEMENT — CRÉATION
# ══════════════════════════════════════════════════════════════════════════════

class TraitementCreateSerializer(serializers.ModelSerializer):
    """
    POST /treatments/
    patient et dentiste_id sont injectés par le ViewSet (perform_create).
    """

    class Meta:
        model  = Traitement
        fields = [
            "patient",
            # acte
            "type_acte",
            "description",
            # localisation
            "dent",
            "face_dentaire",
            # matériau
            "materiau",
            "materiau_detail",
            # planification
            "date_debut",
            "date_fin",
            "duree_estimee_minutes",
            "nombre_seances_prevues",
            # statut initial
            "statut",
            # coût
            "cout_total",
            "cout_patient",
            "est_couvert_mutuelle",
            "reference_mutuelle",
            # anesthésie
            "anesthesie_utilisee",
            "type_anesthesie",
            # notes
            "notes_pre_op",
            "notes_per_op",
            "notes_post_op",
            "instructions_patient",
            # lien RDV
            "rendezvous",
        ]

    # ── Validations ───────────────────────────────────────────────────

    def validate_date_debut(self, value):
        """La date de début ne peut pas être trop ancienne (> 10 ans)."""
        limite = timezone.now().date().replace(
            year=timezone.now().year - 10
        )
        if value < limite:
            raise serializers.ValidationError(
                "La date de début semble incorrecte (plus de 10 ans dans le passé)."
            )
        return value

    def validate_date_fin(self, value):
        if value and value < timezone.now().date():
            # date_fin dans le passé est valide (traitement déjà terminé)
            pass
        return value

    def validate_cout_patient(self, value):
        if value < Decimal("0"):
            raise serializers.ValidationError("Le coût patient ne peut pas être négatif.")
        return value

    def validate_cout_total(self, value):
        if value < Decimal("0"):
            raise serializers.ValidationError("Le coût total ne peut pas être négatif.")
        return value

    def validate(self, attrs):
        # cout_patient ne peut pas dépasser cout_total
        cout_total   = attrs.get("cout_total",   self.instance.cout_total   if self.instance else Decimal("0"))
        cout_patient = attrs.get("cout_patient", self.instance.cout_patient if self.instance else Decimal("0"))
        if cout_patient > cout_total:
            raise serializers.ValidationError({
                "cout_patient": (
                    "La part patient ne peut pas dépasser le coût total "
                    f"({cout_total} DZD)."
                )
            })

        # date_fin >= date_debut
        date_debut = attrs.get("date_debut")
        date_fin   = attrs.get("date_fin")
        if date_debut and date_fin and date_fin < date_debut:
            raise serializers.ValidationError({
                "date_fin": "La date de fin doit être postérieure à la date de début."
            })

        # anesthesie_utilisee → type_anesthesie recommandé
        if attrs.get("anesthesie_utilisee") and not attrs.get("type_anesthesie", "").strip():
            # Avertissement non bloquant — on laisse passer
            pass

        # mutuelle → référence recommandée
        if attrs.get("est_couvert_mutuelle") and not attrs.get("reference_mutuelle", "").strip():
            pass

        return attrs

    def validate_patient(self, value):
        """Vérifier que le patient existe et est actif."""
        if not value.is_active:
            raise serializers.ValidationError(
                "Impossible d'ajouter un traitement à un patient archivé."
            )
        return value


# ══════════════════════════════════════════════════════════════════════════════
# TRAITEMENT — MODIFICATION
# ══════════════════════════════════════════════════════════════════════════════

class TraitementUpdateSerializer(serializers.ModelSerializer):
    """
    PATCH /treatments/{id}/
    Champs modifiables — on ne peut pas changer le patient ni le dentiste.
    """

    class Meta:
        model  = Traitement
        fields = [
            "type_acte",
            "description",
            "dent",
            "face_dentaire",
            "materiau",
            "materiau_detail",
            "date_debut",
            "date_fin",
            "duree_estimee_minutes",
            "nombre_seances_prevues",
            "cout_total",
            "cout_patient",
            "est_couvert_mutuelle",
            "reference_mutuelle",
            "anesthesie_utilisee",
            "type_anesthesie",
            "notes_pre_op",
            "notes_per_op",
            "notes_post_op",
            "instructions_patient",
            "rendezvous",
        ]

    def validate(self, attrs):
        # Réutiliser les mêmes validations que Create
        cout_total   = attrs.get("cout_total",   self.instance.cout_total)
        cout_patient = attrs.get("cout_patient", self.instance.cout_patient)
        if cout_patient > cout_total:
            raise serializers.ValidationError({
                "cout_patient": f"La part patient ne peut pas dépasser le coût total ({cout_total} DZD)."
            })
        date_debut = attrs.get("date_debut", self.instance.date_debut)
        date_fin   = attrs.get("date_fin",   self.instance.date_fin)
        if date_debut and date_fin and date_fin < date_debut:
            raise serializers.ValidationError({
                "date_fin": "La date de fin doit être postérieure à la date de début."
            })
        return attrs

    def validate_statut(self, value):
        """
        Le statut ne se change pas via PATCH normal.
        Utiliser les actions dédiées : /demarrer/, /terminer/, /abandonner/.
        """
        raise serializers.ValidationError(
            "Pour changer le statut, utiliser les actions dédiées : "
            "/demarrer/, /terminer/, /abandonner/."
        )


# ══════════════════════════════════════════════════════════════════════════════
# CHANGEMENT DE STATUT
# ══════════════════════════════════════════════════════════════════════════════

class TraitementAbandonnerSerializer(serializers.Serializer):
    """PATCH /treatments/{id}/abandonner/ — raison obligatoire."""
    raison_abandon = serializers.CharField(
        required=True,
        min_length=5,
        max_length=500,
        error_messages={"required": "Une raison d'abandon est obligatoire."},
    )


# ══════════════════════════════════════════════════════════════════════════════
# STATISTIQUES
# ══════════════════════════════════════════════════════════════════════════════

class TraitementStatsSerializer(serializers.Serializer):
    """GET /treatments/stats/ — tableau de bord dentiste."""
    total            = serializers.IntegerField()
    planifies        = serializers.IntegerField()
    en_cours         = serializers.IntegerField()
    termines         = serializers.IntegerField()
    abandonnes       = serializers.IntegerField()
    ce_mois          = serializers.IntegerField()
    chiffre_affaires = serializers.DecimalField(max_digits=12, decimal_places=2)
    actes_frequents  = serializers.ListField(child=serializers.DictField())