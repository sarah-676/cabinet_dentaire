"""
rendezvous/models.py — api_service
=====================================
Modèle RendezVous pour le cabinet dentaire.

Cycle de vie (checklist R-06, R-07) :
  Réceptionniste crée  → statut PENDING
  Dentiste accepte     → statut ACCEPTE  (notification envoyée)
  Dentiste refuse      → statut REFUSE   (notification envoyée)
  Dentiste/Admin annule → statut ANNULE

Cohérence avec patients/models.py :
  - patient      → ForeignKey vers Patient (UUID)
  - dentiste_id  → UUIDField (pas IntegerField — auth_service utilise UUID)
  - receptionniste_id → UUIDField (nullable)
  - Même pattern soft-delete via is_active
  - Même pattern StatutValidation étendu
"""

import uuid

from django.db import models
from django.utils import timezone
from django.core.validators import MinValueValidator

from patients.models import Patient


# ── Choix ─────────────────────────────────────────────────────────────────────

class StatutRDV(models.TextChoices):
    PENDING = "PENDING", "En attente de validation"
    ACCEPTE = "ACCEPTE", "Accepté"
    REFUSE  = "REFUSE",  "Refusé"
    ANNULE  = "ANNULE",  "Annulé"
    TERMINE = "TERMINE", "Terminé"


class TypeSoin(models.TextChoices):
    CONSULTATION      = "CONSULTATION",      "Consultation"
    DETARTRAGE        = "DETARTRAGE",        "Détartrage"
    EXTRACTION        = "EXTRACTION",        "Extraction"
    OBTURATION        = "OBTURATION",        "Obturation / Plombage"
    COURONNE          = "COURONNE",          "Couronne"
    IMPLANT           = "IMPLANT",           "Implant"
    ORTHODONTIE       = "ORTHODONTIE",       "Orthodontie"
    RADIOGRAPHIE      = "RADIOGRAPHIE",      "Radiographie"
    CHIRURGIE         = "CHIRURGIE",         "Chirurgie buccale"
    BLANCHIMENT       = "BLANCHIMENT",       "Blanchiment"
    CONTROLE          = "CONTROLE",          "Contrôle / Suivi"
    URGENCE           = "URGENCE",           "Urgence"
    AUTRE             = "AUTRE",             "Autre"


class PrioriteRDV(models.TextChoices):
    NORMALE = "NORMALE", "Normale"
    URGENTE = "URGENTE", "Urgente"
    HAUTE   = "HAUTE",   "Haute priorité"


# ── QuerySet / Manager ────────────────────────────────────────────────────────

class RendezVousQuerySet(models.QuerySet):

    def actifs(self):
        return self.filter(is_active=True)

    def du_dentiste(self, dentiste_id):
        return self.filter(dentiste_id=dentiste_id, is_active=True)

    def du_patient(self, patient_id):
        return self.filter(patient_id=patient_id, is_active=True)

    def en_attente(self):
        return self.filter(statut=StatutRDV.PENDING, is_active=True)

    def acceptes(self):
        return self.filter(statut=StatutRDV.ACCEPTE, is_active=True)

    def du_jour(self):
        today = timezone.now().date()
        return self.filter(
            date_heure__date=today,
            statut=StatutRDV.ACCEPTE,
            is_active=True,
        )

    def a_venir(self):
        return self.filter(
            date_heure__gte=timezone.now(),
            statut=StatutRDV.ACCEPTE,
            is_active=True,
        )

    def passes(self):
        return self.filter(
            date_heure__lt=timezone.now(),
            is_active=True,
        )

    def cette_semaine(self):
        now   = timezone.now()
        lundi = now - timezone.timedelta(days=now.weekday())
        debut = lundi.replace(hour=0, minute=0, second=0, microsecond=0)
        fin   = debut + timezone.timedelta(days=7)
        return self.filter(
            date_heure__range=(debut, fin),
            is_active=True,
        )

    def ce_mois(self):
        now = timezone.now()
        return self.filter(
            date_heure__year=now.year,
            date_heure__month=now.month,
            is_active=True,
        )

    def urgents(self):
        return self.filter(
            priorite=PrioriteRDV.URGENTE,
            is_active=True,
        )


class RendezVousManager(models.Manager):

    def get_queryset(self):
        return RendezVousQuerySet(self.model, using=self._db)

    def actifs(self):
        return self.get_queryset().actifs()

    def du_dentiste(self, dentiste_id):
        return self.get_queryset().du_dentiste(dentiste_id)

    def du_patient(self, patient_id):
        return self.get_queryset().du_patient(patient_id)

    def en_attente(self):
        return self.get_queryset().en_attente()

    def du_jour(self):
        return self.get_queryset().du_jour()

    def a_venir(self):
        return self.get_queryset().a_venir()

    def urgents(self):
        return self.get_queryset().urgents()


class AllRDVManager(models.Manager):
    """Manager sans filtre — accès à tous les RDV (actifs + annulés)."""
    def get_queryset(self):
        return RendezVousQuerySet(self.model, using=self._db)


# ── Modèle RendezVous ─────────────────────────────────────────────────────────

