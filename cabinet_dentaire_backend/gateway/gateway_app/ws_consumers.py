"""
WebSocket proxy consumer for gateway single-entrypoint mode.

Forwards client websocket traffic from:
  ws://gateway/ws/notifications/?token=<access_jwt>
to api_service Channels endpoint:
  ws://api-service/ws/notifications/?token=<access_jwt>
"""

import asyncio
import logging
from urllib.parse import parse_qs

import jwt as pyjwt
import websockets
from channels.generic.websocket import AsyncWebsocketConsumer
from django.conf import settings

logger = logging.getLogger("gateway_app")


class NotificationsProxyConsumer(AsyncWebsocketConsumer):
    """
    Reverse-proxy WebSocket frames between browser and api_service.
    """

    async def connect(self):
        token = self._extract_token()
        if not token or not self._is_valid_access_token(token):
            await self.close(code=4401)
            return

        self.upstream = None
        self.upstream_reader_task = None

        target = getattr(
            settings,
            "API_SERVICE_WS_URL",
            "ws://localhost:8000/ws/notifications/",
        ).rstrip("/")
        self.upstream_url = f"{target}/?token={token}"

        try:
            self.upstream = await websockets.connect(
                self.upstream_url,
                open_timeout=10,
                close_timeout=5,
                ping_interval=20,
                ping_timeout=20,
            )
        except Exception as exc:
            logger.error("WS upstream connect failed: %s", exc)
            await self.close(code=1013)
            return

        await self.accept()
        self.upstream_reader_task = asyncio.create_task(self._pump_upstream_to_client())
        logger.info("WS proxy connected: %s", self.upstream_url)

    async def disconnect(self, close_code):
        if getattr(self, "upstream_reader_task", None):
            self.upstream_reader_task.cancel()
            try:
                await self.upstream_reader_task
            except Exception:
                pass
            self.upstream_reader_task = None

        if getattr(self, "upstream", None):
            try:
                await self.upstream.close()
            except Exception:
                pass
            self.upstream = None

        logger.info("WS proxy disconnected (code=%s)", close_code)

    async def receive(self, text_data=None, bytes_data=None):
        if not self.upstream:
            return
        try:
            if text_data is not None:
                await self.upstream.send(text_data)
            elif bytes_data is not None:
                await self.upstream.send(bytes_data)
        except Exception as exc:
            logger.error("WS forward client->upstream failed: %s", exc)
            await self.close(code=1011)

    async def _pump_upstream_to_client(self):
        try:
            async for message in self.upstream:
                if isinstance(message, bytes):
                    await self.send(bytes_data=message)
                else:
                    await self.send(text_data=message)
        except asyncio.CancelledError:
            return
        except Exception as exc:
            logger.error("WS forward upstream->client failed: %s", exc)
            await self.close(code=1011)

    def _extract_token(self):
        raw_qs = self.scope.get("query_string", b"").decode()
        query = parse_qs(raw_qs)
        values = query.get("token", [])
        return values[0] if values else None

    def _is_valid_access_token(self, token: str) -> bool:
        jwt_conf = getattr(settings, "SIMPLE_JWT", {})
        secret = jwt_conf.get("SIGNING_KEY", getattr(settings, "SECRET_KEY", ""))
        algorithm = jwt_conf.get("ALGORITHM", "HS256")
        try:
            payload = pyjwt.decode(
                token,
                secret,
                algorithms=[algorithm],
                options={"verify_exp": True},
            )
            return payload.get("token_type") == "access"
        except Exception:
            return False
