"""
notifications/models.py — api_service
=======================================
Modèle Notification persisté en base.

Chaque notification est liée à un destinataire (UUID depuis auth_service)
et à un événement métier (patient en attente, RDV validé, etc.).

Cycle de vie :
  RabbitMQ handler crée → is_read=False
  Frontend WebSocket reçoit en temps réel
  Utilisateur lit → PATCH /notifications/{id}/lire/  → is_read=True
  Utilisateur supprime → DELETE /notifications/{id}/

Types d'événements couverts (depuis patients/views.py et rendezvous) :
  PATIENT_EN_ATTENTE  → dentiste reçoit notif quand réceptionniste crée un patient
  PATIENT_VALIDE      → réceptionniste reçoit notif quand dentiste accepte
  PATIENT_REFUSE      → réceptionniste reçoit notif quand dentiste refuse
  RDV_EN_ATTENTE      → dentiste reçoit notif quand réceptionniste crée un RDV
  RDV_VALIDE          → réceptionniste reçoit notif quand dentiste accepte RDV
  RDV_REFUSE          → réceptionniste reçoit notif quand dentiste refuse RDV
  RDV_ANNULE          → dentiste reçoit notif quand RDV est annulé
  RDV_RAPPEL          → patient/dentiste reçoit rappel avant RDV (Celery)
  SYSTEME             → notifications génériques admin
"""

import uuid

from django.db import models
from django.utils import timezone


class TypeNotification(models.TextChoices):
    PATIENT_EN_ATTENTE = "PATIENT_EN_ATTENTE", "Nouveau patient en attente"
    PATIENT_VALIDE     = "PATIENT_VALIDE",     "Patient accepté"
    PATIENT_REFUSE     = "PATIENT_REFUSE",     "Patient refusé"
    RDV_EN_ATTENTE     = "RDV_EN_ATTENTE",     "Nouveau rendez-vous en attente"
    RDV_VALIDE         = "RDV_VALIDE",         "Rendez-vous accepté"
    RDV_REFUSE         = "RDV_REFUSE",         "Rendez-vous refusé"
    RDV_ANNULE         = "RDV_ANNULE",         "Rendez-vous annulé"
    RDV_RAPPEL         = "RDV_RAPPEL",         "Rappel de rendez-vous"
    SYSTEME            = "SYSTEME",            "Notification système"


class NiveauNotification(models.TextChoices):
    INFO     = "INFO",     "Information"
    SUCCES   = "SUCCES",   "Succès"
    ALERTE   = "ALERTE",   "Alerte"
    CRITIQUE = "CRITIQUE", "Critique"


# ── QuerySet ──────────────────────────────────────────────────────────────────

class NotificationQuerySet(models.QuerySet):

    def pour_utilisateur(self, user_id):
        return self.filter(destinataire_id=user_id)

    def non_lues(self):
        return self.filter(is_read=False)

    def lues(self):
        return self.filter(is_read=True)

    def recentes(self, jours: int = 30):
        depuis = timezone.now() - timezone.timedelta(days=jours)
        return self.filter(created_at__gte=depuis)

    def par_type(self, type_notif: str):
        return self.filter(type=type_notif)


class NotificationManager(models.Manager):

    def get_queryset(self):
        return NotificationQuerySet(self.model, using=self._db)

    def pour_utilisateur(self, user_id):
        return self.get_queryset().pour_utilisateur(user_id)

    def non_lues_pour(self, user_id):
        return self.get_queryset().pour_utilisateur(user_id).non_lues()

    def compter_non_lues(self, user_id) -> int:
        return self.non_lues_pour(user_id).count()


# ── Modèle ────────────────────────────────────────────────────────────────────

class Notification(models.Model):
    """
    Notification persistée en base de données.

    destinataire_id : UUID de l'utilisateur cible (depuis auth_service)
    acteur_id       : UUID de l'utilisateur qui a déclenché l'action (optionnel)
    patient_id      : UUID du patient concerné (optionnel)
    rdv_id          : UUID du rendez-vous concerné (optionnel)
    """

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    # ── Destinataire ──────────────────────────────────────────────────
    destinataire_id = models.UUIDField(
        verbose_name="UUID du destinataire",
        db_index=True,
    )

    # ── Acteur (qui a déclenché) ──────────────────────────────────────
    acteur_id = models.UUIDField(
        null=True,
        blank=True,
        verbose_name="UUID de l'acteur",
    )
    acteur_nom = models.CharField(
        max_length=200,
        blank=True,
        verbose_name="Nom de l'acteur",
    )

    # ── Type et niveau ────────────────────────────────────────────────
    type = models.CharField(
        max_length=30,
        choices=TypeNotification.choices,
        verbose_name="Type de notification",
        db_index=True,
    )
    niveau = models.CharField(
        max_length=10,
        choices=NiveauNotification.choices,
        default=NiveauNotification.INFO,
        verbose_name="Niveau",
    )

    # ── Contenu ───────────────────────────────────────────────────────
    titre   = models.CharField(max_length=200, verbose_name="Titre")
    message = models.TextField(verbose_name="Message")

    # ── Références métier ─────────────────────────────────────────────
    patient_id = models.UUIDField(
        null=True,
        blank=True,
        verbose_name="UUID du patient concerné",
        db_index=True,
    )
    patient_nom = models.CharField(
        max_length=200,
        blank=True,
        verbose_name="Nom du patient (dénormalisé)",
    )
    rdv_id = models.UUIDField(
        null=True,
        blank=True,
        verbose_name="UUID du rendez-vous concerné",
        db_index=True,
    )

    # ── Données brutes de l'événement ─────────────────────────────────
    # Stocke le payload RabbitMQ original pour audit / débogage
    metadata = models.JSONField(
        default=dict,
        blank=True,
        verbose_name="Métadonnées (payload événement)",
    )

    # ── Statut ────────────────────────────────────────────────────────
    is_read  = models.BooleanField(default=False, db_index=True)
    read_at  = models.DateTimeField(null=True, blank=True)

    # ── Timestamps ────────────────────────────────────────────────────
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    objects = NotificationManager()

    class Meta:
        verbose_name        = "Notification"
        verbose_name_plural = "Notifications"
        ordering            = ["-created_at"]
        indexes = [
            models.Index(fields=["destinataire_id", "is_read"]),
            models.Index(fields=["destinataire_id", "created_at"]),
            models.Index(fields=["type", "created_at"]),
        ]

    def __str__(self) -> str:
        lu = "✓" if self.is_read else "●"
        return f"[{lu}] {self.get_type_display()} → {self.titre}"

    # ── Méthodes métier ───────────────────────────────────────────────

    def marquer_lue(self) -> None:
        if not self.is_read:
            self.is_read = True
            self.read_at = timezone.now()
            self.save(update_fields=["is_read", "read_at"])