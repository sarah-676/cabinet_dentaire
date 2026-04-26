"""
notifications/routing.py — api_service
========================================
Routing WebSocket pour Django Channels.

À inclure dans config/asgi.py :
  from notifications.routing import websocket_urlpatterns

URL WebSocket :
  ws://api-service/ws/notifications/

Le frontend se connecte avec :
  const ws = new WebSocket(
    `ws://localhost:8000/ws/notifications/`,
    [],                          // protocols
    { headers: { Authorization: `Bearer ${token}` } }
  );

Ou via query string (si middleware le supporte) :
  ws://localhost:8000/ws/notifications/?token=<access_token>
"""

from django.urls import re_path
from .consumers import NotificationConsumer

websocket_urlpatterns = [
    re_path(r"^ws/notifications/?$", NotificationConsumer.as_asgi()),
]