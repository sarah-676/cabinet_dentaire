import uuid
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.utils import timezone


class UserRole(models.TextChoices):
    ADMIN          = "admin",          "Administrateur"
    DENTISTE       = "dentiste",       "Dentiste"
    RECEPTIONNISTE = "receptionniste", "Réceptionniste"


class UserManager(BaseUserManager):

    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("L'email est obligatoire.")
        email = self.normalize_email(email)
        user  = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password, **extra_fields):
        extra_fields.setdefault("role",         UserRole.ADMIN)
        extra_fields.setdefault("is_staff",     True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_active",    True)
        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    """
    Modèle utilisateur unique pour les trois rôles du cabinet :
    Admin, Dentiste, Réceptionniste.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # ── Identité ─────────────────────────────────────────────────
    email      = models.EmailField(unique=True, verbose_name="Email")
    first_name = models.CharField(max_length=100, verbose_name="Prénom")
    last_name  = models.CharField(max_length=100, verbose_name="Nom")
    phone      = models.CharField(max_length=20, blank=True, verbose_name="Téléphone")
    avatar     = models.ImageField(
        upload_to="avatars/%Y/%m/", null=True, blank=True, verbose_name="Avatar"
    )

    # ── Rôle ─────────────────────────────────────────────────────
    role = models.CharField(
        max_length=20,
        choices=UserRole.choices,
        default=UserRole.RECEPTIONNISTE,
        verbose_name="Rôle",
        db_index=True,
    )

    # ── Infos métier (dentiste uniquement) ────────────────────────
    specialite    = models.CharField(max_length=150, blank=True, verbose_name="Spécialité")
    numero_ordre  = models.CharField(max_length=50,  blank=True, verbose_name="N° d'ordre")

    # ── Statut Django ────────────────────────────────────────────
    is_active = models.BooleanField(default=True,  verbose_name="Actif")
    is_staff  = models.BooleanField(default=False, verbose_name="Staff admin")

    # ── Dates ────────────────────────────────────────────────────
    date_joined = models.DateTimeField(default=timezone.now, verbose_name="Créé le")
    updated_at  = models.DateTimeField(auto_now=True,        verbose_name="Modifié le")

    objects = UserManager()

    USERNAME_FIELD  = "email"
    REQUIRED_FIELDS = ["first_name", "last_name"]

    class Meta:
        db_table         = "users"
        verbose_name     = "Utilisateur"
        verbose_name_plural = "Utilisateurs"
        ordering         = ["-date_joined"]
        indexes = [
            models.Index(fields=["email"]),
            models.Index(fields=["role", "is_active"]),
        ]

    def __str__(self):
        return f"{self.full_name} ({self.get_role_display()})"

    # ── Propriétés ───────────────────────────────────────────────
    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}".strip()

    @property
    def is_admin(self):
        return self.role == UserRole.ADMIN

    @property
    def is_dentiste(self):
        return self.role == UserRole.DENTISTE

    @property
    def is_receptionniste(self):
        return self.role == UserRole.RECEPTIONNISTE