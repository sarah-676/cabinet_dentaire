"""
config/asgi.py — api_service
✅ CORRIGÉ : AllowedHostsOriginValidator retiré (bloquait localhost en dev)
"""

import os
from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

# ✅ Initialiser Django AVANT d'importer les apps Channels
django_asgi_app = get_asgi_application()

from channels.routing import ProtocolTypeRouter, URLRouter
from notifications.routing import websocket_urlpatterns
from config.ws_middleware import JwtAuthMiddlewareStack

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    # ✅ Sans AllowedHostsOriginValidator — compatible localhost en développement
    "websocket": JwtAuthMiddlewareStack(
        URLRouter(websocket_urlpatterns)
    ),
})