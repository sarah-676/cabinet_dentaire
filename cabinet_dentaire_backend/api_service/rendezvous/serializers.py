"""
rendezvous/serializers.py
==========================
Serializers spécialisés selon le contexte.

  RendezVousListSerializer         → GET /rendezvous/         (carte légère)
  RendezVousDetailSerializer       → GET /rendezvous/{id}/    (fiche complète)
  RendezVousCreateUpdateSerializer → POST / PATCH             (création/modif)
  RendezVousValidationSerializer   → PATCH /valider/          (accepter/refuser)
  RendezVousStatsSerializer        → GET /stats/              (tableau de bord)
  RendezVousCalendarSerializer     → GET /calendar/           (vue calendrier)

Cohérence avec patients/serializers.py :
  - Même pattern SerializerMethodField pour les propriétés calculées
  - Même validation croisée dans validate()
  - dentiste_id injecté par la vue (perform_create), jamais exposé en écriture
"""

import uuid as uuid_module
from django.utils import timezone
from rest_framework import serializers

from .models import RendezVous, StatutRDV, TypeSoin, PrioriteRDV
from patients.models import Patient, StatutValidation


# ── Helpers ───────────────────────────────────────────────────────────────────

def _to_uuid(value):
    if isinstance(value, uuid_module.UUID):
        return value
    try:
        return uuid_module.UUID(str(value))
    except (ValueError, AttributeError):
        return None


# ── Liste (carte légère) ──────────────────────────────────────────────────────

class RendezVousListSerializer(serializers.ModelSerializer):
    """
    Version allégée pour GET /rendezvous/ et section rendezvous du dossier patient.
    Utilisé aussi dans patients/views.py → _section_rendezvous().
    """
    patient_nom    = serializers.SerializerMethodField()
    patient_id     = serializers.SerializerMethodField()
    date_fin       = serializers.SerializerMethodField()
    est_passe      = serializers.SerializerMethodField()
    est_aujourd_hui = serializers.SerializerMethodField()

    class Meta:
        model  = RendezVous
        fields = [
            "id",
            "patient_id",
            "patient_nom",
            "date_heure",
            "date_fin",
            "duree_minutes",
            "type_soin",
            "priorite",
            "statut",
            "motif",
            "est_passe",
            "est_aujourd_hui",
            "rappel_envoye",
            "created_at",
        ]

    def get_patient_nom(self, obj: RendezVous) -> str:
        return obj.patient.nom_complet if obj.patient_id else ""

    def get_patient_id(self, obj: RendezVous) -> str:
        return str(obj.patient_id) if obj.patient_id else ""

    def get_date_fin(self, obj: RendezVous) -> str:
        return obj.date_fin.isoformat()

    def get_est_passe(self, obj: RendezVous) -> bool:
        return obj.est_passe

    def get_est_aujourd_hui(self, obj: RendezVous) -> bool:
        return obj.est_aujourd_hui


# ── Détail (fiche complète) ───────────────────────────────────────────────────

