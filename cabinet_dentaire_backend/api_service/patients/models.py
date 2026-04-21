"""
patients/models.py — api_service
==================================
Modèle Patient pour le cabinet dentaire.

CORRECTION IMPORTANTE vs ta version :
  dentiste_id = UUIDField  (pas IntegerField !)
  → auth_service utilise UUID pour tous les IDs utilisateurs
  → models.py de ta camarade : id = UUIDField(primary_key=True)
  → Si tu gardes IntegerField, la comparaison avec UUID échoue toujours

Tout le reste est identique à ta version.
"""

import uuid

from django.db import models
from django.utils import timezone
from django.core.validators import RegexValidator


# ── Choix ─────────────────────────────────────────────────────────────────────

class GroupeSanguin(models.TextChoices):
    A_POS   = "A+",      "A+"
    A_NEG   = "A-",      "A-"
    B_POS   = "B+",      "B+"
    B_NEG   = "B-",      "B-"
    AB_POS  = "AB+",     "AB+"
    AB_NEG  = "AB-",     "AB-"
    O_POS   = "O+",      "O+"
    O_NEG   = "O-",      "O-"
    INCONNU = "INCONNU", "Non renseigné"


class StatutValidation(models.TextChoices):
    ACCEPTE = "ACCEPTE", "Accepté"
    PENDING = "PENDING", "En attente de validation"
    REFUSE  = "REFUSE",  "Refusé"


class NiveauAlerte(models.TextChoices):
    CRITIQUE      = "CRITIQUE",      "Critique"
    AVERTISSEMENT = "AVERTISSEMENT", "Avertissement"
    INFO          = "INFO",          "Information"


phone_validator = RegexValidator(
    regex=r"^\+?[0-9]{9,15}$",
    message="Format invalide. Ex : 0551234567 ou +213551234567",
)


# ── QuerySet / Managers ───────────────────────────────────────────────────────

class PatientQuerySet(models.QuerySet):

    def actifs(self):
        return self.filter(is_active=True)

    def archives(self):
        return self.filter(is_active=False)

    def du_dentiste(self, dentiste_id):
        """Patients actifs d'un dentiste (dentiste_id = UUID str ou UUID)."""
        return self.filter(dentiste_id=dentiste_id, is_active=True)

    def en_attente(self):
        return self.filter(statut=StatutValidation.PENDING, is_active=True)

    def nouveaux_ce_mois(self):
        now = timezone.now()
        return self.filter(
            created_at__year=now.year,
            created_at__month=now.month,
            is_active=True,
        )

    def age_range(self, min_age: int, max_age: int):
        today    = timezone.now().date()
        date_max = today.replace(year=today.year - min_age)
        date_min = today.replace(year=today.year - max_age)
        return self.filter(date_naissance__range=(date_min, date_max))

    def avec_allergies(self):
        return self.exclude(allergies="")

    def mineurs(self):
        today       = timezone.now().date()
        date_limite = today.replace(year=today.year - 18)
        return self.filter(date_naissance__gt=date_limite, is_active=True)


class PatientManager(models.Manager):
    def get_queryset(self):
        return PatientQuerySet(self.model, using=self._db)

    def actifs(self):
        return self.get_queryset().actifs()

    def du_dentiste(self, did):
        return self.get_queryset().du_dentiste(did)

    def en_attente(self):
        return self.get_queryset().en_attente()

    def nouveaux_ce_mois(self):
        return self.get_queryset().nouveaux_ce_mois()

    def mineurs(self):
        return self.get_queryset().mineurs()


class AllObjectsManager(models.Manager):
    """Manager sans filtre — accès à tous les patients (actifs + archivés)."""
    def get_queryset(self):
        return PatientQuerySet(self.model, using=self._db)


# ── Modèle Patient ────────────────────────────────────────────────────────────

