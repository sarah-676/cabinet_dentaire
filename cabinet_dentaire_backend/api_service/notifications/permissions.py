"""
notifications/permissions.py — api_service
============================================
Permissions pour le module notifications.

IsNotificationOwner : un utilisateur ne peut accéder qu'à SES notifications.
Compatible avec RemoteUser (config/authentication.py de api_service).
"""

from rest_framework.permissions import BasePermission


def _get_user_id(request) -> str | None:
    user = getattr(request, "user", None)
    if user is None:
        return None
    if hasattr(user, "id"):
        return str(user.id)
    if isinstance(user, dict):
        return str(user.get("user_id") or user.get("id", ""))
    return None


class IsNotificationOwner(BasePermission):
    """
    Vérifie que la notification appartient bien à l'utilisateur courant.
    Utilisé comme permission d'objet dans NotificationViewSet.
    """
    message = "Vous n'êtes pas autorisé à accéder à cette notification."

    def has_object_permission(self, request, view, obj) -> bool:
        user_id = _get_user_id(request)
        if not user_id:
            return False
        return str(obj.destinataire_id) == user_id