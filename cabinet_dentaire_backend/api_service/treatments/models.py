"""
treatments/models.py — api_service
=====================================
Modèle Traitement pour le cabinet dentaire.

Cohérence avec le projet :
  - patient      → ForeignKey vers Patient (UUID)
  - dentiste_id  → UUIDField (auth_service utilise UUID)
  - Même pattern soft-delete via is_active
  - Même pattern UUID primary key

Checklist couverte :
  T-01 — Ajout et suivi des traitements effectués, historique médical complet
  D-07 — Dental Chart : suivi de l'état dentaire par dent
  D-08 — Dossier patient : section traitements agrégée
  D-03 — Accès aux informations détaillées du patient

Modèles :
  TypeActe       → enum des actes dentaires possibles
  Materiau       → enum des matériaux utilisés
  StatutTraitement → cycle de vie du traitement
  NumerooDent    → 32 dents numérotées (notation FDI internationale)
  Traitement     → modèle principal
  SeanceSoin     → sous-séances d'un traitement multi-visites
"""

import uuid

from django.core.validators import MinValueValidator, MaxValueValidator
from django.db import models
from django.utils import timezone

from patients.models import Patient


# ══════════════════════════════════════════════════════════════════════════════
# ÉNUMÉRATIONS
# ══════════════════════════════════════════════════════════════════════════════

class TypeActe(models.TextChoices):
    # ── Soins conservateurs ───────────────────────────────────────────
    CONSULTATION        = "CONSULTATION",        "Consultation / Examen"
    CONTROLE            = "CONTROLE",            "Contrôle / Suivi"
    DETARTRAGE          = "DETARTRAGE",          "Détartrage / Surfaçage"
    BLANCHIMENT         = "BLANCHIMENT",         "Blanchiment dentaire"
    # ── Soins restaurateurs ───────────────────────────────────────────
    OBTURATION          = "OBTURATION",          "Obturation / Plombage"
    INLAY_ONLAY         = "INLAY_ONLAY",         "Inlay / Onlay"
    FACETTE             = "FACETTE",             "Facette céramique"
    # ── Endodontie ────────────────────────────────────────────────────
    TRAITEMENT_CANAL    = "TRAITEMENT_CANAL",    "Traitement de canal (endodontie)"
    REPRISE_CANAL       = "REPRISE_CANAL",       "Reprise de traitement canalaire"
    PULPOTOMIE          = "PULPOTOMIE",          "Pulpotomie"
    APEXIFICATION       = "APEXIFICATION",       "Apexification"
    # ── Prothèses ─────────────────────────────────────────────────────
    COURONNE            = "COURONNE",            "Couronne prothétique"
    BRIDGE              = "BRIDGE",              "Bridge"
    PROTHESE_PARTIELLE  = "PROTHESE_PARTIELLE",  "Prothèse partielle amovible"
    PROTHESE_TOTALE     = "PROTHESE_TOTALE",     "Prothèse totale amovible"
    PROTHESE_SUR_IMPLANT= "PROTHESE_SUR_IMPLANT","Prothèse sur implant"
    # ── Chirurgie ─────────────────────────────────────────────────────
    EXTRACTION_SIMPLE   = "EXTRACTION_SIMPLE",   "Extraction simple"
    EXTRACTION_COMPLEXE = "EXTRACTION_COMPLEXE", "Extraction complexe / chirurgicale"
    DENT_DE_SAGESSE     = "DENT_DE_SAGESSE",     "Extraction dent de sagesse"
    IMPLANT             = "IMPLANT",             "Pose d'implant dentaire"
    GREFFE_OSSEUSE      = "GREFFE_OSSEUSE",      "Greffe osseuse"
    GREFFE_GINGIVALE    = "GREFFE_GINGIVALE",    "Greffe gingivale"
    FRENECTOMIE         = "FRENECTOMIE",         "Frenectomie"
    # ── Parodontologie ────────────────────────────────────────────────
    PARO_CHIRURGICAL    = "PARO_CHIRURGICAL",    "Traitement parodontal chirurgical"
    PARO_NON_CHIRURGICAL= "PARO_NON_CHIRURGICAL","Traitement parodontal non chirurgical"
    # ── Orthodontie ───────────────────────────────────────────────────
    ORTHODONTIE_FIXE    = "ORTHODONTIE_FIXE",    "Orthodontie fixe (bagues)"
    ORTHODONTIE_AMOVIBLE= "ORTHODONTIE_AMOVIBLE","Orthodontie amovible (gouttières)"
    CONTENTION          = "CONTENTION",          "Contention orthodontique"
    # ── Pédodontie ────────────────────────────────────────────────────
    SCELLEMENT          = "SCELLEMENT",          "Scellement de sillons"
    FLUORATION          = "FLUORATION",          "Application de fluor"
    PULPOTOMIE_LACTEAL  = "PULPOTOMIE_LACTEAL",  "Pulpotomie dent lactéale"
    # ── Radiologie ────────────────────────────────────────────────────
    RADIO_PERIAPICALE   = "RADIO_PERIAPICALE",   "Radiographie périapicale"
    RADIO_PANORAMIQUE   = "RADIO_PANORAMIQUE",   "Radiographie panoramique"
    RADIO_CEPHALO       = "RADIO_CEPHALO",       "Radiographie céphalométrique"
    # ── Urgences ─────────────────────────────────────────────────────
    URGENCE_DOULEUR     = "URGENCE_DOULEUR",     "Urgence douleur"
    URGENCE_TRAUMA      = "URGENCE_TRAUMA",      "Urgence traumatisme"
    URGENCE_ABCES       = "URGENCE_ABCES",       "Urgence abcès"
    # ── Autre ────────────────────────────────────────────────────────
    AUTRE               = "AUTRE",               "Autre acte"


