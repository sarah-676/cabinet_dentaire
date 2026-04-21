"""
radios/serializers.py — api_service
======================================
Serializers pour les radiographies.

  RadioListSerializer    → GET /radios/?patient_id=...  (liste images)
  RadioDetailSerializer  → GET /radios/{id}/            (détail + résultat IA)
  RadioUploadSerializer  → POST /radios/                (upload image)
  RadioUpdateSerializer  → PATCH /radios/{id}/          (modifier description)
  RadioAnalyseSerializer → réponse après @action analyser
"""

from rest_framework import serializers
from .models import Radio, StatutAnalyse, TypeRadio


# ── Liste ─────────────────────────────────────────────────────────────────────

class RadioListSerializer(serializers.ModelSerializer):
    """
    Version allégée — grille d'images dans la fiche patient.
    Affiche : miniature, type, date, statut analyse, nb anomalies.
    """
    nb_anomalies = serializers.ReadOnlyField()
    est_analysee = serializers.ReadOnlyField()

    class Meta:
        model  = Radio
        fields = [
            "id",
            "image",
            "type_radio",
            "date_prise",
            "statut_analyse",
            "est_analysee",
            "ia_anomalies_detectees",
            "nb_anomalies",
            "description",
            "created_at",
        ]
        read_only_fields = fields


# ── Détail ────────────────────────────────────────────────────────────────────

class RadioDetailSerializer(serializers.ModelSerializer):
    """
    Version complète — fiche radio avec résultat IA complet.
    Affiché quand on clique sur une radio.
    """
    nb_anomalies = serializers.ReadOnlyField()
    est_analysee = serializers.ReadOnlyField()

    class Meta:
        model  = Radio
        fields = [
            "id",
            "patient",
            "dentiste_id",
            "image",
            "type_radio",
            "date_prise",
            "description",
            # Analyse IA
            "statut_analyse",
            "est_analysee",
            "ia_resultat",
            "ia_anomalies",
            "ia_confidence",
            "ia_anomalies_detectees",
            "nb_anomalies",
            "ia_analyse_at",
            "ia_erreur",
            # Admin
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


# ── Upload ────────────────────────────────────────────────────────────────────

class RadioUploadSerializer(serializers.ModelSerializer):
    """
    POST /radios/
    Upload d'une nouvelle image radiographique.

    dentiste_id est injecté par le ViewSet (perform_create).
    patient     est fourni dans le body par le frontend.
    """

    class Meta:
        model  = Radio
        fields = [
            "patient",
            "image",
            "type_radio",
            "date_prise",
            "description",
        ]

    def validate_image(self, value):
        """Validation du fichier image uploadé."""
        # Vérifier la taille (max 10 MB)
        max_size = 10 * 1024 * 1024   # 10 MB
        if value.size > max_size:
            raise serializers.ValidationError(
                f"L'image est trop lourde ({value.size // 1024 // 1024} MB). "
                f"Taille maximum : 10 MB."
            )

        # Vérifier le format
        allowed_formats = ["image/jpeg", "image/jpg", "image/png", "image/webp"]
        content_type    = getattr(value, "content_type", "")
        if content_type and content_type not in allowed_formats:
            raise serializers.ValidationError(
                "Format non supporté. Formats acceptés : JPEG, PNG, WebP."
            )

        return value

    def validate_patient(self, value):
        """Vérifier que le patient appartient bien au dentiste courant."""
        request = self.context.get("request")
        if not request:
            return value

        user = getattr(request, "user", None)
        if not user:
            return value

        # Récupérer l'ID du dentiste
        user_id = str(user.id) if hasattr(user, "id") else str(user.get("user_id", ""))
        role    = user.role if hasattr(user, "role") else user.get("role", "")

        # Dentiste → vérifier que c'est son patient
        if role == "dentiste" and str(value.dentiste_id) != user_id:
            raise serializers.ValidationError(
                "Vous ne pouvez ajouter une radio qu'à vos propres patients."
            )

        return value


# ── Modification ──────────────────────────────────────────────────────────────

class RadioUpdateSerializer(serializers.ModelSerializer):
    """
    PATCH /radios/{id}/
    Modifier uniquement la description et le type.
    L'image, le patient et les résultats IA sont en lecture seule.
    """

    class Meta:
        model  = Radio
        fields = ["type_radio", "date_prise", "description"]


# ── Résultat analyse ──────────────────────────────────────────────────────────

class RadioAnalyseResultatSerializer(serializers.ModelSerializer):
    """
    Réponse après @action analyser.
    Retourne le statut et le résultat de l'analyse IA.
    """
    nb_anomalies = serializers.ReadOnlyField()

    class Meta:
        model  = Radio
        fields = [
            "id",
            "statut_analyse",
            "ia_resultat",
            "ia_anomalies",
            "ia_confidence",
            "ia_anomalies_detectees",
            "nb_anomalies",
            "ia_analyse_at",
            "ia_erreur",
        ]
        read_only_fields = fields


# ── Stats ─────────────────────────────────────────────────────────────────────

class RadioStatsSerializer(serializers.Serializer):
    """GET /radios/stats/ — statistiques pour le dashboard."""
    total               = serializers.IntegerField()
    analysees           = serializers.IntegerField()
    en_attente          = serializers.IntegerField()
    avec_anomalies      = serializers.IntegerField()
    par_type            = serializers.DictField(child=serializers.IntegerField())
