"""
patients/serializers.py
========================
Serializers spécialisés selon le contexte.

  PatientListSerializer         → GET /patients/
  PatientDetailSerializer       → GET /patients/{id}/
  PatientCreateUpdateSerializer → POST / PATCH
  PatientValidationSerializer   → PATCH /valider/
  PatientStatsSerializer        → GET /stats/
  AlerteMedicaleSerializer      → sous-objet dans Detail et Dossier

Note N+1 :
  alertes_actives utilise uniquement des champs booléens déjà chargés en mémoire.
  get_nb_alertes_critiques() ne génère aucune requête SQL supplémentaire.
"""

from rest_framework import serializers
from django.utils import timezone

from .models import Patient, StatutValidation, GroupeSanguin


# ── Helpers ───────────────────────────────────────────────────────────────────

def _calcul_age(date_naissance) -> int:
    today = timezone.now().date()
    return today.year - date_naissance.year - (
        (today.month, today.day) < (date_naissance.month, date_naissance.day)
    )


# ── Alerte médicale ───────────────────────────────────────────────────────────

class AlerteMedicaleSerializer(serializers.Serializer):
    """
    Représente une alerte médicale calculée (non stockée directement en DB).
    Alimenté par Patient.alertes_actives.
    """
    code    = serializers.CharField()
    label   = serializers.CharField()
    niveau  = serializers.CharField()   # CRITIQUE | AVERTISSEMENT | INFO
    conseil = serializers.CharField()


# ── Liste ─────────────────────────────────────────────────────────────────────

class PatientListSerializer(serializers.ModelSerializer):
    """Version allégée pour GET /patients/ — cartes patients."""
    nom_complet          = serializers.SerializerMethodField()
    age                  = serializers.SerializerMethodField()
    nb_alertes_critiques = serializers.SerializerMethodField()

    class Meta:
        model  = Patient
        fields = [
            "id",
            "nom_complet",
            "nom",
            "prenom",
            "age",
            "sexe",
            "telephone",
            "date_naissance",
            "groupe_sanguin",
            "statut",
            "is_active",
            "created_at",
            "nb_alertes_critiques",
        ]

    def get_nom_complet(self, obj: Patient) -> str:
        return obj.nom_complet

    def get_age(self, obj: Patient) -> int:
        return _calcul_age(obj.date_naissance)

    def get_nb_alertes_critiques(self, obj: Patient) -> int:
        """
        Nombre d'alertes CRITIQUE — badge rouge dans la liste.
        Zéro requête SQL : alertes_actives lit uniquement des champs booléens
        déjà présents en mémoire depuis le queryset principal.
        """
        return sum(1 for a in obj.alertes_actives if a["niveau"] == "CRITIQUE")


# ── Détail ────────────────────────────────────────────────────────────────────