class Patient(models.Model):
    """
    Représente un patient du cabinet dentaire.

    Cycle de vie :
      Réceptionniste crée → statut PENDING
      Dentiste accepte    → statut ACCEPTE  (patient visible)
      Dentiste refuse     → statut REFUSE   (notification envoyée)
      Dentiste archive    → is_active=False (soft delete)
    """

    # ── PK UUID ───────────────────────────────────────────────────────
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
        verbose_name="Identifiant unique",
    )

    # ── Informations personnelles ─────────────────────────────────────
    nom            = models.CharField(max_length=100, verbose_name="Nom")
    prenom         = models.CharField(max_length=100, verbose_name="Prénom")
    date_naissance = models.DateField(verbose_name="Date de naissance")
    sexe           = models.CharField(
        max_length=1,
        choices=[("M", "Masculin"), ("F", "Féminin")],
        blank=True,
        verbose_name="Sexe",
    )
    telephone = models.CharField(
        max_length=20,
        validators=[phone_validator],
        verbose_name="Téléphone",
    )
    email   = models.EmailField(blank=True, null=True, verbose_name="Email")
    adresse = models.TextField(blank=True, verbose_name="Adresse")

    # ── Informations médicales ────────────────────────────────────────
    groupe_sanguin = models.CharField(
        max_length=10,
        choices=GroupeSanguin.choices,
        default=GroupeSanguin.INCONNU,
        blank=True,
        verbose_name="Groupe sanguin",
    )
    allergies           = models.TextField(blank=True, verbose_name="Allergies")
    antecedents         = models.TextField(blank=True, verbose_name="Antécédents médicaux")
    medicaments_actuels = models.TextField(blank=True, verbose_name="Médicaments actuels")
    note_generale       = models.TextField(blank=True, verbose_name="Note générale")

    # ── Alertes médicales (booléens) ──────────────────────────────────
    alerte_anticoagulants = models.BooleanField(
        default=False, verbose_name="Sous anticoagulants",
        help_text="Risque hémorragique — adapter les soins.",
    )
    alerte_diabete = models.BooleanField(
        default=False, verbose_name="Diabétique",
        help_text="Vérifier glycémie, cicatrisation lente.",
    )
    alerte_grossesse = models.BooleanField(
        default=False, verbose_name="Enceinte",
        help_text="Éviter rayons X, certains anesthésiques.",
    )
    alerte_allergie_latex = models.BooleanField(
        default=False, verbose_name="Allergie au latex",
        help_text="Utiliser matériel sans latex.",
    )
    alerte_cardiopathie = models.BooleanField(
        default=False, verbose_name="Cardiopathie",
        help_text="Antibioprophylaxie possible.",
    )
    alerte_immunodeprime = models.BooleanField(
        default=False, verbose_name="Immunodéprimé",
        help_text="Précautions antiseptiques renforcées.",
    )

    # ── Lien dentiste (UUID depuis auth_service) ──────────────────────
    # ✅ CORRECTION : UUIDField (pas IntegerField)
    # auth_service.User.id est un UUIDField → on doit stocker un UUID ici
    dentiste_id = models.UUIDField(
        verbose_name="UUID du dentiste référent",
        db_index=True,
    )

    receptionniste_id = models.UUIDField(
        null=True,
        blank=True,
        verbose_name="UUID de la réceptionniste qui a créé le patient",
        db_index=True,
    )

    # ── Statut de validation ──────────────────────────────────────────
    statut = models.CharField(
        max_length=10,
        choices=StatutValidation.choices,
        default=StatutValidation.ACCEPTE,
        verbose_name="Statut de validation",
        db_index=True,
    )
    refuse_raison = models.TextField(blank=True, verbose_name="Raison du refus")

    # ── Soft delete ───────────────────────────────────────────────────
    is_active   = models.BooleanField(default=True, db_index=True)
    archived_at = models.DateTimeField(null=True, blank=True)
    archived_by = models.UUIDField(null=True, blank=True)  # UUID aussi

    # ── Timestamps ────────────────────────────────────────────────────
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    # ── Managers ──────────────────────────────────────────────────────
    objects     = PatientManager()
    all_objects = AllObjectsManager()

    class Meta:
        verbose_name        = "Patient"
        verbose_name_plural = "Patients"
        ordering            = ["-created_at"]
        indexes = [
            models.Index(fields=["dentiste_id", "is_active"]),
            models.Index(fields=["statut",      "is_active"]),
            models.Index(fields=["nom",         "prenom"]),
            models.Index(fields=["date_naissance"]),
        ]

    def __str__(self) -> str:
        return f"{self.nom} {self.prenom} (id={self.pk})"

    # ── Propriétés calculées ──────────────────────────────────────────

    @property
    def nom_complet(self) -> str:
        return f"{self.prenom} {self.nom}"

    @property
    def age(self) -> int:
        today = timezone.now().date()
        dob   = self.date_naissance
        return today.year - dob.year - (
            (today.month, today.day) < (dob.month, dob.day)
        )

    @property
    def est_mineur(self) -> bool:
        return self.age < 18

    @property
    def alertes_actives(self) -> list[dict]:
        """
        Alertes médicales actives — zéro requête SQL supplémentaire.
        Utilise uniquement les champs booléens déjà chargés en mémoire.
        """
        alertes   = []
        catalogue = [
            {
                "champ":   "alerte_anticoagulants",
                "code":    "ANTICOAGULANTS",
                "label":   "Sous anticoagulants",
                "niveau":  NiveauAlerte.CRITIQUE,
                "conseil": "Risque hémorragique — adapter les soins invasifs.",
            },
            {
                "champ":   "alerte_diabete",
                "code":    "DIABETE",
                "label":   "Diabétique",
                "niveau":  NiveauAlerte.AVERTISSEMENT,
                "conseil": "Vérifier glycémie, cicatrisation potentiellement lente.",
            },
            {
                "champ":   "alerte_grossesse",
                "code":    "GROSSESSE",
                "label":   "Enceinte",
                "niveau":  NiveauAlerte.CRITIQUE,
                "conseil": "Éviter rayons X et certains anesthésiques.",
            },
            {
                "champ":   "alerte_allergie_latex",
                "code":    "LATEX",
                "label":   "Allergie au latex",
                "niveau":  NiveauAlerte.CRITIQUE,
                "conseil": "Utiliser uniquement matériel sans latex.",
            },
            {
                "champ":   "alerte_cardiopathie",
                "code":    "CARDIOPATHIE",
                "label":   "Cardiopathie",
                "niveau":  NiveauAlerte.AVERTISSEMENT,
                "conseil": "Antibioprophylaxie possible — consulter le cardiologue.",
            },
            {
                "champ":   "alerte_immunodeprime",
                "code":    "IMMUNODEPRIME",
                "label":   "Immunodéprimé",
                "niveau":  NiveauAlerte.AVERTISSEMENT,
                "conseil": "Précautions antiseptiques renforcées.",
            },
        ]

        for item in catalogue:
            if getattr(self, item["champ"], False):
                alertes.append({
                    "code":    item["code"],
                    "label":   item["label"],
                    "niveau":  item["niveau"],
                    "conseil": item["conseil"],
                })

        # Allergie texte libre sans flag latex
        if self.allergies.strip() and not self.alerte_allergie_latex:
            alertes.append({
                "code":    "ALLERGIE_LIBRE",
                "label":   "Allergie déclarée",
                "niveau":  NiveauAlerte.AVERTISSEMENT,
                "conseil": self.allergies[:120],
            })

        return alertes

    # ── Méthodes métier ───────────────────────────────────────────────

    def archiver(self, archived_by_id) -> None:
        if not self.is_active:
            return
        self.is_active   = False
        self.archived_at = timezone.now()
        self.archived_by = archived_by_id
        self.save(update_fields=["is_active", "archived_at", "archived_by", "updated_at"])

    def restaurer(self) -> None:
        if self.is_active:
            return
        self.is_active   = True
        self.archived_at = None
        self.archived_by = None
        self.save(update_fields=["is_active", "archived_at", "archived_by", "updated_at"])

    def accepter(self) -> None:
        self.statut        = StatutValidation.ACCEPTE
        self.refuse_raison = ""
        self.save(update_fields=["statut", "refuse_raison", "updated_at"])

    def refuser(self, raison: str = "") -> None:
        self.statut        = StatutValidation.REFUSE
        self.refuse_raison = raison.strip()
        self.save(update_fields=["statut", "refuse_raison", "updated_at"])