class Materiau(models.TextChoices):
    # Restaurations
    COMPOSITE           = "COMPOSITE",           "Composite (résine)"
    AMALGAME            = "AMALGAME",            "Amalgame"
    CERAMIQUE           = "CERAMIQUE",           "Céramique"
    ZIRCONE             = "ZIRCONE",             "Zircone"
    OR                  = "OR",                  "Or / Métal précieux"
    METAL               = "METAL",               "Métal (non précieux)"
    CIMENT_VERRE        = "CIMENT_VERRE",        "Ciment verre ionomère (CVI)"
    RESINE_IONOMERE     = "RESINE_IONOMERE",     "Résine ionomère modifiée"
    # Implants
    TITANE              = "TITANE",              "Titane"
    ZIRCONE_IMPLANT     = "ZIRCONE_IMPLANT",     "Zircone (implant)"
    # Prothèses
    ACRYLIQUE           = "ACRYLIQUE",           "Acrylique (prothèse)"
    CHROME_COBALT       = "CHROME_COBALT",       "Chrome-cobalt (squelettée)"
    # Orthodontie
    ACIER               = "ACIER",              "Acier (brackets)"
    CERAMIQUE_ORTHO     = "CERAMIQUE_ORTHO",    "Céramique (brackets)"
    GOUTTIERE_SILICONE  = "GOUTTIERE_SILICONE", "Gouttière silicone"
    # Autre
    AUTRE               = "AUTRE",              "Autre matériau"
    NON_APPLICABLE      = "NON_APPLICABLE",     "Non applicable"


class StatutTraitement(models.TextChoices):
    PLANIFIE    = "PLANIFIE",    "Planifié"
    EN_COURS    = "EN_COURS",    "En cours (multi-séances)"
    TERMINE     = "TERMINE",     "Terminé"
    ABANDONNE   = "ABANDONNE",   "Abandonné / Interrompu"
    EN_ATTENTE  = "EN_ATTENTE",  "En attente (accord mutuelle)"


