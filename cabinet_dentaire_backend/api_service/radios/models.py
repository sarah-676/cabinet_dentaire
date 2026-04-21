"""
radios/models.py — api_service
================================
Modèle Radio pour les images radiographiques des patients.

Cycle de vie :
  Dentiste uploade image  → statut EN_ATTENTE
  Dentiste clique "Analyser" → statut EN_COURS (envoi vers ia_service)
  ia_service répond       → statut ANALYSE (résultat sauvegardé)
  En cas d'erreur         → statut ERREUR

Cohérence avec patients/models.py et rendezvous/models.py :
  - UUID primary key
  - patient → ForeignKey vers Patient
  - dentiste_id → UUIDField (auth_service utilise UUID)
  - Même pattern soft-delete via is_active
  - Même pattern QuerySet / Manager
"""

import uuid

from django.db import models
from django.utils import timezone

from patients.models import Patient


# ── Choix ─────────────────────────────────────────────────────────────────────

class TypeRadio(models.TextChoices):
    PANORAMIQUE      = "PANORAMIQUE",      "Panoramique"
    PERIAPICALE      = "PERIAPICALE",      "Périapicale"
    BITEWING         = "BITEWING",         "Bitewing (interproximale)"
    OCCLUSAL         = "OCCLUSAL",         "Occlusal"
    CEPHALOMETRIQUE  = "CEPHALOMETRIQUE",  "Céphalométrique"
    CONE_BEAM        = "CONE_BEAM",        "Cone Beam (3D)"
    AUTRE            = "AUTRE",            "Autre"


class StatutAnalyse(models.TextChoices):
    EN_ATTENTE = "EN_ATTENTE", "En attente d'analyse"
    EN_COURS   = "EN_COURS",   "Analyse en cours"
    ANALYSE    = "ANALYSE",    "Analysée"
    ERREUR     = "ERREUR",     "Erreur d'analyse"


# ── QuerySet / Manager ────────────────────────────────────────────────────────

class RadioQuerySet(models.QuerySet):

    def actives(self):
        return self.filter(is_active=True)

    def du_patient(self, patient_id):
        return self.filter(patient_id=patient_id, is_active=True)

    def du_dentiste(self, dentiste_id):
        return self.filter(dentiste_id=dentiste_id, is_active=True)

    def analysees(self):
        return self.filter(statut_analyse=StatutAnalyse.ANALYSE, is_active=True)

    def en_attente_analyse(self):
        return self.filter(statut_analyse=StatutAnalyse.EN_ATTENTE, is_active=True)

    def avec_anomalies(self):
        """Radios analysées ayant des anomalies détectées par l'IA."""
        return self.filter(
            statut_analyse=StatutAnalyse.ANALYSE,
            ia_anomalies_detectees=True,
            is_active=True,
        )

    def recentes(self, jours: int = 30):
        depuis = timezone.now() - timezone.timedelta(days=jours)
        return self.filter(created_at__gte=depuis, is_active=True)


class RadioManager(models.Manager):

    def get_queryset(self):
        return RadioQuerySet(self.model, using=self._db)

    def actives(self):
        return self.get_queryset().actives()

    def du_patient(self, patient_id):
        return self.get_queryset().du_patient(patient_id)

    def du_dentiste(self, dentiste_id):
        return self.get_queryset().du_dentiste(dentiste_id)

    def analysees(self):
        return self.get_queryset().analysees()


class AllRadiosManager(models.Manager):
    """Manager sans filtre — accès à toutes les radios (actives + supprimées)."""
    def get_queryset(self):
        return RadioQuerySet(self.model, using=self._db)


# ── Modèle Radio ──────────────────────────────────────────────────────────────

def radio_upload_path(instance, filename):
    """
    Chemin de stockage : radios/<patient_id>/<year>/<month>/<filename>
    Chaque patient a son propre dossier.
    """
    return (
        f"radios/{instance.patient_id}/"
        f"{timezone.now().strftime('%Y/%m')}/"
        f"{filename}"
    )


