"""
notifications/handlers.py — api_service
=========================================
Consommateur RabbitMQ — traite les événements publiés par patients/views.py
et rendezvous/views.py et crée les notifications en base.

CORRECTION BUG 3 :
  ❌ Ancienne version : si RabbitMQ redémarre → thread crashe définitivement
  ✅ Nouvelle version : boucle de reconnexion avec backoff (1s, 2s, 4s... max 30s)
     Le thread daemon reste vivant et se reconnecte automatiquement.

Flux complet :
  patients/views.py  → publish_notification("PATIENT_EN_ATTENTE", {...})
  rendezvous/views.py → publish_notification("RDV_EN_ATTENTE", {...})
        ↓ RabbitMQ exchange "notifications" (fanout)
  handlers.py → traiter_evenement(event)
        ↓
  services.py → create_notification() → DB + WebSocket

Événements gérés :
  PATIENT_EN_ATTENTE  → dentiste_id est le destinataire
  PATIENT_VALIDE      → receptionniste_id est le destinataire
  PATIENT_REFUSE      → receptionniste_id est le destinataire
  RDV_EN_ATTENTE      → dentiste_id est le destinataire
  RDV_VALIDE          → receptionniste_id est le destinataire
  RDV_REFUSE          → receptionniste_id est le destinataire
  RDV_ANNULE          → dentiste_id est le destinataire
  RDV_RAPPEL          → dentiste_id est le destinataire
"""

import json
import logging
import threading
import time

import pika
from django.conf import settings

logger = logging.getLogger("notifications")

# ── Routing des événements ────────────────────────────────────────────────────

_DESTINATAIRE_PAR_TYPE = {
    "PATIENT_EN_ATTENTE": "dentiste_id",
    "PATIENT_VALIDE":     "receptionniste_id",
    "PATIENT_REFUSE":     "receptionniste_id",
    "RDV_EN_ATTENTE":     "dentiste_id",
    "RDV_VALIDE":         "receptionniste_id",
    "RDV_REFUSE":         "receptionniste_id",
    "RDV_ANNULE":         "dentiste_id",
    "RDV_RAPPEL":         "dentiste_id",
}

_ACTEUR_PAR_TYPE = {
    "PATIENT_EN_ATTENTE": ("receptionniste_id", "receptionniste_nom"),
    "PATIENT_VALIDE":     ("dentiste_id",        "dentiste_nom"),
    "PATIENT_REFUSE":     ("dentiste_id",        "dentiste_nom"),
    "RDV_EN_ATTENTE":     ("receptionniste_id",  "receptionniste_nom"),
    "RDV_VALIDE":         ("dentiste_id",        "dentiste_nom"),
    "RDV_REFUSE":         ("dentiste_id",        "dentiste_nom"),
    "RDV_ANNULE":         ("annule_par_id",      "annule_par_nom"),
    "RDV_RAPPEL":         (None,                  None),
}


# ── Traitement d'un message ───────────────────────────────────────────────────

def traiter_evenement(event: dict) -> None:
    """
    Traite un événement RabbitMQ et crée la notification appropriée.
    Appelé dans le thread consumer — Django ORM est disponible.
    """
    from notifications.services import create_notification

    type_notif = event.get("type", "")

    if type_notif not in _DESTINATAIRE_PAR_TYPE:
        logger.debug("Événement ignoré (type inconnu) : %s", type_notif)
        return

    cle_dest        = _DESTINATAIRE_PAR_TYPE[type_notif]
    destinataire_id = event.get(cle_dest)

    if not destinataire_id:
        logger.warning(
            "Événement [%s] sans destinataire (clé=%s) : %s",
            type_notif, cle_dest, event,
        )
        return

    acteur_id  = None
    acteur_nom = ""
    if type_notif in _ACTEUR_PAR_TYPE:
        cle_id, cle_nom = _ACTEUR_PAR_TYPE[type_notif]
        if cle_id:
            acteur_id  = event.get(cle_id)
            acteur_nom = event.get(cle_nom, "") if cle_nom else ""

    logger.info("Traitement [%s] → dest=%s", type_notif, destinataire_id)

    create_notification(
        destinataire_id = destinataire_id,
        type_notif      = type_notif,
        data            = event,
        acteur_id       = acteur_id,
        acteur_nom      = acteur_nom,
    )


# ── Callback RabbitMQ ─────────────────────────────────────────────────────────

def _callback(ch, method, properties, body):
    """Callback Pika — appelé à chaque message reçu."""
    try:
        event = json.loads(body.decode("utf-8"))
        logger.debug("RabbitMQ reçu : type=%s", event.get("type", "?"))
        traiter_evenement(event)
        ch.basic_ack(delivery_tag=method.delivery_tag)
    except json.JSONDecodeError as exc:
        logger.error("Message JSON invalide : %s", exc)
        ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)
    except Exception as exc:
        logger.error("Erreur traitement message : %s", exc)
        ch.basic_nack(delivery_tag=method.delivery_tag, requeue=True)


# ── Consumer avec reconnexion automatique ─────────────────────────────────────

def demarrer_consumer(exchange: str = "notifications") -> None:
    """
    Démarre le consumer RabbitMQ dans le thread courant.
    Bloque indéfiniment avec reconnexion automatique en cas de perte de connexion.

    ✅ BUG 3 CORRIGÉ : boucle de reconnexion avec backoff exponentiel.
    """
    rabbitmq_url = getattr(settings, "RABBITMQ_URL", "amqp://guest:guest@localhost:5672/")
    delai        = 1   # délai initial de reconnexion en secondes

    while True:
        connection = None
        try:
            params = pika.URLParameters(rabbitmq_url)
            params.socket_timeout             = 10
            params.heartbeat                  = 60
            params.blocked_connection_timeout = 300

            connection = pika.BlockingConnection(params)
            channel    = connection.channel()

            channel.exchange_declare(
                exchange      = exchange,
                exchange_type = "fanout",
                durable       = True,
            )

            result = channel.queue_declare(
                queue     = "api_service_notifications",
                durable   = True,
                exclusive = False,
            )
            queue_name = result.method.queue
            channel.queue_bind(exchange=exchange, queue=queue_name)
            channel.basic_qos(prefetch_count=1)
            channel.basic_consume(queue=queue_name, on_message_callback=_callback)

            logger.info(
                "RabbitMQ consumer démarré — exchange=%s, queue=%s",
                exchange, queue_name,
            )

            # ✅ Reset du délai si connexion réussie
            delai = 1
            channel.start_consuming()

        except pika.exceptions.AMQPConnectionError as exc:
            logger.warning(
                "RabbitMQ connexion perdue : %s — reconnexion dans %ds", exc, delai
            )
        except pika.exceptions.ChannelClosedByBroker as exc:
            logger.warning("RabbitMQ canal fermé : %s — reconnexion dans %ds", exc, delai)
        except Exception as exc:
            logger.error("RabbitMQ erreur inattendue : %s — reconnexion dans %ds", exc, delai)
        finally:
            if connection and not connection.is_closed:
                try:
                    connection.close()
                except Exception:
                    pass

        # ✅ Backoff exponentiel plafonné à 30 secondes
        time.sleep(delai)
        delai = min(delai * 2, 30)


def demarrer_consumer_en_thread() -> threading.Thread:
    """
    Démarre le consumer dans un daemon thread.
    Appelé depuis notifications/apps.py → AppConfig.ready().
    """
    t = threading.Thread(
        target=demarrer_consumer,
        name="rabbitmq-notif-consumer",
        daemon=True,
    )
    t.start()
    logger.info("Thread consumer RabbitMQ démarré : %s", t.name)
    return t