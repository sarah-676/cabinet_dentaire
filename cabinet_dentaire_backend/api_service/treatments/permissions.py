"""
treatments/permissions.py — api_service
=========================================
Permissions pour l'app traitements.

Règles métier :
  - Seul le dentiste propriétaire peut créer/modifier/supprimer ses traitements
  - Admin → accès total
  - Réceptionniste → lecture seule (les traitements sont médicaux)
  - Autre dentiste → aucun accès (isolation stricte — U-03)
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


class IsTraitementOwner(BasePermission):
    """
    Permission au niveau de l'objet Traitement.

    Règles :
      - Admin           → accès total
      - Dentiste        → uniquement ses traitements (dentiste_id == user.id)
      - Réceptionniste  → lecture seule (traitements = données médicales)
      - Autres          → refus
    """
    message = "Vous n'êtes pas autorisé à accéder à ce traitement."

    def has_object_permission(self, request, view, obj) -> bool:
        role    = _get_role(request)
        user_id = _get_user_id(request)

        if role == "admin":
            return True

        if role == "dentiste":
            return str(obj.dentiste_id) == str(user_id)

        if role == "receptionniste":
            return request.method in SAFE_METHODS

        return False


class IsDentisteOrAdmin(BasePermission):
    message = "Accès réservé aux dentistes et administrateurs."

    def has_permission(self, request, view) -> bool:
        return _get_role(request) in ("dentiste", "admin")


class IsDentiste(BasePermission):
    message = "Accès réservé aux dentistes."

    def has_permission(self, request, view) -> bool:
        return _get_role(request) == "dentiste"


class IsAdmin(BasePermission):
    message = "Accès réservé aux administrateurs."

    def has_permission(self, request, view) -> bool:
        return _get_role(request) == "admin"


class IsReceptioniste(BasePermission):
    message = "Accès réservé aux réceptionnistes."

    def has_permission(self, request, view) -> bool:
        return _get_role(request) == "receptionniste"