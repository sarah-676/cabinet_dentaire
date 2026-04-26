from django.urls import re_path

from config.ws_proxy import WebSocketProxyConsumer

websocket_urlpatterns = [
    re_path(r"^ws/(?P<path>.*)$", WebSocketProxyConsumer.as_asgi()),
]
