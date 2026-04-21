"""
config/asgi.py — api_service
==============================
Point d'entrée ASGI — HTTP + WebSocket (Django Channels).

À placer dans : config/asgi.py (remplace le fichier existant vide)

Configure le routing pour :
  - HTTP classique → Django views
  - WebSocket /ws/notifications/ → NotificationConsumer

ws_middleware.py doit être placé dans : config/ws_middleware.py
"""

import os

from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

# ✅ Initialiser Django AVANT d'importer les apps Channels
django_asgi_app = get_asgi_application()

from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import AllowedHostsOriginValidator

from notifications.routing import websocket_urlpatterns
from config.ws_middleware import JwtAuthMiddlewareStack

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": AllowedHostsOriginValidator(
        JwtAuthMiddlewareStack(
            URLRouter(websocket_urlpatterns)
        )
    ),
})