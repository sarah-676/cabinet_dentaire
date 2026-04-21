"""
auth_app/serializers.py — version finale
Ajout : InternalUserSerializer → utilisé par InternalUserView
        pour que api_service vérifie un utilisateur.
"""
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

User = get_user_model()


# ── JWT personnalisé ──────────────────────────────────────────────────────────
class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Enrichit le payload JWT avec le rôle.
    Le frontend lit le rôle et redirige vers le bon dashboard.
    """

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        # Claims dans le token (décodables sans appel serveur)
        token["email"]     = user.email
        token["full_name"] = user.full_name
        token["role"]      = user.role
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        # Données dans la réponse HTTP (pas dans le token)
        data["user"] = UserProfileSerializer(self.user).data
        return data


# ── Profil ────────────────────────────────────────────────────────────────────
class UserProfileSerializer(serializers.ModelSerializer):
    full_name = serializers.ReadOnlyField()

    class Meta:
        model  = User
        fields = [
            "id", "email", "first_name", "last_name", "full_name",
            "phone", "role", "specialite", "numero_ordre",
            "avatar", "is_active", "date_joined", "updated_at",
        ]
        read_only_fields = ["id", "date_joined", "updated_at", "full_name"]


# ── Liste allégée ─────────────────────────────────────────────────────────────
class UserListSerializer(serializers.ModelSerializer):
    """Pour GET /users/, /dentistes/, /receptionnistes/"""
    full_name = serializers.ReadOnlyField()

    class Meta:
        model  = User
        fields = ["id", "email", "full_name", "role", "is_active", "specialite", "avatar"]


# ── Interne ───────────────────────────────────────────────────────────────────
class InternalUserSerializer(serializers.ModelSerializer):
    """
    Pour GET /api/auth/internal/users/{id}/
    Utilisé par api_service/common/services.py pour vérifier
    qu'un dentiste existe et est actif.

    Retourne uniquement les champs nécessaires à la vérification.
    """
    class Meta:
        model  = User
        fields = ["id", "email", "full_name", "role", "is_active", "specialite"]
        read_only_fields = fields

    full_name = serializers.ReadOnlyField()


# ── Création (Admin) ──────────────────────────────────────────────────────────
class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(
        write_only=True, required=True,
        validators=[validate_password],
        style={"input_type": "password"},
    )
    password_confirm = serializers.CharField(
        write_only=True, required=True,
        style={"input_type": "password"},
    )

    class Meta:
        model  = User
        fields = [
            "email", "first_name", "last_name", "phone",
            "role", "specialite", "numero_ordre",
            "password", "password_confirm", "is_active",
        ]

    def validate(self, attrs):
        if attrs["password"] != attrs.pop("password_confirm"):
            raise serializers.ValidationError(
                {"password_confirm": "Les mots de passe ne correspondent pas."}
            )
        return attrs

    def create(self, validated_data):
        password = validated_data.pop("password")
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


# ── Modification self ─────────────────────────────────────────────────────────
class UserUpdateSelfSerializer(serializers.ModelSerializer):
    class Meta:
        model  = User
        fields = ["first_name", "last_name", "phone", "specialite", "numero_ordre", "avatar"]


# ── Modification Admin ────────────────────────────────────────────────────────
class UserUpdateAdminSerializer(serializers.ModelSerializer):
    class Meta:
        model  = User
        fields = [
            "first_name", "last_name", "phone",
            "role", "specialite", "numero_ordre",
            "is_active", "avatar",
        ]


# ── Changement mot de passe ───────────────────────────────────────────────────
class ChangePasswordSerializer(serializers.Serializer):
    current_password     = serializers.CharField(write_only=True)
    new_password         = serializers.CharField(write_only=True, validators=[validate_password])
    new_password_confirm = serializers.CharField(write_only=True)

    def validate_current_password(self, value):
        if not self.context["request"].user.check_password(value):
            raise serializers.ValidationError("Mot de passe actuel incorrect.")
        return value

    def validate(self, attrs):
        if attrs["new_password"] != attrs["new_password_confirm"]:
            raise serializers.ValidationError(
                {"new_password_confirm": "Les nouveaux mots de passe ne correspondent pas."}
            )
        return attrs
