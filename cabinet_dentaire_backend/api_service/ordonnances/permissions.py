"""
ordonnances/permissions.py
===========================
Permissions pour l'app ordonnances.

Copie exacte du pattern de patients/permissions.py
et rendezvous/permissions.py :
  - Mêmes helpers _get_role() / _get_user_id()
  - Même logique RemoteUser (attribut .role / fallback dict)
  - Même comparaison str(uuid) pour éviter erreurs de type

Règles métier :
  A-05 — Isolation stricte par dentiste (ordonnances visibles uniquement par leur dentiste)
  T-02 — CRUD ordonnances réservé aux dentistes
  Pas de réceptionniste sur les ordonnances (pas dans la checklist T-02)
"""

from rest_framework.permissions import BasePermission, SAFE_METHODS


# ── Helpers (identiques à patients/permissions.py) ────────────────────────────

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


# ── Permissions de base ───────────────────────────────────────────────────────

class IsDentiste(BasePermission):
    message = "Accès réservé aux dentistes."

    def has_permission(self, request, view) -> bool:
        return _get_role(request) == "dentiste"


class IsAdmin(BasePermission):
    message = "Accès réservé aux administrateurs."

    def has_permission(self, request, view) -> bool:
        return _get_role(request) == "admin"


class IsDentisteOrAdmin(BasePermission):
    message = "Accès réservé aux dentistes et administrateurs."

    def has_permission(self, request, view) -> bool:
        return _get_role(request) in ("dentiste", "admin")


# ── Permission niveau objet Ordonnance ────────────────────────────────────────

class IsOrdonnanceOwner(BasePermission):
    """
    Permission au niveau de l'objet Ordonnance.

    Règles (checklist A-05, U-03) :
      - Admin    → accès total
      - Dentiste → uniquement ses ordonnances (dentiste_id == user.id)
      - Autres   → refus

    Note : la réceptionniste n'a pas accès aux ordonnances
    (pas mentionnée dans la checklist T-02).
    """
    message = "Vous n'êtes pas autorisé à accéder à cette ordonnance."

    def has_object_permission(self, request, view, obj) -> bool:
        role    = _get_role(request)
        user_id = _get_user_id(request)

        if role == "admin":
            return True

        if role == "dentiste":
            return str(obj.dentiste_id) == str(user_id)

        return False
