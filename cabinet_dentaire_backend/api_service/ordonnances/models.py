"""
ordonnances/models.py — api_service
=====================================
Modèle Ordonnance + LigneOrdonnance pour le cabinet dentaire.

Checklist couverte :
  T-02 — Création et gestion des ordonnances / prescriptions
  D-08 — Visible dans le dossier patient (agrégation)

Cohérence avec patients/models.py et rendezvous/models.py :
  - PK UUID sur tous les modèles
  - dentiste_id = UUIDField (auth_service utilise UUID)
  - Même pattern soft-delete via is_active
  - Même pattern QuerySet / Manager custom
  - Même pattern méthodes métier (archiver, restaurer)

Pas de notifications — checklist T-02 ne mentionne aucun workflow
de validation ni de notification pour les ordonnances.
"""

import uuid

from django.db import models
from django.utils import timezone

from patients.models import Patient


# ── Choix ─────────────────────────────────────────────────────────────────────

class StatutOrdonnance(models.TextChoices):
    ACTIVE   = "ACTIVE",   "Active"
    EXPIREE  = "EXPIREE",  "Expirée"
    ANNULEE  = "ANNULEE",  "Annulée"


class FormeGalenique(models.TextChoices):
    COMPRIMES  = "COMPRIMES",  "Comprimés"
    GELULES    = "GELULES",    "Gélules"
    SIROP      = "SIROP",      "Sirop"
    INJECTABLE = "INJECTABLE", "Injectable"
    CREME      = "CREME",      "Crème / Pommade"
    COLLYRE    = "COLLYRE",    "Collyre"
    SPRAY      = "SPRAY",      "Spray"
    SACHET     = "SACHET",     "Sachet"
    PATCH      = "PATCH",      "Patch"
    AUTRE      = "AUTRE",      "Autre"


class VoieAdministration(models.TextChoices):
    ORALE       = "ORALE",       "Orale"
    SUBLINGUALE = "SUBLINGUALE", "Sublinguale"
    INJECTABLE  = "INJECTABLE",  "Injectable"
    TOPIQUE     = "TOPIQUE",     "Topique"
    NASALE      = "NASALE",      "Nasale"
    OCULAIRE    = "OCULAIRE",    "Oculaire"
    AUTRE       = "AUTRE",       "Autre"


# ── QuerySet / Managers ───────────────────────────────────────────────────────

class OrdonnanceQuerySet(models.QuerySet):

    def actives(self):
        return self.filter(is_active=True)

    def archivees(self):
        return self.filter(is_active=False)

    def du_dentiste(self, dentiste_id):
        """Ordonnances actives d'un dentiste (dentiste_id = UUID str ou UUID)."""
        return self.filter(dentiste_id=dentiste_id, is_active=True)

    def du_patient(self, patient_id):
        return self.filter(patient_id=patient_id, is_active=True)

    def par_statut(self, statut: str):
        return self.filter(statut=statut, is_active=True)

    def expirees(self):
        """Ordonnances dont la date d'expiration est dépassée."""
        return self.filter(
            date_expiration__lt=timezone.now().date(),
            statut=StatutOrdonnance.ACTIVE,
            is_active=True,
        )

    def valides(self):
        """Ordonnances actives non expirées."""
        return self.filter(
            models.Q(date_expiration__gte=timezone.now().date())
            | models.Q(date_expiration__isnull=True),
            statut=StatutOrdonnance.ACTIVE,
            is_active=True,
        )

    def ce_mois(self):
        now = timezone.now()
        return self.filter(
            created_at__year=now.year,
            created_at__month=now.month,
            is_active=True,
        )

    def avec_rendezvous(self):
        return self.filter(rendezvous__isnull=False, is_active=True)


class OrdonnanceManager(models.Manager):
    def get_queryset(self):
        return OrdonnanceQuerySet(self.model, using=self._db)

    def actives(self):
        return self.get_queryset().actives()

    def du_dentiste(self, dentiste_id):
        return self.get_queryset().du_dentiste(dentiste_id)

    def du_patient(self, patient_id):
        return self.get_queryset().du_patient(patient_id)

    def valides(self):
        return self.get_queryset().valides()

    def expirees(self):
        return self.get_queryset().expirees()

    def ce_mois(self):
        return self.get_queryset().ce_mois()


