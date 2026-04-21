"""
common/rabbitmq.py — api_service
==================================
Communication asynchrone via RabbitMQ.

publish_event() — utilisé dans patients/views.py pour :
  - Notifier le dentiste qu'un patient est en attente (PATIENT_EN_ATTENTE)
  - Notifier après validation/refus d'un patient (PATIENT_VALIDE / PATIENT_REFUSE)

Les événements sont publiés dans un exchange "notifications".
Le notification_service (ou auth_service) consomme ces messages.

Format d'un événement :
  {
    "type":        "PATIENT_EN_ATTENTE",
    "dentiste_id": "uuid",
    "patient_id":  "uuid",
    "patient_nom": "Prénom Nom",
    ...
  }
"""

import json
import logging

import pika
from django.conf import settings

logger = logging.getLogger(__name__)


def publish_event(exchange: str, event: dict, routing_key: str = "") -> bool:
    """
    Publie un événement dans RabbitMQ.

    Args:
        exchange:    Nom de l'exchange RabbitMQ (ex: "notifications")
        event:       Dictionnaire de l'événement à publier
        routing_key: Clé de routage (optionnelle, "" pour fanout)

    Returns:
        True si publié avec succès, False en cas d'erreur

    Exemple :
        publish_event("notifications", {
            "type":        "PATIENT_EN_ATTENTE",
            "dentiste_id": str(patient.dentiste_id),
            "patient_id":  str(patient.id),
            "patient_nom": patient.nom_complet,
        })
    """
    connection = None
    try:
        rabbitmq_url = getattr(settings, "RABBITMQ_URL", "amqp://guest:guest@localhost:5672/")
        params = pika.URLParameters(rabbitmq_url)
        params.socket_timeout = 5

        connection = pika.BlockingConnection(params)
        channel    = connection.channel()

        # Déclarer l'exchange (idempotent — ok si déjà existant)
        channel.exchange_declare(
            exchange      = exchange,
            exchange_type = "fanout",
            durable       = True,
        )

        # Publier le message
        channel.basic_publish(
            exchange    = exchange,
            routing_key = routing_key,
            body        = json.dumps(event, ensure_ascii=False, default=str),
            properties  = pika.BasicProperties(
                delivery_mode = pika.DeliveryMode.Persistent,  # message durable
                content_type  = "application/json",
            ),
        )

        logger.info(
            "RabbitMQ [%s] → event publié : type=%s",
            exchange,
            event.get("type", "?"),
        )
        return True

    except pika.exceptions.AMQPConnectionError as exc:
        logger.error("RabbitMQ connexion impossible [%s] : %s", exchange, exc)
        return False
    except pika.exceptions.AMQPError as exc:
        logger.error("RabbitMQ erreur AMQP [%s] : %s", exchange, exc)
        return False
    except Exception as exc:
        logger.error("RabbitMQ erreur inattendue [%s] : %s", exchange, exc)
        return False
    finally:
        if connection and not connection.is_closed:
            try:
                connection.close()
            except Exception:
                pass


def publish_notification(event_type: str, data: dict) -> bool:
    """
    Raccourci pour publier dans l'exchange "notifications".

    Args:
        event_type: Type d'événement (ex: "PATIENT_EN_ATTENTE")
        data:       Données supplémentaires

    Exemple :
        publish_notification("PATIENT_EN_ATTENTE", {
            "dentiste_id": str(patient.dentiste_id),
            "patient_id":  str(patient.id),
            "patient_nom": patient.nom_complet,
        })
    """
    event = {"type": event_type, **data}
    return publish_event("notifications", event)