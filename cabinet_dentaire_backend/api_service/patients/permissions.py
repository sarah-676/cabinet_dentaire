"""
patients/permissions.py
========================
Classes de permission pour le module patients.
Compatible DRF 3.9+ (opérateur |).

request.user est un objet RemoteUser (config/authentication.py).
RemoteUser expose .get() et __getitem__ pour compatibilité dict.

CORRECTION vs ta version :
  - _get_role()    → utilise request.user.role (attribut RemoteUser)
                     avec fallback .get() pour compatibilité dict
  - _get_user_id() → retourne un UUID (str), pas un int
                     car auth_service utilise UUID pour les IDs

IMPORTANT :
  Le modèle Patient a dentiste_id = IntegerField dans ta version.
  Mais auth_service utilise des UUID (UUIDField).
  → On compare toujours en str() pour éviter les erreurs de type.
"""

from rest_framework.permissions import BasePermission, SAFE_METHODS


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_role(request) -> str:
    """
    Retourne le rôle depuis request.user.

    Compatible avec :
      - RemoteUser (objet avec .role)
      - dict (fallback)
      - None (retourne "")
    """
    user = getattr(request, "user", None)
    if user is None:
        return ""
    # RemoteUser expose .role directement
    if hasattr(user, "role"):
        return user.role or ""
    # Fallback dict
    if isinstance(user, dict):
        return user.get("role", "")
    return ""


def _get_user_id(request):
    """
    Retourne l'ID utilisateur depuis request.user.

    Retourne un str (UUID) ou None.
    Compatible avec RemoteUser (.id) et dict (.get("user_id")).

    NOTE : auth_service utilise des UUID (ex: "550e8400-e29b-41d4-a716...").
    Le modèle Patient.dentiste_id est IntegerField dans ta version actuelle.
    → Si tu passes à UUIDField, la comparaison fonctionne directement.
    → En attendant, on retourne le str UUID tel quel.
    """
    user = getattr(request, "user", None)
    if user is None:
        return None
    # RemoteUser
    if hasattr(user, "id"):
        return user.id
    # Fallback dict
    if isinstance(user, dict):
        return user.get("user_id") or user.get("id")
    return None


# ── Permissions ───────────────────────────────────────────────────────────────

class IsDentiste(BasePermission):
    message = "Accès réservé aux dentistes."

    def has_permission(self, request, view) -> bool:
        return _get_role(request) == "dentiste"


class IsAdmin(BasePermission):
    message = "Accès réservé aux administrateurs."

    def has_permission(self, request, view) -> bool:
        return _get_role(request) == "admin"


class IsReceptioniste(BasePermission):
    """
    ATTENTION : auth_service utilise "receptionniste" (avec 1 seul 'n').
    Vérifier la valeur exacte dans auth_service/auth_app/models.py :
      UserRole.RECEPTIONNISTE = "receptionniste"
    """
    message = "Accès réservé aux réceptionnistes."

    def has_permission(self, request, view) -> bool:
        return _get_role(request) == "receptionniste"


class IsDentisteOrAdmin(BasePermission):
    message = "Accès réservé aux dentistes et administrateurs."

    def has_permission(self, request, view) -> bool:
        return _get_role(request) in ("dentiste", "admin")


class IsDentisteOrReceptionniste(BasePermission):
    message = "Accès réservé aux dentistes, administrateurs et réceptionnistes."

    def has_permission(self, request, view) -> bool:
        return _get_role(request) in ("dentiste", "admin", "receptionniste")


class IsPatientOwner(BasePermission):
    """
    Permission au niveau de l'objet Patient.

    Règles :
      - Admin           → accès total
      - Dentiste        → uniquement ses patients (dentiste_id == user.id)
      - Réceptionniste  → ses patients (receptionniste_id == user.id) pour modification/suppression
                         lecture seule pour les autres
      - Autres          → refus
    """
    message = "Vous n'êtes pas autorisé à accéder à ce patient."

    def has_object_permission(self, request, view, obj) -> bool:
        role    = _get_role(request)
        user_id = _get_user_id(request)

        if role == "admin":
            return True

        if role == "dentiste":
            # Comparer en str() — dentiste_id peut être int ou UUID
            return str(obj.dentiste_id) == str(user_id)

        if role == "receptionniste":
            # Réceptionniste peut lire tous, modifier/supprimer seulement les siens
            if request.method in SAFE_METHODS:
                return True
            # Pour modification/suppression, seulement ses patients
            return str(obj.receptionniste_id) == str(user_id)

        return False