from rest_framework.permissions import BasePermission
from auth_app.models import UserRole
import os

class IsAdmin(BasePermission):
    message = "Accès réservé aux administrateurs."

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role == UserRole.ADMIN
        )


class IsDentiste(BasePermission):
    message = "Accès réservé aux dentistes."

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role == UserRole.DENTISTE
        )


class IsReceptionniste(BasePermission):
    message = "Accès réservé aux réceptionnistes."

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role == UserRole.RECEPTIONNISTE
        )


class IsAdminOrSelf(BasePermission):
    """Admin peut tout faire. Un utilisateur peut agir sur son propre compte."""
    message = "Vous n'avez pas la permission d'agir sur ce compte."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        return (
            request.user.role == UserRole.ADMIN
            or obj.pk == request.user.pk
        )

class IsInternalService(BasePermission):
    """
    Permission pour les appels inter-services.
    Vérifie le header X-Internal-Token contre INTERNAL_SERVICE_TOKEN dans .env.
    N'utilise PAS JWT — n'expire jamais.
    """
    message = "Token inter-service invalide ou manquant."

    def has_permission(self, request, view):
        expected_token = os.environ.get("INTERNAL_SERVICE_TOKEN", "")
        if not expected_token:
            return False
        received_token = request.headers.get("X-Internal-Token", "")
        return received_token == expected_token