class RendezVousDetailSerializer(serializers.ModelSerializer):
    """Fiche complète en lecture seule."""
    patient_nom     = serializers.SerializerMethodField()
    patient_id      = serializers.SerializerMethodField()
    date_fin        = serializers.SerializerMethodField()
    est_passe       = serializers.SerializerMethodField()
    est_aujourd_hui = serializers.SerializerMethodField()
    est_urgent      = serializers.SerializerMethodField()
    est_en_attente  = serializers.SerializerMethodField()

    class Meta:
        model  = RendezVous
        fields = [
            "id",
            # patient
            "patient_id",
            "patient_nom",
            # planification
            "date_heure",
            "date_fin",
            "duree_minutes",
            # soin
            "type_soin",
            "priorite",
            "motif",
            "note_interne",
            "instructions_patient",
            # statut
            "statut",
            "refuse_raison",
            # flags calculés
            "est_passe",
            "est_aujourd_hui",
            "est_urgent",
            "est_en_attente",
            # rappels
            "rappel_envoye",
            "rappel_at",
            # admin
            "dentiste_id",
            "receptionniste_id",
            "is_active",
            "cancelled_at",
            "cancelled_by",
            # timestamps
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    def get_patient_nom(self, obj: RendezVous) -> str:
        return obj.patient.nom_complet if obj.patient_id else ""

    def get_patient_id(self, obj: RendezVous) -> str:
        return str(obj.patient_id) if obj.patient_id else ""

    def get_date_fin(self, obj: RendezVous) -> str:
        return obj.date_fin.isoformat()

    def get_est_passe(self, obj: RendezVous) -> bool:
        return obj.est_passe

    def get_est_aujourd_hui(self, obj: RendezVous) -> bool:
        return obj.est_aujourd_hui

    def get_est_urgent(self, obj: RendezVous) -> bool:
        return obj.est_urgent

    def get_est_en_attente(self, obj: RendezVous) -> bool:
        return obj.est_en_attente


# ── Création / Modification ───────────────────────────────────────────────────

class RendezVousCreateUpdateSerializer(serializers.ModelSerializer):
    """
    POST /rendezvous/ et PATCH /rendezvous/{id}/.

    dentiste_id, statut et receptionniste_id sont injectés
    par le ViewSet (perform_create) — jamais exposés en écriture directe.

    patient doit être un UUID valide appartenant au dentiste concerné.
    """
    patient = serializers.PrimaryKeyRelatedField(
        queryset=Patient.objects.none(),   # filtré dynamiquement dans __init__
    )

    class Meta:
        model  = RendezVous
        fields = [
            "patient",
            "date_heure",
            "duree_minutes",
            "type_soin",
            "priorite",
            "motif",
            "note_interne",
            "instructions_patient",
        ]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        if not request:
            return

        # Restreindre le queryset patient selon le rôle
        from rendezvous.permissions import _get_role, _get_user_id

        role    = _get_role(request)
        user_id = _to_uuid(_get_user_id(request))

        if role == "dentiste" and user_id:
            # Le dentiste ne peut créer un RDV que pour ses propres patients acceptés
            self.fields["patient"].queryset = Patient.objects.filter(
                dentiste_id=user_id,
                statut=StatutValidation.ACCEPTE,
                is_active=True,
            )
        elif role in ("admin", "receptionniste"):
            # Admin/réceptionniste voit tous les patients actifs et acceptés
            self.fields["patient"].queryset = Patient.objects.filter(
                statut=StatutValidation.ACCEPTE,
                is_active=True,
            )
        else:
            self.fields["patient"].queryset = Patient.objects.none()

    # ── Validations ───────────────────────────────────────────────────

    def validate_date_heure(self, value):
        """La date ne peut pas être dans le passé (sauf admin en PATCH)."""
        request = self.context.get("request")
        is_create = self.instance is None

        if is_create and value <= timezone.now():
            raise serializers.ValidationError(
                "La date du rendez-vous doit être dans le futur."
            )
        return value

    def validate_duree_minutes(self, value: int) -> int:
        if value < 5:
            raise serializers.ValidationError("La durée minimale est de 5 minutes.")
        if value > 480:
            raise serializers.ValidationError("La durée maximale est de 8 heures (480 min).")
        return value

    def validate(self, attrs: dict) -> dict:
        """
        Vérification de chevauchement de RDV pour le même dentiste.
        Applicable uniquement à la création ou si la date/durée change.
        """
        request     = self.context.get("request")
        date_heure  = attrs.get("date_heure",     getattr(self.instance, "date_heure",     None))
        duree       = attrs.get("duree_minutes",  getattr(self.instance, "duree_minutes",  30))

        if not date_heure:
            return attrs

        from rendezvous.permissions import _get_role, _get_user_id

        role        = _get_role(request)
        dentiste_id = _to_uuid(_get_user_id(request)) if role == "dentiste" else None

        # Pour réceptionniste/admin → dentiste_id fourni dans le contexte de la vue
        if not dentiste_id:
            dentiste_id = _to_uuid(self.context.get("dentiste_id"))

        if dentiste_id:
            date_fin = date_heure + timezone.timedelta(minutes=duree)
            qs = RendezVous.objects.filter(
                dentiste_id=dentiste_id,
                statut=StatutRDV.ACCEPTE,
                is_active=True,
                date_heure__lt=date_fin,
            ).filter(
                # date_fin calculée > date_heure demandée
                # Équivalent : date_heure + duree_minutes > date_heure_nouveau
                date_heure__gt=date_heure - timezone.timedelta(minutes=duree),
            )
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)

            if qs.exists():
                raise serializers.ValidationError({
                    "date_heure": (
                        "Ce créneau chevauche un rendez-vous existant "
                        "pour ce dentiste. Veuillez choisir un autre horaire."
                    )
                })

        return attrs


