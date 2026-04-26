"""
auth_app/views.py — version finale
Ajout : InternalUserView → endpoint utilisé par api_service
        pour vérifier qu'un dentiste existe et est actif.
"""
import logging
from django.contrib.auth import get_user_model
from rest_framework import viewsets, status, filters
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError
from drf_spectacular.utils import extend_schema, extend_schema_view, OpenApiParameter

from auth_app.models import UserRole
from auth_app.permissions import IsAdmin, IsAdminOrSelf, IsInternalService
from auth_app.serializers import (
    CustomTokenObtainPairSerializer,
    UserProfileSerializer,
    UserListSerializer,
    UserCreateSerializer,
    UserUpdateSelfSerializer,
    UserUpdateAdminSerializer,
    ChangePasswordSerializer,
    InternalUserSerializer,
)

User   = get_user_model()
logger = logging.getLogger("auth_app")


# ── Auth ──────────────────────────────────────────────────────────────────────

class LoginView(TokenObtainPairView):
    """
    POST /api/auth/login/
    Retourne access_token + refresh_token + données utilisateur.
    """
    serializer_class   = CustomTokenObtainPairSerializer
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        if response.status_code == 200:
            user_id = response.data.get("user", {}).get("id")
            logger.info("Connexion réussie — user_id=%s", user_id)
        return response


class LogoutView(APIView):
    """
    POST /api/auth/logout/
    Blackliste le refresh token → invalide la session.
    Body : { "refresh": "<token>" }
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        refresh = request.data.get("refresh")
        if not refresh:
            return Response(
                {"detail": "Le champ 'refresh' est requis."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            token = RefreshToken(refresh)
            token.blacklist()
            logger.info("Déconnexion — %s", request.user.email)
            return Response({"detail": "Déconnexion réussie."})
        except TokenError:
            return Response(
                {"detail": "Token invalide ou déjà expiré."},
                status=status.HTTP_400_BAD_REQUEST,
            )


class VerifyTokenView(APIView):
    """
    GET /api/auth/verify/
    Vérifie le token JWT et retourne les infos utilisateur.

    Utilisé par api_service/config/authentication.py pour
    authentifier chaque requête entrante.

    Réponse :
      {
        "valid": true,
        "user": {
          "id":        "uuid",
          "email":     "...",
          "full_name": "...",
          "role":      "dentiste",
          "is_active": true
        }
      }
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({
            "valid": True,
            "user": {
                "id":        str(request.user.id),
                "email":     request.user.email,
                "full_name": request.user.full_name,
                "role":      request.user.role,
                "is_active": request.user.is_active,
            },
        })


# ── Profil ────────────────────────────────────────────────────────────────────

class ProfileView(APIView):
    """
    GET   /api/auth/profile/  → voir son profil
    PATCH /api/auth/profile/  → modifier son profil
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserProfileSerializer(request.user).data)

    def patch(self, request):
        serializer = UserUpdateSelfSerializer(
            request.user, data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(UserProfileSerializer(request.user).data)


class ChangePasswordView(APIView):
    """POST /api/auth/profile/change-password/"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        request.user.set_password(serializer.validated_data["new_password"])
        request.user.save()
        logger.info("Mot de passe changé — %s", request.user.email)
        return Response({"detail": "Mot de passe modifié avec succès."})


# ── ModelViewSet Utilisateurs ─────────────────────────────────────────────────