class NumeroDent(models.TextChoices):
    """
    Notation FDI (Fédération Dentaire Internationale).
    Quadrant 1 (adulte sup. droit) : 11-18
    Quadrant 2 (adulte sup. gauche): 21-28
    Quadrant 3 (adulte inf. gauche): 31-38
    Quadrant 4 (adulte inf. droit) : 41-48
    Quadrant 5 (lact. sup. droit)  : 51-55
    Quadrant 6 (lact. sup. gauche) : 61-65
    Quadrant 7 (lact. inf. gauche) : 71-75
    Quadrant 8 (lact. inf. droit)  : 81-85
    """
    # Quadrant 1
    D11 = "11", "11 — Incisive centrale sup. droite"
    D12 = "12", "12 — Incisive latérale sup. droite"
    D13 = "13", "13 — Canine sup. droite"
    D14 = "14", "14 — 1ère prémolaire sup. droite"
    D15 = "15", "15 — 2ème prémolaire sup. droite"
    D16 = "16", "16 — 1ère molaire sup. droite"
    D17 = "17", "17 — 2ème molaire sup. droite"
    D18 = "18", "18 — 3ème molaire sup. droite (sagesse)"
    # Quadrant 2
    D21 = "21", "21 — Incisive centrale sup. gauche"
    D22 = "22", "22 — Incisive latérale sup. gauche"
    D23 = "23", "23 — Canine sup. gauche"
    D24 = "24", "24 — 1ère prémolaire sup. gauche"
    D25 = "25", "25 — 2ème prémolaire sup. gauche"
    D26 = "26", "26 — 1ère molaire sup. gauche"
    D27 = "27", "27 — 2ème molaire sup. gauche"
    D28 = "28", "28 — 3ème molaire sup. gauche (sagesse)"
    # Quadrant 3
    D31 = "31", "31 — Incisive centrale inf. gauche"
    D32 = "32", "32 — Incisive latérale inf. gauche"
    D33 = "33", "33 — Canine inf. gauche"
    D34 = "34", "34 — 1ère prémolaire inf. gauche"
    D35 = "35", "35 — 2ème prémolaire inf. gauche"
    D36 = "36", "36 — 1ère molaire inf. gauche"
    D37 = "37", "37 — 2ème molaire inf. gauche"
    D38 = "38", "38 — 3ème molaire inf. gauche (sagesse)"
    # Quadrant 4
    D41 = "41", "41 — Incisive centrale inf. droite"
    D42 = "42", "42 — Incisive latérale inf. droite"
    D43 = "43", "43 — Canine inf. droite"
    D44 = "44", "44 — 1ère prémolaire inf. droite"
    D45 = "45", "45 — 2ème prémolaire inf. droite"
    D46 = "46", "46 — 1ère molaire inf. droite"
    D47 = "47", "47 — 2ème molaire inf. droite"
    D48 = "48", "48 — 3ème molaire inf. droite (sagesse)"
    # Dents lactéales
    D51 = "51", "51 — Incisive centrale sup. droite (lact.)"
    D52 = "52", "52 — Incisive latérale sup. droite (lact.)"
    D53 = "53", "53 — Canine sup. droite (lact.)"
    D54 = "54", "54 — 1ère molaire sup. droite (lact.)"
    D55 = "55", "55 — 2ème molaire sup. droite (lact.)"
    D61 = "61", "61 — Incisive centrale sup. gauche (lact.)"
    D62 = "62", "62 — Incisive latérale sup. gauche (lact.)"
    D63 = "63", "63 — Canine sup. gauche (lact.)"
    D64 = "64", "64 — 1ère molaire sup. gauche (lact.)"
    D65 = "65", "65 — 2ème molaire sup. gauche (lact.)"
    D71 = "71", "71 — Incisive centrale inf. gauche (lact.)"
    D72 = "72", "72 — Incisive latérale inf. gauche (lact.)"
    D73 = "73", "73 — Canine inf. gauche (lact.)"
    D74 = "74", "74 — 1ère molaire inf. gauche (lact.)"
    D75 = "75", "75 — 2ème molaire inf. gauche (lact.)"
    D81 = "81", "81 — Incisive centrale inf. droite (lact.)"
    D82 = "82", "82 — Incisive latérale inf. droite (lact.)"
    D83 = "83", "83 — Canine inf. droite (lact.)"
    D84 = "84", "84 — 1ère molaire inf. droite (lact.)"
    D85 = "85", "85 — 2ème molaire inf. droite (lact.)"
    # Générique
    PLUSIEURS   = "PLUSIEURS",   "Plusieurs dents"
    ARCADE_SUP  = "ARCADE_SUP",  "Arcade supérieure complète"
    ARCADE_INF  = "ARCADE_INF",  "Arcade inférieure complète"
    TOUTES      = "TOUTES",      "Toutes les dents"
    NON_PRECISE = "NON_PRECISE", "Non précisé"


# ══════════════════════════════════════════════════════════════════════════════
# QUERYSETS & MANAGERS
# ══════════════════════════════════════════════════════════════════════════════

