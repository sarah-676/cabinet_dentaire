"""
config/ws_middleware.py — api_service
========================================
Middleware JWT pour les connexions WebSocket.

CORRECTION BUG 2 :
  ❌ Ancienne version : créait un HttpRequest Django + Request DRF manuellement
     → authenticate() DRF ne fonctionnait pas (métadonnées mal mappées)
  ✅ Nouvelle version : décode le JWT directement avec PyJWT (même logique
     que config/authentication.py) sans passer par la stack DRF

Problème des WebSockets : ils ne supportent pas le header Authorization.
Solution : token passé en query string → ws://host/ws/notifications/?token=<jwt>

Usage dans config/asgi.py :
  from config.ws_middleware import JwtAuthMiddlewareStack
"""

import logging
from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware
from django.contrib.auth.models import AnonymousUser

logger = logging.getLogger("notifications")


class RemoteUser:
    """
    Utilisateur distant reconstruit depuis le payload JWT.
    Identique à ce que retourne config/authentication.py.
    is_authenticated = True pour que les consumers puissent vérifier.
    """
    is_authenticated = True
    is_anonymous     = False

    def __init__(self, payload: dict):
        self.id        = payload.get("user_id")
        self.email     = payload.get("email", "")
        self.full_name = payload.get("full_name", "")
        self.role      = payload.get("role", "")
        self.is_active = payload.get("is_active", True)

    def __str__(self):
        return f"RemoteUser(id={self.id}, role={self.role})"


class JwtAuthMiddleware(BaseMiddleware):
    """
    Middleware Channels qui authentifie les WebSockets via JWT.
    Token extrait depuis la query string : ?token=<access_token>

    ✅ Décode le JWT directement avec PyJWT — pas besoin de la stack DRF.
    La clé de signature est lue depuis settings.SIMPLE_JWT["SIGNING_KEY"].
    """

    async def __call__(self, scope, receive, send):
        query_string = scope.get("query_string", b"").decode()
        params       = parse_qs(query_string)
        token_list   = params.get("token", [])
        token        = token_list[0] if token_list else None

        if token:
            scope["user"] = await self._authentifier(token)
        else:
            scope["user"] = AnonymousUser()

        return await self.inner(scope, receive, send)

    @database_sync_to_async
    def _authentifier(self, token: str):
        """
        Décode et valide le token JWT.
        Retourne un RemoteUser ou AnonymousUser.
        """
        try:
            import jwt
            from django.conf import settings

            jwt_settings = settings.SIMPLE_JWT
            signing_key  = jwt_settings.get("SIGNING_KEY", settings.SECRET_KEY)
            algorithm    = jwt_settings.get("ALGORITHM", "HS256")

            payload = jwt.decode(
                token,
                signing_key,
                algorithms=[algorithm],
                options={"verify_exp": True},
            )

            user = RemoteUser(payload)
            logger.debug("WS auth OK : user_id=%s role=%s", user.id, user.role)
            return user

        except jwt.ExpiredSignatureError:
            logger.warning("WS auth : token expiré")
            return AnonymousUser()
        except jwt.InvalidTokenError as exc:
            logger.warning("WS auth : token invalide : %s", exc)
            return AnonymousUser()
        except Exception as exc:
            logger.error("WS auth : erreur inattendue : %s", exc)
            return AnonymousUser()


def JwtAuthMiddlewareStack(inner):
    """Factory — enveloppe le router dans le middleware JWT."""
    return JwtAuthMiddleware(inner)