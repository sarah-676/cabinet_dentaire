"""
notifications/tasks.py — api_service
=======================================
Tâches Celery asynchrones pour les notifications.

Tâches :
  envoyer_rappel_rdv(rdv_id)
    → Planifiée par Celery Beat ou create_rdv
    → Cherche le RDV, crée une notification de rappel

  planifier_rappel_rdv(rdv_id, date_heure_rdv)
    → Appelée depuis rendezvous/views.py après création d'un RDV accepté
    → Programme envoyer_rappel_rdv 24h avant le RDV

  nettoyer_anciennes_notifications()
    → Tâche périodique (Celery Beat) — supprime les notifs > 90 jours

Configuration requise dans settings.py :
  CELERY_BROKER_URL   = "amqp://guest:guest@localhost:5672/"
  CELERY_RESULT_BACKEND = REDIS_URL

Configuration Celery Beat (optionnel) dans settings.py :
  from celery.schedules import crontab
  CELERY_BEAT_SCHEDULE = {
      "nettoyer-notifications": {
          "task":     "notifications.tasks.nettoyer_anciennes_notifications",
          "schedule": crontab(hour=2, minute=0),  # chaque nuit à 2h
      },
  }
"""

import logging
import uuid as uuid_module

from celery import shared_task
from django.conf import settings
from django.utils import timezone

logger = logging.getLogger("notifications")


# ── Rappel RDV ────────────────────────────────────────────────────────────────

@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=300,   # retry après 5 min
    name="notifications.tasks.envoyer_rappel_rdv",
)
def envoyer_rappel_rdv(self, rdv_id: str) -> dict:
    """
    Envoie une notification de rappel pour un rendez-vous.

    Appelée par Celery 24h avant le RDV (planifiée via apply_async avec eta).

    Args:
        rdv_id : UUID str du rendez-vous

    Returns:
        dict avec le résultat de l'opération
    """
    try:
        from rendezvous.models import RendezVous, StatutRDV
        from notifications.services import create_notification
        from notifications.models import TypeNotification

        rdv = RendezVous.objects.select_related("patient").get(
            id=rdv_id,
            statut=StatutRDV.ACCEPTE,
            is_active=True,
        )

        # Ne pas envoyer si le RDV est passé
        if rdv.date_heure <= timezone.now():
            logger.info("Rappel RDV ignoré (passé) : %s", rdv_id)
            return {"status": "ignored", "reason": "rdv_passe"}

        # Notification pour le dentiste
        notif = create_notification(
            destinataire_id = str(rdv.dentiste_id),
            type_notif      = TypeNotification.RDV_RAPPEL,
            data            = {
                "rdv_id":      str(rdv.id),
                "patient_id":  str(rdv.patient.id),
                "patient_nom": rdv.patient.nom_complet,
                "date_heure":  rdv.date_heure.strftime("%d/%m/%Y à %H:%M"),
                "type_soin":   rdv.get_type_soin_display(),
            },
        )

        # Marquer le rappel comme envoyé
        rdv.rappel_envoye = True
        rdv.rappel_at     = timezone.now()
        rdv.save(update_fields=["rappel_envoye", "rappel_at", "updated_at"])

        logger.info("Rappel RDV envoyé [rdv=%s, dentiste=%s]", rdv_id, rdv.dentiste_id)
        return {
            "status":   "ok",
            "rdv_id":   rdv_id,
            "notif_id": str(notif.id) if notif else None,
        }

    except Exception as exc:
        logger.error("Erreur rappel RDV [rdv=%s] : %s", rdv_id, exc)
        # Retry automatique (max_retries=3)
        raise self.retry(exc=exc)


# ── Planification d'un rappel ─────────────────────────────────────────────────

def planifier_rappel_rdv(rdv_id: str, date_heure_rdv) -> None:
    """
    Planifie la tâche envoyer_rappel_rdv 24h avant le RDV.

    Appelé depuis rendezvous/views.py quand un RDV est accepté.

    Args:
        rdv_id          : UUID str du rendez-vous
        date_heure_rdv  : datetime du rendez-vous (avec timezone)
    """
    eta = date_heure_rdv - timezone.timedelta(hours=24)

    if eta <= timezone.now():
        # Moins de 24h → envoyer dans 5 min
        eta = timezone.now() + timezone.timedelta(minutes=5)
        logger.info(
            "Rappel RDV planifié dans 5 min (RDV < 24h) [rdv=%s]", rdv_id
        )
    else:
        logger.info(
            "Rappel RDV planifié à %s [rdv=%s]",
            eta.strftime("%d/%m/%Y %H:%M"), rdv_id,
        )

    envoyer_rappel_rdv.apply_async(
        args=[str(rdv_id)],
        eta=eta,
        task_id=f"rappel_rdv_{rdv_id}",
    )


# ── Nettoyage périodique ──────────────────────────────────────────────────────

@shared_task(name="notifications.tasks.nettoyer_anciennes_notifications")
def nettoyer_anciennes_notifications(jours: int = 90) -> dict:
    """
    Supprime les notifications lues de plus de `jours` jours.
    Tâche périodique — configurer dans CELERY_BEAT_SCHEDULE.

    Args:
        jours : âge minimum en jours pour suppression (défaut: 90)

    Returns:
        dict avec le nombre de notifications supprimées
    """
    try:
        from notifications.models import Notification

        limite = timezone.now() - timezone.timedelta(days=jours)
        count, _ = Notification.objects.filter(
            is_read=True,
            created_at__lt=limite,
        ).delete()

        logger.info(
            "Nettoyage notifications : %d supprimées (> %d jours)", count, jours
        )
        return {"status": "ok", "supprimees": count}

    except Exception as exc:
        logger.error("Erreur nettoyage notifications : %s", exc)
        return {"status": "error", "detail": str(exc)}