class TraitementQuerySet(models.QuerySet):

    def actifs(self):
        return self.filter(is_active=True)

    def du_dentiste(self, dentiste_id):
        return self.filter(dentiste_id=dentiste_id, is_active=True)

    def du_patient(self, patient_id):
        return self.filter(patient_id=patient_id, is_active=True)

    def en_cours(self):
        return self.filter(statut=StatutTraitement.EN_COURS, is_active=True)

    def termines(self):
        return self.filter(statut=StatutTraitement.TERMINE, is_active=True)

    def planifies(self):
        return self.filter(statut=StatutTraitement.PLANIFIE, is_active=True)

    def par_type_acte(self, type_acte: str):
        return self.filter(type_acte=type_acte, is_active=True)

    def par_dent(self, numero_dent: str):
        return self.filter(dent=numero_dent, is_active=True)

    def ce_mois(self):
        now = timezone.now()
        return self.filter(
            date_debut__year=now.year,
            date_debut__month=now.month,
            is_active=True,
        )

    def avec_cout(self):
        """Traitements ayant un coût renseigné (> 0)."""
        return self.filter(cout_total__gt=0, is_active=True)


class TraitementManager(models.Manager):
    def get_queryset(self):
        return TraitementQuerySet(self.model, using=self._db)

    def actifs(self):             return self.get_queryset().actifs()
    def du_dentiste(self, did):   return self.get_queryset().du_dentiste(did)
    def du_patient(self, pid):    return self.get_queryset().du_patient(pid)
    def en_cours(self):           return self.get_queryset().en_cours()
    def termines(self):           return self.get_queryset().termines()
    def planifies(self):          return self.get_queryset().planifies()
    def ce_mois(self):            return self.get_queryset().ce_mois()


class AllTraitementsManager(models.Manager):
    """Manager sans filtre — accès à tous (actifs + archivés)."""
    def get_queryset(self):
        return TraitementQuerySet(self.model, using=self._db)


# ══════════════════════════════════════════════════════════════════════════════
# MODÈLE PRINCIPAL : Traitement
# ══════════════════════════════════════════════════════════════════════════════