class PatientDetailSerializer(serializers.ModelSerializer):
    """Fiche complète en lecture seule."""
    nom_complet = serializers.SerializerMethodField()
    age         = serializers.SerializerMethodField()
    est_mineur  = serializers.SerializerMethodField()
    alertes     = serializers.SerializerMethodField()

    class Meta:
        model  = Patient
        fields = [
            "id",
            "nom",
            "prenom",
            "nom_complet",
            "age",
            "est_mineur",
            "sexe",
            "date_naissance",
            "telephone",
            "email",
            "adresse",
            # médical
            "groupe_sanguin",
            "allergies",
            "antecedents",
            "medicaments_actuels",
            "note_generale",
            # alertes structurées (flags bruts)
            "alerte_anticoagulants",
            "alerte_diabete",
            "alerte_grossesse",
            "alerte_allergie_latex",
            "alerte_cardiopathie",
            "alerte_immunodeprime",
            "alertes",          # calculé
            # admin
            "dentiste_id",
            "statut",
            "refuse_raison",
            "is_active",
            "archived_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    def get_nom_complet(self, obj: Patient) -> str:
        return obj.nom_complet

    def get_age(self, obj: Patient) -> int:
        return _calcul_age(obj.date_naissance)

    def get_est_mineur(self, obj: Patient) -> bool:
        return obj.est_mineur

    def get_alertes(self, obj: Patient) -> list:
        return AlerteMedicaleSerializer(obj.alertes_actives, many=True).data


# ── Création / Modification ───────────────────────────────────────────────────

class PatientCreateUpdateSerializer(serializers.ModelSerializer):
    """
    POST /patients/ et PATCH /patients/{id}/.
    dentiste_id et statut sont injectés par le ViewSet (perform_create).
    """

    class Meta:
        model  = Patient
        fields = [
            # identité
            "nom",
            "prenom",
            "sexe",
            "date_naissance",
            "telephone",
            "email",
            "adresse",
            # médical
            "groupe_sanguin",
            "allergies",
            "antecedents",
            "medicaments_actuels",
            "note_generale",
            # alertes (checkboxes)
            "alerte_anticoagulants",
            "alerte_diabete",
            "alerte_grossesse",
            "alerte_allergie_latex",
            "alerte_cardiopathie",
            "alerte_immunodeprime",
        ]

    # ── Validations individuelles ─────────────────────────────────────

    def validate_nom(self, value: str) -> str:
        return value.strip().upper()

    def validate_prenom(self, value: str) -> str:
        return value.strip().capitalize()

    def validate_date_naissance(self, value):
        today = timezone.now().date()
        if value >= today:
            raise serializers.ValidationError(
                "La date de naissance doit être dans le passé."
            )
        age = today.year - value.year - (
            (today.month, today.day) < (value.month, value.day)
        )
        if age > 120:
            raise serializers.ValidationError("Date de naissance invalide (> 120 ans).")
        return value

    def validate_telephone(self, value: str) -> str:
        cleaned = value.strip().replace(" ", "").replace("-", "").replace(".", "")
        if not cleaned.lstrip("+").isdigit():
            raise serializers.ValidationError(
                "Le numéro doit contenir uniquement des chiffres."
            )
        if len(cleaned.lstrip("+")) < 9:
            raise serializers.ValidationError(
                "Le numéro doit contenir au moins 9 chiffres."
            )
        return cleaned

    def validate_groupe_sanguin(self, value: str) -> str:
        valeurs_valides = [choice[0] for choice in GroupeSanguin.choices]
        if value and value not in valeurs_valides:
            raise serializers.ValidationError("Groupe sanguin invalide.")
        return value or GroupeSanguin.INCONNU

    # ── Validation croisée ────────────────────────────────────────────

    def validate(self, attrs: dict) -> dict:
        nom    = attrs.get("nom",    getattr(self.instance, "nom",    "") or "")
        prenom = attrs.get("prenom", getattr(self.instance, "prenom", "") or "")
        if nom and prenom and nom.lower() == prenom.lower():
            raise serializers.ValidationError(
                {"prenom": "Le prénom ne peut pas être identique au nom."}
            )
        return attrs


# ── Validation (accepter / refuser) ──────────────────────────────────────────

class PatientValidationSerializer(serializers.Serializer):
    """PATCH /patients/{id}/valider/"""
    decision      = serializers.ChoiceField(choices=["ACCEPTE", "REFUSE"])
    refuse_raison = serializers.CharField(required=False, allow_blank=True, default="")

    def validate(self, attrs: dict) -> dict:
        if attrs["decision"] == "REFUSE" and not attrs.get("refuse_raison", "").strip():
            raise serializers.ValidationError(
                {"refuse_raison": "Une raison est obligatoire en cas de refus."}
            )
        return attrs


# ── Statistiques ──────────────────────────────────────────────────────────────

class PatientStatsSerializer(serializers.Serializer):
    """GET /patients/stats/ — tableau de bord dentiste."""
    total            = serializers.IntegerField()
    actifs           = serializers.IntegerField()
    archives         = serializers.IntegerField()
    nouveaux_ce_mois = serializers.IntegerField()
    en_attente       = serializers.IntegerField()
    refuses          = serializers.IntegerField()
    mineurs          = serializers.IntegerField()
    avec_alertes     = serializers.IntegerField()


