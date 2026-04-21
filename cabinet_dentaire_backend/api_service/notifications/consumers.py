"""
notifications/consumers.py — api_service
==========================================
WebSocket consumer Django Channels.

CORRECTION BUG 4 :
  ❌ Ancienne version : vérifie request.user.is_authenticated
     → RemoteUser (défini dans ws_middleware.py) n'hérite pas de AbstractBaseUser
     → is_authenticated pouvait être manquant ou lever AttributeError
  ✅ Nouvelle version : vérifie isinstance(user, AnonymousUser) et présence de user.id
     → Compatible avec RemoteUser défini dans ws_middleware.py

Connexion WebSocket :
  ws://api-service/ws/notifications/?token=<access_token>

Le frontend reçoit en JSON :
  {
    "id":          "uuid",
    "type":        "PATIENT_EN_ATTENTE",
    "niveau":      "INFO",
    "titre":       "Nouveau patient en attente",
    "message":     "...",
    "patient_id":  "uuid" | null,
    "patient_nom": "...",
    "rdv_id":      "uuid" | null,
    "acteur_nom":  "...",
    "is_read":     false,
    "created_at":  "2026-04-17T10:00:00Z"
  }

Actions depuis le frontend :
  {"action": "mark_read",     "id": "<uuid>"}  → marquer une notif lue
  {"action": "mark_all_read"}                   → tout marquer lu
  {"action": "ping"}                            → keep-alive → {"action": "pong"}
"""

import json
import logging

from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser

logger = logging.getLogger("notifications")


def _est_authentifie(user) -> bool:
    """
    ✅ BUG 4 CORRIGÉ : vérifie si l'user est authentifié de façon compatible
    avec RemoteUser (ws_middleware.py) qui a is_authenticated=True comme attribut de classe.
    """
    if user is None:
        return False
    if isinstance(user, AnonymousUser):
        return False
    # RemoteUser a is_authenticated = True (attribut de classe)
    return bool(getattr(user, "is_authenticated", False))


class NotificationConsumer(AsyncWebsocketConsumer):
    """
    Consumer WebSocket pour les notifications temps réel.
    Authentification via token JWT passé en query string (?token=...).
    """

    async def connect(self):
        user = self.scope.get("user")

        if not _est_authentifie(user):
            logger.warning("WebSocket refusé — non authentifié")
            await self.close(code=4001)
            return

        # ✅ user.id peut être un UUID ou str — on normalise en str
        self.user_id    = str(user.id)
        self.group_name = f"notifications_{self.user_id}"

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        logger.info("WebSocket connecté [user=%s]", self.user_id)

        # Envoyer immédiatement le compteur de non-lues
        await self._envoyer_compteur()

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)
            logger.info(
                "WebSocket déconnecté [user=%s, code=%s]",
                getattr(self, "user_id", "?"), close_code,
            )

    async def receive(self, text_data):
        """
        Messages reçus depuis le frontend.
        Actions : mark_read | mark_all_read | ping
        """
        try:
            data   = json.loads(text_data)
            action = data.get("action")

            if action == "mark_read":
                notif_id = data.get("id")
                if notif_id:
                    success = await self._marquer_lue(notif_id)
                    await self.send(json.dumps({
                        "action":  "mark_read",
                        "id":      notif_id,
                        "success": success,
                    }))
                    if success:
                        await self._envoyer_compteur()

            elif action == "mark_all_read":
                count = await self._marquer_toutes_lues()
                await self.send(json.dumps({
                    "action": "mark_all_read",
                    "count":  count,
                }))
                await self._envoyer_compteur()

            elif action == "ping":
                await self.send(json.dumps({"action": "pong"}))

            else:
                logger.debug("WebSocket action inconnue : %s", action)

        except json.JSONDecodeError:
            logger.warning("WebSocket message JSON invalide")
        except Exception as exc:
            logger.error("WebSocket erreur receive : %s", exc)

    # ── Handler appelé par group_send depuis services.py ─────────────

    async def notification_message(self, event):
        """
        Reçoit depuis le channel layer (group_send type="notification.message")
        et transmet au client WebSocket.
        """
        await self.send(json.dumps(event["data"], default=str))
        await self._envoyer_compteur()

    # ── Helpers DB ────────────────────────────────────────────────────

    @database_sync_to_async
    def _marquer_lue(self, notif_id: str) -> bool:
        try:
            from notifications.models import Notification
            notif = Notification.objects.get(
                id=notif_id,
                destinataire_id=self.user_id,
            )
            notif.marquer_lue()
            return True
        except Notification.DoesNotExist:
            return False
        except Exception as exc:
            logger.error("Erreur mark_read [%s] : %s", notif_id, exc)
            return False

    @database_sync_to_async
    def _marquer_toutes_lues(self) -> int:
        from notifications.services import marquer_toutes_lues
        return marquer_toutes_lues(self.user_id)

    @database_sync_to_async
    def _compter_non_lues(self) -> int:
        from notifications.models import Notification
        return Notification.objects.compter_non_lues(self.user_id)

    async def _envoyer_compteur(self):
        try:
            count = await self._compter_non_lues()
            await self.send(json.dumps({"action": "unread_count", "count": count}))
        except Exception as exc:
            logger.error("Erreur envoi compteur : %s", exc)