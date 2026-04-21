"""
notifications/services.py — api_service
=========================================
Logique métier des notifications.

Rôle de ce fichier :
  - Créer les notifications en base depuis les événements RabbitMQ
  - Envoyer via WebSocket (Django Channels) en temps réel
  - Construire les messages adaptés à chaque type d'événement

Flux complet :
  RabbitMQ → handlers.py → services.create_notification()
                         → channels WebSocket → frontend

Utilisé aussi directement par :
  - tasks.py (Celery) pour les rappels RDV
"""

import logging
import uuid as uuid_module

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

from .models import Notification, TypeNotification, NiveauNotification

logger = logging.getLogger("notifications")


# ── Mapping type → niveau ─────────────────────────────────────────────────────

_NIVEAU_PAR_TYPE = {
    TypeNotification.PATIENT_EN_ATTENTE: NiveauNotification.INFO,
    TypeNotification.PATIENT_VALIDE:     NiveauNotification.SUCCES,
    TypeNotification.PATIENT_REFUSE:     NiveauNotification.ALERTE,
    TypeNotification.RDV_EN_ATTENTE:     NiveauNotification.INFO,
    TypeNotification.RDV_VALIDE:         NiveauNotification.SUCCES,
    TypeNotification.RDV_REFUSE:         NiveauNotification.ALERTE,
    TypeNotification.RDV_ANNULE:         NiveauNotification.ALERTE,
    TypeNotification.RDV_RAPPEL:         NiveauNotification.INFO,
    TypeNotification.SYSTEME:            NiveauNotification.INFO,
}


# ── Builders de messages ──────────────────────────────────────────────────────

def _construire_message(type_notif: str, data: dict) -> tuple[str, str]:
    """
    Retourne (titre, message) selon le type d'événement et les données.
    """
    patient_nom = data.get("patient_nom", "un patient")
    acteur_nom  = data.get("receptionniste_nom") or data.get("acteur_nom", "")
    raison      = data.get("refuse_raison", "")
    date_rdv    = data.get("date_heure", "")

    messages = {
        TypeNotification.PATIENT_EN_ATTENTE: (
            "Nouveau patient en attente",
            f"{patient_nom} a été ajouté par {acteur_nom} et attend votre validation."
            if acteur_nom
            else f"{patient_nom} est en attente de validation.",
        ),
        TypeNotification.PATIENT_VALIDE: (
            "Patient accepté",
            f"Le patient {patient_nom} a été accepté par le dentiste.",
        ),
        TypeNotification.PATIENT_REFUSE: (
            "Patient refusé",
            f"Le patient {patient_nom} a été refusé."
            + (f" Raison : {raison}" if raison else ""),
        ),
        TypeNotification.RDV_EN_ATTENTE: (
            "Nouveau rendez-vous en attente",
            f"Un rendez-vous pour {patient_nom} le {date_rdv} attend votre validation."
            if date_rdv
            else f"Un rendez-vous pour {patient_nom} attend votre validation.",
        ),
        TypeNotification.RDV_VALIDE: (
            "Rendez-vous accepté",
            f"Le rendez-vous pour {patient_nom} a été accepté."
            + (f" Prévu le {date_rdv}." if date_rdv else ""),
        ),
        TypeNotification.RDV_REFUSE: (
            "Rendez-vous refusé",
            f"Le rendez-vous pour {patient_nom} a été refusé."
            + (f" Raison : {raison}" if raison else ""),
        ),
        TypeNotification.RDV_ANNULE: (
            "Rendez-vous annulé",
            f"Le rendez-vous pour {patient_nom} a été annulé."
            + (f" Raison : {raison}" if raison else ""),
        ),
        TypeNotification.RDV_RAPPEL: (
            "Rappel de rendez-vous",
            f"Rappel : vous avez un rendez-vous pour {patient_nom}"
            + (f" le {date_rdv}." if date_rdv else "."),
        ),
        TypeNotification.SYSTEME: (
            data.get("titre", "Notification système"),
            data.get("message", ""),
        ),
    }

    return messages.get(type_notif, ("Notification", str(data)))


# ── Création en base ──────────────────────────────────────────────────────────

