"""
radios/permissions.py — api_service
======================================
Permissions pour le module radiographies.

Règles :
  Admin      → accès total
  Dentiste   → ses radios uniquement (dentiste_id == user.id)
  Autre      → refus

Cohérence avec patients/permissions.py :
  - Même _get_role() / _get_user_id()
  - Compatible RemoteUser (config/authentication.py)
"""

from rest_framework.permissions import BasePermission, SAFE_METHODS


def _get_role(request) -> str:
    user = getattr(request, "user", None)
    if user is None:
        return ""
    if hasattr(user, "role"):
        return user.role or ""
    if isinstance(user, dict):
        return user.get("role", "")
    return ""


def _get_user_id(request):
    user = getattr(request, "user", None)
    if user is None:
        return None
    if hasattr(user, "id"):
        return user.id
    if isinstance(user, dict):
        return user.get("user_id") or user.get("id")
    return None


class IsRadioOwner(BasePermission):
    """
    Vérifie que la radio appartient au dentiste courant.

    Admin   → accès total
    Dentiste → uniquement ses radios (dentiste_id == user.id)
    Autres  → refus
    """
    message = "Vous n'êtes pas autorisé à accéder à cette radiographie."

    def has_object_permission(self, request, view, obj) -> bool:
        role    = _get_role(request)
        user_id = _get_user_id(request)

        if role == "admin":
            return True

        if role == "dentiste":
            return str(obj.dentiste_id) == str(user_id)

        return False