class Radio(models.Model):
    """
    Image radiographique d'un patient.

    Workflow IA :
      1. Dentiste uploade l'image → statut EN_ATTENTE
      2. Dentiste clique "Analyser" → PATCH /radios/{id}/analyser/
      3. api_service envoie l'image à ia_service via HTTP
      4. ia_service retourne le résultat → statut ANALYSE
      5. Dentiste voit le résultat dans la fiche patient

    L'analyse IA retourne :
      - ia_resultat       : résumé textuel ("Carie détectée en ...")
      - ia_anomalies      : liste des anomalies détectées (JSON)
      - ia_confidence     : score de confiance (0.0 → 1.0)
      - ia_anomalies_detectees : booléen rapide pour filtrage
    """

    # ── PK UUID ───────────────────────────────────────────────────────
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
        verbose_name="Identifiant unique",
    )

    # ── Liens ─────────────────────────────────────────────────────────
    patient = models.ForeignKey(
        Patient,
        on_delete=models.CASCADE,
        related_name="radios",
        verbose_name="Patient",
    )

    # UUID du dentiste (depuis auth_service — pas de ForeignKey inter-services)
    dentiste_id = models.UUIDField(
        verbose_name="UUID du dentiste",
        db_index=True,
    )

    # ── Image ─────────────────────────────────────────────────────────
    image = models.ImageField(
        upload_to=radio_upload_path,
        verbose_name="Image radiographique",
    )

    # ── Métadonnées ───────────────────────────────────────────────────
    type_radio = models.CharField(
        max_length=20,
        choices=TypeRadio.choices,
        default=TypeRadio.PANORAMIQUE,
        verbose_name="Type de radiographie",
        db_index=True,
    )
    description = models.TextField(
        blank=True,
        verbose_name="Description / observations du dentiste",
    )
    date_prise = models.DateField(
        default=timezone.now,
        verbose_name="Date de prise de la radio",
        db_index=True,
    )

    # ── Statut analyse IA ─────────────────────────────────────────────
    statut_analyse = models.CharField(
        max_length=15,
        choices=StatutAnalyse.choices,
        default=StatutAnalyse.EN_ATTENTE,
        verbose_name="Statut de l'analyse IA",
        db_index=True,
    )

    # ── Résultat IA ───────────────────────────────────────────────────
    # Stocke le résumé textuel retourné par ia_service
    ia_resultat = models.TextField(
        blank=True,
        verbose_name="Résultat de l'analyse IA",
        help_text="Résumé textuel retourné par le modèle IA.",
    )
    # Stocke la liste complète des anomalies (JSON)
    # Ex: [{"type": "carie", "dent": "16", "confidence": 0.92}, ...]
    ia_anomalies = models.JSONField(
        null=True,
        blank=True,
        verbose_name="Anomalies détectées (JSON)",
        help_text="Liste structurée des anomalies retournée par ia_service.",
    )
    # Score de confiance global (0.0 → 1.0)
    ia_confidence = models.FloatField(
        null=True,
        blank=True,
        verbose_name="Score de confiance global",
        help_text="Score de confiance global du modèle IA (0.0 → 1.0).",
    )
    # Booléen rapide pour filtrage (évite de parser ia_anomalies)
    ia_anomalies_detectees = models.BooleanField(
        default=False,
        verbose_name="Anomalies détectées",
        db_index=True,
        help_text="True si l'IA a détecté au moins une anomalie.",
    )
    # Date de l'analyse
    ia_analyse_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="Date de l'analyse IA",
    )
    # Message d'erreur si statut == ERREUR
    ia_erreur = models.TextField(
        blank=True,
        verbose_name="Message d'erreur IA",
    )

    # ── Soft delete ───────────────────────────────────────────────────
    is_active = models.BooleanField(default=True, db_index=True)

    # ── Timestamps ────────────────────────────────────────────────────
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    # ── Managers ──────────────────────────────────────────────────────
    objects     = RadioManager()
    all_objects = AllRadiosManager()

    class Meta:
        verbose_name        = "Radiographie"
        verbose_name_plural = "Radiographies"
        ordering            = ["-date_prise", "-created_at"]
        indexes = [
            models.Index(fields=["patient",     "is_active"]),
            models.Index(fields=["dentiste_id", "is_active"]),
            models.Index(fields=["statut_analyse", "is_active"]),
            models.Index(fields=["date_prise",  "is_active"]),
        ]

    def __str__(self) -> str:
        return (
            f"Radio {self.get_type_radio_display()} — "
            f"{self.patient} — "
            f"{self.date_prise.strftime('%d/%m/%Y')} "
            f"[{self.get_statut_analyse_display()}]"
        )

    # ── Propriétés ────────────────────────────────────────────────────

    @property
    def est_analysee(self) -> bool:
        return self.statut_analyse == StatutAnalyse.ANALYSE

    @property
    def nb_anomalies(self) -> int:
        """Nombre d'anomalies détectées."""
        if not self.ia_anomalies:
            return 0
        return len(self.ia_anomalies)

    # ── Méthodes métier ───────────────────────────────────────────────

    def marquer_en_cours(self) -> None:
        """Appelée quand l'envoi vers ia_service démarre."""
        self.statut_analyse = StatutAnalyse.EN_COURS
        self.ia_erreur      = ""
        self.save(update_fields=["statut_analyse", "ia_erreur", "updated_at"])

    def sauvegarder_resultat(
        self,
        resultat:    str,
        anomalies:   list,
        confidence:  float,
    ) -> None:
        """
        Appelée après réponse réussie de ia_service.

        Args:
            resultat   : résumé textuel de l'analyse
            anomalies  : liste des anomalies [{type, dent, confidence}, ...]
            confidence : score de confiance global (0.0 → 1.0)
        """
        self.statut_analyse          = StatutAnalyse.ANALYSE
        self.ia_resultat             = resultat
        self.ia_anomalies            = anomalies
        self.ia_confidence           = confidence
        self.ia_anomalies_detectees  = len(anomalies) > 0
        self.ia_analyse_at           = timezone.now()
        self.ia_erreur               = ""
        self.save(update_fields=[
            "statut_analyse", "ia_resultat", "ia_anomalies",
            "ia_confidence", "ia_anomalies_detectees",
            "ia_analyse_at", "ia_erreur", "updated_at",
        ])

    def marquer_erreur(self, message: str) -> None:
        """Appelée si ia_service retourne une erreur."""
        self.statut_analyse = StatutAnalyse.ERREUR
        self.ia_erreur      = message
        self.save(update_fields=["statut_analyse", "ia_erreur", "updated_at"])

    def supprimer(self) -> None:
        """Soft delete."""
        self.is_active = False
        self.save(update_fields=["is_active", "updated_at"])