# ── Validation (accepter / refuser) ──────────────────────────────────────────

class RendezVousValidationSerializer(serializers.Serializer):
    """
    PATCH /rendezvous/{id}/valider/
    Checklist R-06, R-07 — validation dentiste obligatoire.
    """
    decision      = serializers.ChoiceField(choices=["ACCEPTE", "REFUSE"])
    refuse_raison = serializers.CharField(
        required=False,
        allow_blank=True,
        default="",
    )

    def validate(self, attrs: dict) -> dict:
        if attrs["decision"] == "REFUSE" and not attrs.get("refuse_raison", "").strip():
            raise serializers.ValidationError({
                "refuse_raison": "Une raison est obligatoire en cas de refus."
            })
        return attrs


# ── Annulation ────────────────────────────────────────────────────────────────

class RendezVousAnnulationSerializer(serializers.Serializer):
    """PATCH /rendezvous/{id}/annuler/"""
    raison = serializers.CharField(required=False, allow_blank=True, default="")


# ── Statistiques ──────────────────────────────────────────────────────────────

class RendezVousStatsSerializer(serializers.Serializer):
    """
    GET /rendezvous/stats/
    Checklist D-01 — tableau de bord dentiste.
    """
    total             = serializers.IntegerField()
    aujourd_hui       = serializers.IntegerField()
    cette_semaine     = serializers.IntegerField()
    ce_mois           = serializers.IntegerField()
    en_attente        = serializers.IntegerField()
    acceptes          = serializers.IntegerField()
    refuses           = serializers.IntegerField()
    annules           = serializers.IntegerField()
    termines          = serializers.IntegerField()
    urgents           = serializers.IntegerField()
    a_venir           = serializers.IntegerField()


# ── Calendrier ────────────────────────────────────────────────────────────────

class RendezVousCalendarSerializer(serializers.ModelSerializer):
    """
    GET /rendezvous/calendar/
    Format optimisé pour l'affichage FullCalendar / agenda.
    """
    title   = serializers.SerializerMethodField()
    start   = serializers.SerializerMethodField()
    end     = serializers.SerializerMethodField()
    color   = serializers.SerializerMethodField()
    patient_nom = serializers.SerializerMethodField()

    class Meta:
        model  = RendezVous
        fields = [
            "id",
            "title",
            "start",
            "end",
            "color",
            "statut",
            "type_soin",
            "priorite",
            "patient_id",
            "patient_nom",
        ]

    # Couleurs par statut
    _COLORS = {
        StatutRDV.PENDING: "#F59E0B",   # amber
        StatutRDV.ACCEPTE: "#10B981",   # green
        StatutRDV.REFUSE:  "#EF4444",   # red
        StatutRDV.ANNULE:  "#6B7280",   # gray
        StatutRDV.TERMINE: "#3B82F6",   # blue
    }

    def get_title(self, obj: RendezVous) -> str:
        return f"{obj.patient.nom_complet} — {obj.get_type_soin_display()}"

    def get_start(self, obj: RendezVous) -> str:
        return obj.date_heure.isoformat()

    def get_end(self, obj: RendezVous) -> str:
        return obj.date_fin.isoformat()

    def get_color(self, obj: RendezVous) -> str:
        return self._COLORS.get(obj.statut, "#6B7280")

    def get_patient_nom(self, obj: RendezVous) -> str:
        return obj.patient.nom_complet if obj.patient_id else ""