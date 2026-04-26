"""
config/ws_proxy.py — Gateway WebSocket proxy
Proxifie ws://gateway:8080/ws/* → ws://api_service:8000/ws/*
"""
import logging
from urllib.parse import urlencode, parse_qs

import websockets
from channels.generic.websocket import AsyncWebsocketConsumer
from django.conf import settings

logger = logging.getLogger("gateway_app")


class WebSocketProxyConsumer(AsyncWebsocketConsumer):

    async def connect(self):
        path= self.scope["url_route"]["kwargs"]["path"].strip("/")
        qs= self.scope.get("query_string", b"").decode()

        # URL cible : api_service WS
        target_base = getattr(settings, "API_SERVICE_WS_URL",
                              "ws://localhost:8000/ws/notifications/")
        target_url = f"ws://localhost:8000/ws/{path}"
        if qs:
            target_url += f"?{qs}"

        try:
            self._upstream = await websockets.connect(
                target_url,
                ping_interval=20,
                ping_timeout=10,
            )
        except Exception as e:
            logger.error("WS proxy: cannot connect to upstream %s: %s", target_url, e)
            await self.close(code=1011)
            return

        await self.accept()
        # Lancer la lecture upstream → client
        import asyncio
        asyncio.ensure_future(self._forward_upstream())

    async def disconnect(self, code):
        if hasattr(self, "_upstream"):
            try:
                await self._upstream.close()
            except Exception:
                pass

    async def receive(self, text_data=None, bytes_data=None):
        """Client → upstream"""
        if not hasattr(self, "_upstream"):
            return
        try:
            if text_data:
                await self._upstream.send(text_data)
            elif bytes_data:
                await self._upstream.send(bytes_data)
        except Exception as e:
            logger.warning("WS proxy send error: %s", e)
            await self.close()

    async def _forward_upstream(self):
        """Upstream → client"""
        try:
            async for message in self._upstream:
                if isinstance(message, str):
                    await self.send(text_data=message)
                else:
                    await self.send(bytes_data=message)
        except Exception:
            pass
        finally:
            await self.close()