def create_notification(
    destinataire_id: str,
    type_notif: str,
    data: dict,
    acteur_id: str = None,
    acteur_nom: str = "",
) -> Notification | None:
    """
    Crée une notification en base et l'envoie via WebSocket.

    Args:
        destinataire_id : UUID str de l'utilisateur cible
        type_notif      : valeur de TypeNotification
        data            : payload de l'événement RabbitMQ
        acteur_id       : UUID str de l'acteur (optionnel)
        acteur_nom      : nom lisible de l'acteur (optionnel)

    Returns:
        L'instance Notification créée, ou None en cas d'erreur
    """
    try:
        titre, message = _construire_message(type_notif, data)
        niveau = _NIVEAU_PAR_TYPE.get(type_notif, NiveauNotification.INFO)

        # Convertir les IDs en UUID proprement
        dest_uuid   = _to_uuid(destinataire_id)
        acteur_uuid = _to_uuid(acteur_id) if acteur_id else None
        patient_uuid = _to_uuid(data.get("patient_id"))
        rdv_uuid     = _to_uuid(data.get("rdv_id"))

        if not dest_uuid:
            logger.error(
                "create_notification: destinataire_id invalide : %s", destinataire_id
            )
            return None

        notif = Notification.objects.create(
            destinataire_id = dest_uuid,
            acteur_id       = acteur_uuid,
            acteur_nom      = acteur_nom or data.get("receptionniste_nom", ""),
            type            = type_notif,
            niveau          = niveau,
            titre           = titre,
            message         = message,
            patient_id      = patient_uuid,
            patient_nom     = data.get("patient_nom", ""),
            rdv_id          = rdv_uuid,
            metadata        = data,
        )

        logger.info(
            "Notification créée [type=%s, dest=%s] : %s",
            type_notif, destinataire_id, titre,
        )

        # Envoi WebSocket temps réel
        _envoyer_websocket(notif)

        return notif

    except Exception as exc:
        logger.error("Erreur création notification [%s] : %s", type_notif, exc)
        return None


# ── Envoi WebSocket ───────────────────────────────────────────────────────────

def _envoyer_websocket(notif: Notification) -> None:
    """
    Envoie la notification via Django Channels au groupe de l'utilisateur.

    Le groupe est nommé : notifications_<destinataire_id>
    Le consumer NotificationConsumer écoute ce groupe.
    """
    try:
        channel_layer = get_channel_layer()
        if channel_layer is None:
            logger.warning("Channel layer non configuré — WebSocket désactivé.")
            return

        group_name = f"notifications_{notif.destinataire_id}"

        payload = {
            "type":    "notification.message",   # méthode appelée dans le consumer
            "data": {
                "id":               str(notif.id),
                "type":             notif.type,
                "niveau":           notif.niveau,
                "titre":            notif.titre,
                "message":          notif.message,
                "patient_id":       str(notif.patient_id) if notif.patient_id else None,
                "patient_nom":      notif.patient_nom,
                "rdv_id":           str(notif.rdv_id) if notif.rdv_id else None,
                "acteur_nom":       notif.acteur_nom,
                "is_read":          notif.is_read,
                "created_at":       notif.created_at.isoformat(),
            },
        }

        async_to_sync(channel_layer.group_send)(group_name, payload)

        logger.debug(
            "WebSocket envoyé → groupe=%s, type=%s", group_name, notif.type
        )

    except Exception as exc:
        logger.error("Erreur envoi WebSocket [notif=%s] : %s", notif.id, exc)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _to_uuid(value) -> uuid_module.UUID | None:
    if value is None:
        return None
    if isinstance(value, uuid_module.UUID):
        return value
    try:
        return uuid_module.UUID(str(value))
    except (ValueError, AttributeError):
        return None


def marquer_toutes_lues(destinataire_id: str) -> int:
    """
    Marque toutes les notifications non lues d'un utilisateur comme lues.
    Retourne le nombre de notifications mises à jour.
    """
    from django.utils import timezone as tz
    count = Notification.objects.non_lues_pour(destinataire_id).update(
        is_read=True,
        read_at=tz.now(),
    )
    logger.info(
        "Toutes les notifications marquées lues [user=%s] : %d",
        destinataire_id, count,
    )
    return count