class AllOrdonnancesManager(models.Manager):
    """Manager sans filtre — accès à toutes les ordonnances (actives + archivées)."""
    def get_queryset(self):
        return OrdonnanceQuerySet(self.model, using=self._db)


# ── Modèle Ordonnance ─────────────────────────────────────────────────────────

class Ordonnance(models.Model):
    """
    Représente une ordonnance / prescription médicale du cabinet dentaire.

    Checklist T-02 :
      - Création d'ordonnances
      - Gestion des prescriptions médicales
      - Visible dans le dossier patient (D-08)

    Structure :
      Ordonnance (en-tête)  ──< LigneOrdonnance (médicaments)
      Ordonnance ──> Patient  (obligatoire)
      Ordonnance ──> RendezVous (optionnel — lié à une consultation)
    """

    # ── PK UUID ───────────────────────────────────────────────────────
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
        verbose_name="Identifiant unique",
    )

    # ── Liaisons ──────────────────────────────────────────────────────
    patient = models.ForeignKey(
        Patient,
        on_delete=models.CASCADE,
        related_name="ordonnances",
        verbose_name="Patient",
    )

    # Lien optionnel à un rendez-vous (la consultation à l'origine de l'ordonnance)
    rendezvous = models.ForeignKey(
        "rendezvous.RendezVous",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ordonnances",
        verbose_name="Rendez-vous associé",
    )

    # ── Lien dentiste (UUID depuis auth_service) ──────────────────────
    dentiste_id = models.UUIDField(
        verbose_name="UUID du dentiste prescripteur",
        db_index=True,
    )

    # ── En-tête de l'ordonnance ───────────────────────────────────────
    numero = models.CharField(
        max_length=50,
        unique=True,
        verbose_name="Numéro d'ordonnance",
        help_text="Généré automatiquement à la création.",
    )

    date_prescription = models.DateField(
        default=timezone.now,
        verbose_name="Date de prescription",
        db_index=True,
    )

    date_expiration = models.DateField(
        null=True,
        blank=True,
        verbose_name="Date d'expiration",
        help_text="Laisser vide si pas de date limite.",
    )

    statut = models.CharField(
        max_length=10,
        choices=StatutOrdonnance.choices,
        default=StatutOrdonnance.ACTIVE,
        verbose_name="Statut",
        db_index=True,
    )

    # ── Contenu ───────────────────────────────────────────────────────
    diagnostic = models.TextField(
        blank=True,
        verbose_name="Diagnostic / motif",
        help_text="Contexte clinique de la prescription.",
    )

    instructions_generales = models.TextField(
        blank=True,
        verbose_name="Instructions générales",
        help_text="Ex : À prendre avant les repas, éviter l'alcool…",
    )

    note_pharmacien = models.TextField(
        blank=True,
        verbose_name="Note pour le pharmacien",
    )

    # ── Soft delete ───────────────────────────────────────────────────
    is_active   = models.BooleanField(default=True, db_index=True)
    archived_at = models.DateTimeField(null=True, blank=True)
    archived_by = models.UUIDField(null=True, blank=True)

    # ── Timestamps ────────────────────────────────────────────────────
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    # ── Managers ──────────────────────────────────────────────────────
    objects     = OrdonnanceManager()
    all_objects = AllOrdonnancesManager()

    class Meta:
        verbose_name        = "Ordonnance"
        verbose_name_plural = "Ordonnances"
        ordering            = ["-date_prescription", "-created_at"]
        indexes = [
            models.Index(fields=["dentiste_id", "is_active"]),
            models.Index(fields=["patient",     "is_active"]),
            models.Index(fields=["statut",      "is_active"]),
            models.Index(fields=["date_prescription"]),
            models.Index(fields=["date_expiration"]),
        ]

    def __str__(self) -> str:
        return f"Ordonnance {self.numero} — {self.patient} [{self.get_statut_display()}]"

    # ── Propriétés calculées ──────────────────────────────────────────

    @property
    def est_expiree(self) -> bool:
        if not self.date_expiration:
            return False
        return self.date_expiration < timezone.now().date()

    @property
    def est_valide(self) -> bool:
        return self.statut == StatutOrdonnance.ACTIVE and not self.est_expiree

    @property
    def nb_medicaments(self) -> int:
        """Nombre de lignes de médicaments — utilise le prefetch si dispo."""
        if hasattr(self, "_prefetched_objects_cache") and "lignes" in self._prefetched_objects_cache:
            return len(self._prefetched_objects_cache["lignes"])
        return self.lignes.count()

    # ── Méthodes métier ───────────────────────────────────────────────

    def archiver(self, archived_by_id) -> None:
        if not self.is_active:
            return
        self.is_active   = False
        self.archived_at = timezone.now()
        self.archived_by = archived_by_id
        self.save(update_fields=["is_active", "archived_at", "archived_by", "updated_at"])

    def restaurer(self) -> None:
        if self.is_active:
            return
        self.is_active   = True
        self.archived_at = None
        self.archived_by = None
        self.save(update_fields=["is_active", "archived_at", "archived_by", "updated_at"])

    def annuler(self) -> None:
        self.statut = StatutOrdonnance.ANNULEE
        self.save(update_fields=["statut", "updated_at"])

    def marquer_expiree(self) -> None:
        self.statut = StatutOrdonnance.EXPIREE
        self.save(update_fields=["statut", "updated_at"])

    # ── Génération du numéro ──────────────────────────────────────────

    @classmethod
    def generer_numero(cls) -> str:
        """
        Génère un numéro d'ordonnance unique :
        ORD-YYYYMMDD-XXXX  (ex: ORD-20250415-0042)
        """
        today  = timezone.now().strftime("%Y%m%d")
        prefix = f"ORD-{today}-"
        count  = cls.all_objects.filter(numero__startswith=prefix).count()
        return f"{prefix}{str(count + 1).zfill(4)}"