class Traitement(models.Model):
    """
    Représente un traitement dentaire effectué sur un patient.

    Un traitement peut être :
      - Mono-séance  : extraction, obturation simple → terminé en une visite
      - Multi-séances: traitement de canal, orthodontie → plusieurs SeanceSoin

    Checklist couverte :
      T-01 — Ajout, suivi et historique médical complet
      D-08 — Visible dans le dossier patient agrégé
    """

    # ── PK UUID ───────────────────────────────────────────────────────
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
        verbose_name="Identifiant unique",
    )

    # ── Relations ─────────────────────────────────────────────────────
    patient = models.ForeignKey(
        Patient,
        on_delete=models.CASCADE,
        related_name="treatments",
        verbose_name="Patient",
    )
    dentiste_id = models.UUIDField(
        verbose_name="UUID du dentiste",
        db_index=True,
    )

    # ── Acte dentaire ─────────────────────────────────────────────────
    type_acte = models.CharField(
        max_length=30,
        choices=TypeActe.choices,
        default=TypeActe.CONSULTATION,
        verbose_name="Type d'acte",
        db_index=True,
    )
    description = models.TextField(
        blank=True,
        verbose_name="Description détaillée",
        help_text="Détails cliniques de l'acte, technique utilisée, observations.",
    )

    # ── Localisation dentaire (notation FDI) ──────────────────────────
    dent = models.CharField(
        max_length=15,
        choices=NumeroDent.choices,
        default=NumeroDent.NON_PRECISE,
        verbose_name="Dent traitée (FDI)",
        db_index=True,
    )
    face_dentaire = models.CharField(
        max_length=50,
        blank=True,
        verbose_name="Face(s) dentaire(s)",
        help_text="Ex : mésiale, distale, occlusale, vestibulaire, linguale",
    )

    # ── Matériau utilisé ──────────────────────────────────────────────
    materiau = models.CharField(
        max_length=25,
        choices=Materiau.choices,
        default=Materiau.NON_APPLICABLE,
        verbose_name="Matériau utilisé",
    )
    materiau_detail = models.CharField(
        max_length=200,
        blank=True,
        verbose_name="Détail matériau",
        help_text="Marque, teinte, référence produit, etc.",
    )

    # ── Planification et durée ────────────────────────────────────────
    date_debut = models.DateField(
        verbose_name="Date de début du traitement",
        db_index=True,
    )
    date_fin = models.DateField(
        null=True,
        blank=True,
        verbose_name="Date de fin (si terminé)",
    )
    duree_estimee_minutes = models.PositiveIntegerField(
        null=True,
        blank=True,
        validators=[MinValueValidator(5)],
        verbose_name="Durée estimée (minutes)",
    )
    nombre_seances_prevues = models.PositiveIntegerField(
        default=1,
        validators=[MinValueValidator(1), MaxValueValidator(50)],
        verbose_name="Nombre de séances prévues",
    )

    # ── Statut du traitement ──────────────────────────────────────────
    statut = models.CharField(
        max_length=15,
        choices=StatutTraitement.choices,
        default=StatutTraitement.PLANIFIE,
        verbose_name="Statut du traitement",
        db_index=True,
    )
    raison_abandon = models.TextField(
        blank=True,
        verbose_name="Raison d'abandon",
        help_text="Rempli si statut = ABANDONNE.",
    )

    # ── Coût et facturation ───────────────────────────────────────────
    cout_total = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)],
        verbose_name="Coût total (DZD)",
    )
    cout_patient = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)],
        verbose_name="Part patient (DZD)",
        help_text="Montant restant à la charge du patient après mutuelle.",
    )
    est_couvert_mutuelle = models.BooleanField(
        default=False,
        verbose_name="Couvert par mutuelle",
    )
    reference_mutuelle = models.CharField(
        max_length=100,
        blank=True,
        verbose_name="Référence / N° accord mutuelle",
    )

    # ── Anesthésie ────────────────────────────────────────────────────
    anesthesie_utilisee = models.BooleanField(
        default=False,
        verbose_name="Anesthésie utilisée",
    )
    type_anesthesie = models.CharField(
        max_length=100,
        blank=True,
        verbose_name="Type d'anesthésie",
        help_text="Ex : Lidocaïne 2%, bloc nerveux, anesthésie locale",
    )

    # ── Notes cliniques ────────────────────────────────────────────────
    notes_pre_op = models.TextField(
        blank=True,
        verbose_name="Notes pré-opératoires",
        help_text="Observations avant l'acte, consentement, état initial.",
    )
    notes_per_op = models.TextField(
        blank=True,
        verbose_name="Notes per-opératoires",
        help_text="Observations pendant l'acte, incidents, technique.",
    )
    notes_post_op = models.TextField(
        blank=True,
        verbose_name="Notes post-opératoires",
        help_text="Consignes données, cicatrisation prévue, suites.",
    )
    instructions_patient = models.TextField(
        blank=True,
        verbose_name="Instructions pour le patient",
        help_text="Ce que le patient doit faire/éviter après le traitement.",
    )

    # ── Lien avec un rendez-vous ──────────────────────────────────────
    rendezvous = models.ForeignKey(
        "rendezvous.RendezVous",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="treatments",
        verbose_name="Rendez-vous associé",
    )

    # ── Soft delete ───────────────────────────────────────────────────
    is_active   = models.BooleanField(default=True, db_index=True)
    deleted_at  = models.DateTimeField(null=True, blank=True)
    deleted_by  = models.UUIDField(null=True, blank=True)

    # ── Timestamps ────────────────────────────────────────────────────
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    # ── Managers ──────────────────────────────────────────────────────
    objects     = TraitementManager()
    all_objects = AllTraitementsManager()

    class Meta:
        verbose_name        = "Traitement"
        verbose_name_plural = "Traitements"
        ordering            = ["-date_debut", "-created_at"]
        indexes = [
            models.Index(fields=["dentiste_id", "is_active"]),
            models.Index(fields=["patient",     "is_active"]),
            models.Index(fields=["statut",      "is_active"]),
            models.Index(fields=["type_acte",   "is_active"]),
            models.Index(fields=["dent",        "is_active"]),
            models.Index(fields=["date_debut"]),
        ]

    def __str__(self) -> str:
        return (
            f"{self.get_type_acte_display()} — "
            f"dent {self.dent} — "
            f"{self.patient} "
            f"[{self.get_statut_display()}]"
        )

    # ── Propriétés calculées ──────────────────────────────────────────

    @property
    def duree_traitement_jours(self) -> int | None:
        """Nombre de jours entre début et fin (si terminé)."""
        if self.date_fin and self.date_debut:
            return (self.date_fin - self.date_debut).days
        return None

    @property
    def est_multi_seances(self) -> bool:
        return self.nombre_seances_prevues > 1

    @property
    def nombre_seances_realisees(self) -> int:
        """Nombre de séances déjà effectuées (calcul depuis SeanceSoin)."""
        return self.seances.filter(is_active=True).count()

    @property
    def progression(self) -> int:
        """Pourcentage de progression (0-100) basé sur les séances."""
        if self.nombre_seances_prevues <= 0:
            return 100 if self.statut == StatutTraitement.TERMINE else 0
        realisees = self.nombre_seances_realisees
        return min(100, round((realisees / self.nombre_seances_prevues) * 100))

    @property
    def part_mutuelle(self):
        """Montant pris en charge par la mutuelle."""
        return self.cout_total - self.cout_patient

    # ── Méthodes métier ───────────────────────────────────────────────

    def demarrer(self) -> None:
        """Passer de PLANIFIE → EN_COURS."""
        if self.statut == StatutTraitement.PLANIFIE:
            self.statut = StatutTraitement.EN_COURS
            self.save(update_fields=["statut", "updated_at"])

    def terminer(self) -> None:
        """Marquer le traitement comme terminé."""
        self.statut   = StatutTraitement.TERMINE
        self.date_fin = timezone.now().date()
        self.save(update_fields=["statut", "date_fin", "updated_at"])

    def abandonner(self, raison: str = "") -> None:
        """Marquer le traitement comme abandonné."""
        self.statut         = StatutTraitement.ABANDONNE
        self.raison_abandon = raison.strip()
        self.save(update_fields=["statut", "raison_abandon", "updated_at"])

    def supprimer(self, deleted_by_id) -> None:
        """Soft delete du traitement."""
        if not self.is_active:
            return
        self.is_active  = False
        self.deleted_at = timezone.now()
        self.deleted_by = deleted_by_id
        self.save(update_fields=["is_active", "deleted_at", "deleted_by", "updated_at"])

    def restaurer(self) -> None:
        """Restaurer un traitement supprimé."""
        if self.is_active:
            return
        self.is_active  = True
        self.deleted_at = None
        self.deleted_by = None
        self.save(update_fields=["is_active", "deleted_at", "deleted_by", "updated_at"])