class RendezVous(models.Model):
    """
    Représente un rendez-vous du cabinet dentaire.

    Checklist couverte :
      T-05 — CRUD RDV avec liaison obligatoire au patient
      R-06 — Création par réceptionniste → validation dentiste obligatoire
      R-07 — États pending / accepté / refusé + notifications
      D-04 — Visible dans le dossier patient
      D-01 — Comptabilisé dans le tableau de bord
    """

    # ── PK UUID ───────────────────────────────────────────────────────
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
        verbose_name="Identifiant unique",
    )

    # ── Liaison patient (obligatoire — T-05) ──────────────────────────
    patient = models.ForeignKey(
        Patient,
        on_delete=models.CASCADE,
        related_name="rendezvous_set",
        verbose_name="Patient",
    )

    # ── Lien dentiste (UUID depuis auth_service) ──────────────────────
    dentiste_id = models.UUIDField(
        verbose_name="UUID du dentiste référent",
        db_index=True,
    )

    # ── Lien réceptionniste (nullable — créateur possible) ────────────
    receptionniste_id = models.UUIDField(
        null=True,
        blank=True,
        verbose_name="UUID de la réceptionniste créatrice",
        db_index=True,
    )

    # ── Planification ─────────────────────────────────────────────────
    date_heure = models.DateTimeField(
        verbose_name="Date et heure du rendez-vous",
        db_index=True,
    )
    duree_minutes = models.PositiveIntegerField(
        default=30,
        validators=[MinValueValidator(5)],
        verbose_name="Durée (minutes)",
    )

    # ── Type et priorité ─────────────────────────────────────────────
    type_soin = models.CharField(
        max_length=30,
        choices=TypeSoin.choices,
        default=TypeSoin.CONSULTATION,
        verbose_name="Type de soin",
        db_index=True,
    )
    priorite = models.CharField(
        max_length=10,
        choices=PrioriteRDV.choices,
        default=PrioriteRDV.NORMALE,
        verbose_name="Priorité",
        db_index=True,
    )

    # ── Statut de validation (R-06, R-07) ─────────────────────────────
    statut = models.CharField(
        max_length=10,
        choices=StatutRDV.choices,
        default=StatutRDV.ACCEPTE,
        verbose_name="Statut",
        db_index=True,
    )
    refuse_raison = models.TextField(
        blank=True,
        verbose_name="Raison du refus / annulation",
    )

    # ── Notes ─────────────────────────────────────────────────────────
    motif       = models.TextField(blank=True, verbose_name="Motif de la consultation")
    note_interne = models.TextField(blank=True, verbose_name="Note interne (dentiste)")
    instructions_patient = models.TextField(
        blank=True,
        verbose_name="Instructions pour le patient",
    )

    # ── Rappels ───────────────────────────────────────────────────────
    rappel_envoye = models.BooleanField(
        default=False,
        verbose_name="Rappel envoyé",
        help_text="Mis à True par Celery après envoi du rappel email/SMS.",
    )
    rappel_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="Date d'envoi du rappel",
    )

    # ── Soft delete ───────────────────────────────────────────────────
    is_active   = models.BooleanField(default=True, db_index=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    cancelled_by = models.UUIDField(null=True, blank=True)

    # ── Timestamps ────────────────────────────────────────────────────
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    # ── Managers ──────────────────────────────────────────────────────
    objects     = RendezVousManager()
    all_objects = AllRDVManager()

    class Meta:
        verbose_name        = "Rendez-vous"
        verbose_name_plural = "Rendez-vous"
        ordering            = ["-date_heure"]
        indexes = [
            models.Index(fields=["dentiste_id", "statut", "is_active"]),
            models.Index(fields=["dentiste_id", "date_heure"]),
            models.Index(fields=["patient",     "is_active"]),
            models.Index(fields=["statut",      "is_active"]),
            models.Index(fields=["date_heure",  "statut"]),
        ]
        constraints = [
            # Un dentiste ne peut pas avoir deux RDV acceptés qui se chevauchent
            # (vérification métier dans le serializer — contrainte DB informative)
        ]

    def __str__(self) -> str:
        return (
            f"RDV {self.patient} — "
            f"{self.date_heure.strftime('%d/%m/%Y %H:%M')} "
            f"[{self.get_statut_display()}]"
        )

    # ── Propriétés calculées ──────────────────────────────────────────

    @property
    def date_fin(self):
        """Heure de fin calculée à partir de la durée."""
        return self.date_heure + timezone.timedelta(minutes=self.duree_minutes)

    @property
    def est_passe(self) -> bool:
        return self.date_heure < timezone.now()

    @property
    def est_aujourd_hui(self) -> bool:
        return self.date_heure.date() == timezone.now().date()

    @property
    def est_urgent(self) -> bool:
        return self.priorite == PrioriteRDV.URGENTE

    @property
    def est_en_attente(self) -> bool:
        return self.statut == StatutRDV.PENDING

    # ── Méthodes métier ───────────────────────────────────────────────

    def accepter(self) -> None:
        self.statut        = StatutRDV.ACCEPTE
        self.refuse_raison = ""
        self.save(update_fields=["statut", "refuse_raison", "updated_at"])

    def refuser(self, raison: str = "") -> None:
        self.statut        = StatutRDV.REFUSE
        self.refuse_raison = raison.strip()
        self.save(update_fields=["statut", "refuse_raison", "updated_at"])

    def annuler(self, annule_par_id, raison: str = "") -> None:
        self.statut        = StatutRDV.ANNULE
        self.refuse_raison = raison.strip()
        self.is_active     = False
        self.cancelled_at  = timezone.now()
        self.cancelled_by  = annule_par_id
        self.save(update_fields=[
            "statut", "refuse_raison", "is_active",
            "cancelled_at", "cancelled_by", "updated_at",
        ])

    def marquer_termine(self) -> None:
        self.statut = StatutRDV.TERMINE
        self.save(update_fields=["statut", "updated_at"])