# ── Modèle LigneOrdonnance ────────────────────────────────────────────────────

class LigneOrdonnance(models.Model):
    """
    Représente un médicament dans une ordonnance.

    Une ordonnance peut contenir plusieurs lignes (1 ligne = 1 médicament).
    Ordre d'affichage contrôlé par `ordre`.
    """

    # ── PK UUID ───────────────────────────────────────────────────────
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    # ── Lien ordonnance ───────────────────────────────────────────────
    ordonnance = models.ForeignKey(
        Ordonnance,
        on_delete=models.CASCADE,
        related_name="lignes",
        verbose_name="Ordonnance",
    )

    # ── Médicament ────────────────────────────────────────────────────
    medicament     = models.CharField(max_length=200, verbose_name="Médicament (DCI ou nom commercial)")
    dosage         = models.CharField(max_length=100, blank=True, verbose_name="Dosage", help_text="Ex : 500mg, 1g")
    forme          = models.CharField(
        max_length=20,
        choices=FormeGalenique.choices,
        default=FormeGalenique.COMPRIMES,
        verbose_name="Forme galénique",
    )
    voie           = models.CharField(
        max_length=20,
        choices=VoieAdministration.choices,
        default=VoieAdministration.ORALE,
        verbose_name="Voie d'administration",
    )

    # ── Posologie ─────────────────────────────────────────────────────
    posologie      = models.CharField(
        max_length=200,
        verbose_name="Posologie",
        help_text="Ex : 1 comprimé matin et soir",
    )
    duree_traitement = models.CharField(
        max_length=100,
        blank=True,
        verbose_name="Durée du traitement",
        help_text="Ex : 7 jours, 1 mois",
    )
    quantite       = models.PositiveSmallIntegerField(
        default=1,
        verbose_name="Quantité à délivrer",
    )

    # ── Instructions spécifiques ──────────────────────────────────────
    instructions   = models.TextField(
        blank=True,
        verbose_name="Instructions spécifiques",
        help_text="Ex : À prendre après le repas, ne pas écraser.",
    )

    # ── Ordre d'affichage ─────────────────────────────────────────────
    ordre = models.PositiveSmallIntegerField(
        default=1,
        verbose_name="Ordre d'affichage",
    )

    class Meta:
        verbose_name        = "Ligne d'ordonnance"
        verbose_name_plural = "Lignes d'ordonnance"
        ordering            = ["ordonnance", "ordre"]
        indexes = [
            models.Index(fields=["ordonnance", "ordre"]),
        ]

    def __str__(self) -> str:
        return f"{self.medicament} {self.dosage} — {self.posologie}"
