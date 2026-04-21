"""
dossiers/permissions.py — api_service
========================================
Permissions pour le module dossier patient.
Même pattern que patients/permissions.py et treatments/permissions.py.
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


class IsDentisteOrAdmin(BasePermission):
    message = "Accès réservé aux dentistes et administrateurs."

    def has_permission(self, request, view) -> bool:
        return _get_role(request) in ("dentiste", "admin")


class IsReceptioniste(BasePermission):
    """Réceptionniste → lecture seule sur les dossiers."""
    message = "Accès réservé aux réceptionnistes."

    def has_permission(self, request, view) -> bool:
        if _get_role(request) != "receptionniste":
            return False
        return request.method in SAFE_METHODS