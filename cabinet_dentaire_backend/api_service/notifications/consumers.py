"""
notifications/consumers.py — api_service
✅ CORRIGÉ : refus explicite pour le rôle admin (code 4003)
"""

import json
import logging

from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser

logger = logging.getLogger("notifications")

# ✅ Rôles autorisés à recevoir des notifications WebSocket
ROLES_AUTORISES = {"dentiste", "receptionniste"}


def _est_authentifie(user) -> bool:
    if user is None:
        return False
    if isinstance(user, AnonymousUser):
        return False
    return bool(getattr(user, "is_authenticated", False))


class NotificationConsumer(AsyncWebsocketConsumer):

    async def connect(self):
        user = self.scope.get("user")

        # 1. Vérifier l'authentification
        if not _est_authentifie(user):
            logger.warning("WebSocket refusé — non authentifié")
            await self.close(code=4001)
            return

        # ✅ 2. Vérifier que le rôle est autorisé (pas admin)
        role = getattr(user, "role", "")
        if role not in ROLES_AUTORISES:
            logger.info(
                "WebSocket refusé — rôle '%s' non autorisé pour les notifications",
                role,
            )
            await self.close(code=4003)
            return

        # 3. Connexion acceptée
        self.user_id    = str(user.id)
        self.group_name = f"notifications_{self.user_id}"

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        logger.info("WebSocket connecté [user=%s, role=%s]", self.user_id, role)

        await self._envoyer_compteur()

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)
            logger.info(
                "WebSocket déconnecté [user=%s, code=%s]",
                getattr(self, "user_id", "?"), close_code,
            )

    async def receive(self, text_data):
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

    async def notification_message(self, event):
        await self.send(json.dumps(event["data"], default=str))
        await self._envoyer_compteur()

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