# ══════════════════════════════════════════════════════════════════════════════
# MODÈLE SECONDAIRE : SeanceSoin
# ══════════════════════════════════════════════════════════════════════════════

class SeanceSoin(models.Model):
    """
    Sous-séance d'un traitement multi-visites.

    Exemple : traitement de canal = 3 séances
      Séance 1 → Mise en forme canalaire
      Séance 2 → Désinfection / mise en place hydroxyde
      Séance 3 → Obturation canalaire définitive

    Utilisé pour :
      - Suivre la progression d'un traitement multi-séances
      - Historique détaillé par visite
    """

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    traitement = models.ForeignKey(
        Traitement,
        on_delete=models.CASCADE,
        related_name="seances",
        verbose_name="Traitement",
    )

    numero_seance = models.PositiveIntegerField(
        verbose_name="N° de séance",
        validators=[MinValueValidator(1)],
    )
    date         = models.DateField(verbose_name="Date de la séance")
    duree_minutes = models.PositiveIntegerField(
        default=30,
        validators=[MinValueValidator(5)],
        verbose_name="Durée (minutes)",
    )

    acte_realise = models.TextField(
        verbose_name="Acte réalisé lors de cette séance",
    )
    observations = models.TextField(
        blank=True,
        verbose_name="Observations cliniques",
    )
    prochain_rdv_notes = models.TextField(
        blank=True,
        verbose_name="Notes pour le prochain rendez-vous",
    )

    # Lien RDV optionnel
    rendezvous = models.ForeignKey(
        "rendezvous.RendezVous",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="seances_soin",
        verbose_name="Rendez-vous associé",
    )

    is_active  = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name        = "Séance de soin"
        verbose_name_plural = "Séances de soin"
        ordering            = ["traitement", "numero_seance"]
        unique_together     = [["traitement", "numero_seance"]]
        indexes = [
            models.Index(fields=["traitement", "is_active"]),
            models.Index(fields=["date"]),
        ]

    def __str__(self) -> str:
        return f"Séance {self.numero_seance} — {self.traitement}"