"""
rendezvous/permissions.py
==========================
Permissions pour l'app rendezvous.

Copie exacte du pattern de patients/permissions.py :
  - Mêmes helpers _get_role() / _get_user_id()
  - Même logique RemoteUser (attribut .role / fallback dict)
  - Même comparaison str(uuid) pour éviter erreurs de type

Règles métier (checklist) :
  A-05 — Isolation stricte par dentiste (RDV visibles uniquement par leur dentiste)
  R-06 — Réceptionniste crée un RDV → dentiste doit valider
  T-05 — CRUD RDV réservé aux dentistes (et admin)
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


class IsReceptionniste(BasePermission):
    message = "Accès réservé aux réceptionnistes."

    def has_permission(self, request, view) -> bool:
        return _get_role(request) == "receptionniste"


class IsDentisteOrAdmin(BasePermission):
    message = "Accès réservé aux dentistes et administrateurs."

    def has_permission(self, request, view) -> bool:
        return _get_role(request) in ("dentiste", "admin")


class IsDentisteOrReceptionniste(BasePermission):
    message = "Accès réservé aux dentistes, réceptionnistes et administrateurs."

    def has_permission(self, request, view) -> bool:
        return _get_role(request) in ("dentiste", "admin", "receptionniste")


# ── Permission niveau objet RendezVous ────────────────────────────────────────

class IsRDVOwner(BasePermission):
    """
    Permission au niveau de l'objet RendezVous.

    Règles (checklist A-05, U-03) :
      - Admin          → accès total
      - Dentiste       → uniquement ses RDV (dentiste_id == user.id)
      - Réceptionniste → lecture seule (GET, HEAD, OPTIONS)
      - Autres         → refus
    """
    message = "Vous n'êtes pas autorisé à accéder à ce rendez-vous."

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