@extend_schema_view(
    list=extend_schema(
        summary="Liste des utilisateurs (admins voient tous, autres voient leur compte)",
        parameters=[
            OpenApiParameter("role",      description="Filtrer par rôle (admin/dentiste/receptionniste)"),
            OpenApiParameter("is_active", description="Filtrer par statut (true/false)"),
            OpenApiParameter("search",    description="Recherche nom/email/téléphone"),
        ],
    ),
    create=extend_schema(summary="Créer un utilisateur [Admin]"),
    retrieve=extend_schema(summary="Détail d'un utilisateur [Admin ou soi-même]"),
    partial_update=extend_schema(summary="Modifier un utilisateur [Admin ou soi-même]"),
    destroy=extend_schema(summary="Désactiver un utilisateur (soft delete) [Admin]"),
)
class UserViewSet(viewsets.ModelViewSet):
    """
    CRUD utilisateurs — admins gèrent tous, utilisateurs gèrent leur compte.

    Routes :
      GET    /api/auth/users/                   → liste (filtrée)
      POST   /api/auth/users/                   → créer [Admin]
      GET    /api/auth/users/{id}/              → détail [Admin ou soi]
      PATCH  /api/auth/users/{id}/              → modifier [Admin ou soi]
      DELETE /api/auth/users/{id}/              → désactiver (soft) [Admin]
      PATCH  /api/auth/users/{id}/toggle-actif/ → activer/désactiver [Admin]
      GET    /api/auth/users/dentistes/         → liste dentistes [Auth]
      GET    /api/auth/users/receptionnistes/   → liste réceptionnistes [Auth]
      GET    /api/auth/users/stats/             → statistiques [Admin]
    """
    queryset           = User.objects.all().order_by("-date_joined")
    permission_classes = [IsAuthenticated, IsAdminOrSelf]
    filter_backends    = [filters.SearchFilter, filters.OrderingFilter]
    search_fields      = ["email", "first_name", "last_name", "phone"]
    ordering_fields    = ["date_joined", "last_name", "role"]
    http_method_names  = ["get", "post", "patch", "delete", "head", "options"]

    def get_queryset(self):
        qs = super().get_queryset()
        # Non-admins ne voient que leur propre compte
        if self.request.user.role != UserRole.ADMIN:
            qs = qs.filter(pk=self.request.user.pk)
        role      = self.request.query_params.get("role")
        is_active = self.request.query_params.get("is_active")
        if role:
            qs = qs.filter(role=role)
        if is_active is not None:
            qs = qs.filter(is_active=is_active.lower() == "true")
        return qs

    def get_serializer_class(self):
        if self.action == "create":
            return UserCreateSerializer
        if self.action in ("partial_update", "update"):
            return UserUpdateAdminSerializer
        if self.action == "list":
            return UserListSerializer
        return UserProfileSerializer

    def get_permissions(self):
        # dentistes et receptionnistes : accessibles à tous les connectés
        if self.action in ("dentistes", "receptionnistes"):
            return [IsAuthenticated()]
        # créer, désactiver, toggle : admin seulement
        if self.action in ("create", "destroy", "toggle_actif"):
            return [IsAuthenticated(), IsAdmin()]
        return super().get_permissions()

    def perform_destroy(self, instance):
        """Soft delete : désactiver sans supprimer."""
        if instance.pk == self.request.user.pk:
            from rest_framework.exceptions import ValidationError
            raise ValidationError("Vous ne pouvez pas désactiver votre propre compte.")
        instance.is_active = False
        instance.save()
        logger.info("Désactivé par %s : %s", self.request.user.email, instance.email)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        self.perform_destroy(instance)
        return Response(
            {"detail": f"Utilisateur '{instance.full_name}' désactivé."},
            status=status.HTTP_200_OK,
        )

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        logger.info("Créé par %s : %s (%s)", request.user.email, user.email, user.role)
        return Response(UserProfileSerializer(user).data, status=status.HTTP_201_CREATED)

    # ── @action : liste dentistes ─────────────────────────────────────

    @action(detail=False, methods=["get"], url_path="dentistes")
    def dentistes(self, request):
        """
        GET /api/auth/users/dentistes/
        Liste des dentistes actifs — utilisée par le réceptionniste
        pour sélectionner un dentiste lors de l'ajout d'un patient/RDV.
        """
        qs = User.objects.filter(
            role=UserRole.DENTISTE, is_active=True
        ).order_by("last_name")
        return Response(UserListSerializer(qs, many=True).data)

    # ── @action : liste réceptionnistes ──────────────────────────────

    @action(detail=False, methods=["get"], url_path="receptionnistes")
    def receptionnistes(self, request):
        """
        GET /api/auth/users/receptionnistes/
        Liste des réceptionnistes actifs.
        """
        qs = User.objects.filter(
            role=UserRole.RECEPTIONNISTE, is_active=True
        ).order_by("last_name")
        return Response(UserListSerializer(qs, many=True).data)

    # ── @action : stats ───────────────────────────────────────────────

    @action(detail=False, methods=["get"], url_path="stats",
            permission_classes=[IsAuthenticated, IsAdmin])
    def stats(self, request):
        """
        GET /api/auth/users/stats/
        Statistiques pour le dashboard Admin.
        """
        return Response({
            "total":           User.objects.filter(is_active=True).count(),
            "admins":          User.objects.filter(role=UserRole.ADMIN,          is_active=True).count(),
            "dentistes":       User.objects.filter(role=UserRole.DENTISTE,        is_active=True).count(),
            "receptionnistes": User.objects.filter(role=UserRole.RECEPTIONNISTE,  is_active=True).count(),
            "inactifs":        User.objects.filter(is_active=False).count(),
        })

    # ── @action : toggle actif ────────────────────────────────────────

    @action(detail=True, methods=["patch"], url_path="toggle-actif",
            permission_classes=[IsAuthenticated, IsAdmin])
    def toggle_actif(self, request, pk=None):
        """PATCH /api/auth/users/{id}/toggle-actif/ → activer/désactiver."""
        user = self.get_object()
        if user.pk == request.user.pk:
            return Response(
                {"detail": "Impossible d'agir sur votre propre compte."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user.is_active = not user.is_active
        user.save()
        etat = "activé" if user.is_active else "désactivé"
        logger.info("Compte %s %s par %s", user.email, etat, request.user.email)
        return Response({"detail": f"Compte {etat}.", "is_active": user.is_active})


# ── Endpoint interne pour api_service ─────────────────────────────────────────

class InternalUserView(APIView):
    """
    GET /api/auth/internal/users/{user_id}/

    Endpoint utilisé par api_service pour vérifier un utilisateur.
    Exemple d'utilisation dans common/services.py :
        verifier_dentiste_actif(dentiste_id)
        → appelle GET /api/auth/internal/users/{dentiste_id}/
        → vérifie que role == "dentiste" et is_active == True

    Sécurisé par token Bearer (le token admin du service).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, user_id):
        try:
            user = User.objects.get(id=user_id)
            return Response(InternalUserSerializer(user).data)
        except User.DoesNotExist:
            return Response(
                {"detail": "Utilisateur introuvable."},
                status=status.HTTP_404_NOT_FOUND,
            )


# ── Health check ──────────────────────────────────────────────────────────────

class HealthView(APIView):
    """GET /api/auth/health/ — vérifié par Docker, Traefik et Consul."""
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({"status": "ok", "service": "auth_service"})

# ── Endpoint interne pour api_service ─────────────────────────────────────────

class InternalUserView(APIView):
    """
    GET /api/auth/internal/users/{user_id}/

    Endpoint utilisé par api_service pour vérifier un utilisateur.
    Sécurisé par X-Internal-Token (secret partagé, ne expire jamais).
    """
    permission_classes = [IsInternalService]   # ← étais IsAuthenticated

    def get(self, request, user_id):
        try:
            user = User.objects.get(id=user_id)
            return Response(InternalUserSerializer(user).data)
        except User.DoesNotExist:
            return Response(
                {"detail": "Utilisateur introuvable."},
                status=status.HTTP_404_NOT_FOUND,
            )
