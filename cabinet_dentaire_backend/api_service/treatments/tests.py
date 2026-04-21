"""
treatments/tests.py — api_service
=====================================
Tests unitaires et d'intégration pour l'app treatments.

Même architecture que patients/tests.py :
  - Pas d'appel réseau (pas de RabbitMQ ici)
  - request.user = RemoteUser injecté via force_authenticate()
  - Couvre tous les rôles et tous les endpoints

Structure :
  TraitementModelTests        → modèle, propriétés, méthodes métier, managers
  TraitementSerializerTests   → validation serializers
  TraitementPermissionTests   → accès par rôle
  TraitementCRUDTests         → CRUD complet vue dentiste
  TraitementAdminTests        → CRUD vue admin
  TraitementReceptionisteTests→ lecture seule réceptionniste
  TraitementStatutTests       → actions demarrer/terminer/abandonner
  SeanceSoinTests             → création et gestion des séances
  TraitementStatsTests        → statistiques tableau de bord
  TraitementFiltresTests      → filtres, recherche, tri
  TraitementParPatientTests   → endpoint par-patient (dossier)
  TraitementParDentTests      → endpoint par-dent (dental chart)
"""

import uuid
from datetime import date, timedelta
from decimal import Decimal

from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from config.authentication import RemoteUser
from patients.models import Patient
from treatments.models import (
    Traitement,
    SeanceSoin,
    StatutTraitement,
    TypeActe,
    Materiau,
    NumeroDent,
)

# ══════════════════════════════════════════════════════════════════════════════
# HELPERS
# ══════════════════════════════════════════════════════════════════════════════

UUID_DENTISTE_1 = str(uuid.UUID("11111111-1111-1111-1111-111111111111"))
UUID_DENTISTE_2 = str(uuid.UUID("22222222-2222-2222-2222-222222222222"))
UUID_ADMIN      = str(uuid.UUID("33333333-3333-3333-3333-333333333333"))
UUID_RECEP      = str(uuid.UUID("44444444-4444-4444-4444-444444444444"))


def make_remote_user(role: str, user_id: str = None) -> RemoteUser:
    uid = user_id or str(uuid.uuid4())
    return RemoteUser({
        "id":        uid,
        "user_id":   uid,
        "email":     f"{role}@cabinet.dz",
        "full_name": f"Test {role.capitalize()}",
        "role":      role,
        "is_active": True,
    })


def make_client(role: str, user_id: str = None) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=make_remote_user(role, user_id))
    return client


def make_patient(dentiste_id: str = None, **kwargs) -> Patient:
    did = uuid.UUID(dentiste_id) if dentiste_id else uuid.UUID(UUID_DENTISTE_1)
    defaults = {
        "nom":            "BENALI",
        "prenom":         "Karim",
        "date_naissance": date(1990, 5, 15),
        "telephone":      "0551234567",
        "dentiste_id":    did,
    }
    defaults.update(kwargs)
    return Patient.objects.create(**defaults)


def make_traitement(patient=None, dentiste_id: str = None, **kwargs) -> Traitement:
    did = uuid.UUID(dentiste_id) if dentiste_id else uuid.UUID(UUID_DENTISTE_1)
    p   = patient or make_patient(dentiste_id=str(did))
    defaults = {
        "patient":     p,
        "dentiste_id": did,
        "type_acte":   TypeActe.EXTRACTION_SIMPLE,
        "dent":        NumeroDent.D36,
        "materiau":    Materiau.NON_APPLICABLE,
        "date_debut":  date.today() - timedelta(days=5),
        "statut":      StatutTraitement.PLANIFIE,
        "cout_total":  Decimal("5000.00"),
        "cout_patient": Decimal("2000.00"),
    }
    defaults.update(kwargs)
    return Traitement.objects.create(**defaults)


def traitement_data(patient_id: str, **kwargs) -> dict:
    defaults = {
        "patient":               patient_id,
        "type_acte":             TypeActe.OBTURATION,
        "dent":                  NumeroDent.D16,
        "materiau":              Materiau.COMPOSITE,
        "date_debut":            str(date.today()),
        "nombre_seances_prevues": 1,
        "cout_total":            "3000.00",
        "cout_patient":          "1500.00",
        "description":           "Obturation composite face mésiale",
        "anesthesie_utilisee":   True,
        "type_anesthesie":       "Lidocaïne 2%",
    }
    defaults.update(kwargs)
    return defaults


# ══════════════════════════════════════════════════════════════════════════════
# 1. TESTS MODÈLE
# ══════════════════════════════════════════════════════════════════════════════

class TraitementModelTests(TestCase):

    def setUp(self):
        self.patient    = make_patient()
        self.traitement = make_traitement(patient=self.patient)

    # ── Propriétés ────────────────────────────────────────────────────

    def test_str_representation(self):
        s = str(self.traitement)
        self.assertIn("Extraction", s)
        self.assertIn("36", s)

    def test_est_multi_seances_false(self):
        self.assertFalse(self.traitement.est_multi_seances)

    def test_est_multi_seances_true(self):
        self.traitement.nombre_seances_prevues = 3
        self.assertTrue(self.traitement.est_multi_seances)

    def test_progression_zero_sans_seances(self):
        self.assertEqual(self.traitement.progression, 0)

    def test_progression_cent_quand_termine(self):
        self.traitement.statut = StatutTraitement.TERMINE
        self.traitement.nombre_seances_prevues = 0
        self.assertEqual(self.traitement.progression, 100)

    def test_nombre_seances_realisees(self):
        SeanceSoin.objects.create(
            traitement=self.traitement,
            numero_seance=1,
            date=date.today(),
            duree_minutes=30,
            acte_realise="Extraction réalisée",
        )
        self.assertEqual(self.traitement.nombre_seances_realisees, 1)

    def test_part_mutuelle_calculee(self):
        self.assertEqual(
            self.traitement.part_mutuelle,
            Decimal("3000.00"),  # 5000 - 2000
        )

    def test_duree_traitement_jours_none_si_pas_fin(self):
        self.assertIsNone(self.traitement.duree_traitement_jours)

    def test_duree_traitement_jours_calcule(self):
        self.traitement.date_fin = date.today()
        jours = self.traitement.duree_traitement_jours
        self.assertGreaterEqual(jours, 5)

    # ── Méthodes métier ───────────────────────────────────────────────

    def test_demarrer(self):
        self.traitement.demarrer()
        self.assertEqual(self.traitement.statut, StatutTraitement.EN_COURS)

    def test_demarrer_ne_fait_rien_si_deja_en_cours(self):
        self.traitement.statut = StatutTraitement.EN_COURS
        self.traitement.save()
        self.traitement.demarrer()
        self.assertEqual(self.traitement.statut, StatutTraitement.EN_COURS)

    def test_terminer(self):
        self.traitement.terminer()
        self.traitement.refresh_from_db()
        self.assertEqual(self.traitement.statut, StatutTraitement.TERMINE)
        self.assertEqual(self.traitement.date_fin, date.today())

    def test_abandonner(self):
        self.traitement.abandonner(raison="Patient non coopératif")
        self.traitement.refresh_from_db()
        self.assertEqual(self.traitement.statut,        StatutTraitement.ABANDONNE)
        self.assertEqual(self.traitement.raison_abandon, "Patient non coopératif")

    def test_supprimer_soft_delete(self):
        uid = uuid.UUID(UUID_ADMIN)
        self.traitement.supprimer(deleted_by_id=uid)
        self.traitement.refresh_from_db()
        self.assertFalse(self.traitement.is_active)
        self.assertIsNotNone(self.traitement.deleted_at)
        self.assertEqual(self.traitement.deleted_by, uid)

    def test_restaurer(self):
        self.traitement.supprimer(deleted_by_id=uuid.UUID(UUID_ADMIN))
        self.traitement.restaurer()
        self.traitement.refresh_from_db()
        self.assertTrue(self.traitement.is_active)
        self.assertIsNone(self.traitement.deleted_at)

    # ── Managers ─────────────────────────────────────────────────────

    def test_manager_actifs(self):
        self.traitement.supprimer(deleted_by_id=uuid.UUID(UUID_ADMIN))
        qs = Traitement.objects.actifs()
        self.assertNotIn(self.traitement, qs)

    def test_manager_du_dentiste(self):
        make_traitement(dentiste_id=UUID_DENTISTE_2)
        qs = Traitement.objects.du_dentiste(uuid.UUID(UUID_DENTISTE_1))
        self.assertTrue(all(
            str(t.dentiste_id) == UUID_DENTISTE_1 for t in qs
        ))

    def test_manager_du_patient(self):
        autre_patient = make_patient()
        make_traitement(patient=autre_patient)
        qs = Traitement.objects.du_patient(self.patient.pk)
        self.assertTrue(all(t.patient_id == self.patient.pk for t in qs))

    def test_manager_en_cours(self):
        self.traitement.statut = StatutTraitement.EN_COURS
        self.traitement.save()
        qs = Traitement.objects.en_cours()
        self.assertIn(self.traitement, qs)

    def test_all_objects_inclut_supprimes(self):
        self.traitement.supprimer(deleted_by_id=uuid.UUID(UUID_ADMIN))
        self.assertIn(self.traitement, Traitement.all_objects.all())
        self.assertNotIn(self.traitement, Traitement.objects.actifs())


# ══════════════════════════════════════════════════════════════════════════════
# 2. TESTS SERIALIZERS
# ══════════════════════════════════════════════════════════════════════════════

class TraitementSerializerTests(TestCase):

    def setUp(self):
        self.patient = make_patient()

    def test_cout_patient_superieur_cout_total_invalide(self):
        from treatments.serializers import TraitementCreateSerializer
        data = traitement_data(
            str(self.patient.pk),
            cout_total="1000.00",
            cout_patient="2000.00",
        )
        s = TraitementCreateSerializer(data=data)
        self.assertFalse(s.is_valid())
        self.assertIn("cout_patient", s.errors)

    def test_date_fin_avant_date_debut_invalide(self):
        from treatments.serializers import TraitementCreateSerializer
        data = traitement_data(
            str(self.patient.pk),
            date_debut=str(date.today()),
            date_fin=str(date.today() - timedelta(days=5)),
        )
        s = TraitementCreateSerializer(data=data)
        self.assertFalse(s.is_valid())
        self.assertIn("date_fin", s.errors)

    def test_patient_archive_invalide(self):
        from treatments.serializers import TraitementCreateSerializer
        self.patient.is_active = False
        self.patient.save()
        data = traitement_data(str(self.patient.pk))
        s    = TraitementCreateSerializer(data=data)
        self.assertFalse(s.is_valid())
        self.assertIn("patient", s.errors)

    def test_abandonner_sans_raison_invalide(self):
        from treatments.serializers import TraitementAbandonnerSerializer
        s = TraitementAbandonnerSerializer(data={"raison_abandon": ""})
        self.assertFalse(s.is_valid())

    def test_abandonner_raison_trop_courte_invalide(self):
        from treatments.serializers import TraitementAbandonnerSerializer
        s = TraitementAbandonnerSerializer(data={"raison_abandon": "ok"})
        self.assertFalse(s.is_valid())

    def test_seance_date_future_invalide(self):
        from treatments.serializers import SeanceSoinCreateSerializer
        traitement = make_traitement(patient=self.patient)
        s = SeanceSoinCreateSerializer(
            data={
                "numero_seance": 1,
                "date":          str(date.today() + timedelta(days=1)),
                "duree_minutes": 30,
                "acte_realise":  "Test",
            },
            context={"traitement": traitement},
        )
        self.assertFalse(s.is_valid())
        self.assertIn("date", s.errors)

    def test_seance_numero_superieur_nb_seances_prevues_invalide(self):
        from treatments.serializers import SeanceSoinCreateSerializer
        traitement = make_traitement(patient=self.patient, nombre_seances_prevues=2)
        s = SeanceSoinCreateSerializer(
            data={
                "numero_seance": 5,
                "date":          str(date.today()),
                "duree_minutes": 30,
                "acte_realise":  "Test",
            },
            context={"traitement": traitement},
        )
        self.assertFalse(s.is_valid())
        self.assertIn("numero_seance", s.errors)


# ══════════════════════════════════════════════════════════════════════════════
# 3. TESTS PERMISSIONS
# ══════════════════════════════════════════════════════════════════════════════

class TraitementPermissionTests(TestCase):

    def setUp(self):
        self.patient    = make_patient(dentiste_id=UUID_DENTISTE_1)
        self.traitement = make_traitement(patient=self.patient, dentiste_id=UUID_DENTISTE_1)
        self.url_list   = reverse("treatment-list")
        self.url_detail = reverse("treatment-detail", args=[self.traitement.pk])

    def test_anonymous_denied(self):
        resp = APIClient().get(self.url_list)
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_dentiste_proprietaire_acces_detail(self):
        resp = make_client("dentiste", UUID_DENTISTE_1).get(self.url_detail)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def test_autre_dentiste_ne_voit_pas_traitement(self):
        resp = make_client("dentiste", UUID_DENTISTE_2).get(self.url_detail)
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

    def test_admin_voit_tous_les_traitements(self):
        make_traitement(dentiste_id=UUID_DENTISTE_2)
        resp = make_client("admin", UUID_ADMIN).get(self.url_list)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(resp.data["count"], 2)

    def test_receptioniste_lecture_seule(self):
        resp = make_client("receptionniste", UUID_RECEP).get(self.url_list)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def test_receptioniste_ne_peut_pas_creer(self):
        patient = make_patient(dentiste_id=UUID_DENTISTE_1)
        resp    = make_client("receptionniste", UUID_RECEP).post(
            self.url_list,
            traitement_data(str(patient.pk)),
        )
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_receptioniste_ne_peut_pas_modifier(self):
        resp = make_client("receptionniste", UUID_RECEP).patch(
            self.url_detail, {"description": "test"}
        )
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)


# ══════════════════════════════════════════════════════════════════════════════
# 4. CRUD — DENTISTE
# ══════════════════════════════════════════════════════════════════════════════

class TraitementCRUDTests(TestCase):

    def setUp(self):
        self.client     = make_client("dentiste", UUID_DENTISTE_1)
        self.patient    = make_patient(dentiste_id=UUID_DENTISTE_1)
        self.traitement = make_traitement(patient=self.patient, dentiste_id=UUID_DENTISTE_1)

    def test_liste_seulement_ses_traitements(self):
        make_traitement(dentiste_id=UUID_DENTISTE_2)
        resp = self.client.get(reverse("treatment-list"))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        ids = [t["id"] for t in resp.data["results"]]
        self.assertIn(str(self.traitement.pk), ids)
        autre = Traitement.objects.filter(dentiste_id=UUID_DENTISTE_2).first()
        self.assertNotIn(str(autre.pk), ids)

    def test_creer_traitement(self):
        resp = self.client.post(
            reverse("treatment-list"),
            traitement_data(str(self.patient.pk)),
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        t = Traitement.objects.get(pk=resp.data["id"])
        self.assertEqual(str(t.dentiste_id), UUID_DENTISTE_1)

    def test_creer_pour_patient_dautrui_interdit(self):
        autre_patient = make_patient(dentiste_id=UUID_DENTISTE_2)
        resp = self.client.post(
            reverse("treatment-list"),
            traitement_data(str(autre_patient.pk)),
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_detail_complet(self):
        url  = reverse("treatment-detail", args=[self.traitement.pk])
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        for champ in (
            "id", "patient", "type_acte", "dent", "materiau",
            "statut", "cout_total", "seances", "progression",
            "notes_pre_op", "notes_per_op", "notes_post_op",
        ):
            self.assertIn(champ, resp.data)

    def test_modifier_traitement(self):
        url  = reverse("treatment-detail", args=[self.traitement.pk])
        resp = self.client.patch(url, {
            "description":    "Extraction réalisée sans complications",
            "notes_post_op":  "Garder la compresse 30 min",
        })
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.traitement.refresh_from_db()
        self.assertEqual(
            self.traitement.notes_post_op, "Garder la compresse 30 min"
        )

    def test_supprimer_soft_delete(self):
        url  = reverse("treatment-detail", args=[self.traitement.pk])
        resp = self.client.delete(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.traitement.refresh_from_db()
        self.assertFalse(self.traitement.is_active)


# ══════════════════════════════════════════════════════════════════════════════
# 5. CRUD — ADMIN
# ══════════════════════════════════════════════════════════════════════════════

class TraitementAdminTests(TestCase):

    def setUp(self):
        self.client  = make_client("admin", UUID_ADMIN)
        self.patient = make_patient(dentiste_id=UUID_DENTISTE_1)

    def test_admin_cree_traitement_dentiste_id_du_patient(self):
        resp = self.client.post(
            reverse("treatment-list"),
            traitement_data(str(self.patient.pk)),
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        t = Traitement.objects.get(pk=resp.data["id"])
        self.assertEqual(str(t.dentiste_id), UUID_DENTISTE_1)

    def test_admin_voit_traitements_de_tous_dentistes(self):
        make_traitement(dentiste_id=UUID_DENTISTE_1)
        make_traitement(dentiste_id=UUID_DENTISTE_2)
        resp = self.client.get(reverse("treatment-list"))
        self.assertGreaterEqual(resp.data["count"], 2)

    def test_admin_peut_supprimer_nimporte_quel_traitement(self):
        t    = make_traitement(dentiste_id=UUID_DENTISTE_2)
        url  = reverse("treatment-detail", args=[t.pk])
        resp = self.client.delete(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)


# ══════════════════════════════════════════════════════════════════════════════
# 6. RÉCEPTIONNISTE — LECTURE SEULE
# ══════════════════════════════════════════════════════════════════════════════

class TraitementReceptionisteTests(TestCase):

    def setUp(self):
        self.client     = make_client("receptionniste", UUID_RECEP)
        self.patient    = make_patient(dentiste_id=UUID_DENTISTE_1)
        self.traitement = make_traitement(patient=self.patient, dentiste_id=UUID_DENTISTE_1)

    def test_peut_lire_liste(self):
        resp = self.client.get(reverse("treatment-list"))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def test_peut_lire_detail(self):
        url  = reverse("treatment-detail", args=[self.traitement.pk])
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def test_ne_peut_pas_creer(self):
        resp = self.client.post(
            reverse("treatment-list"),
            traitement_data(str(self.patient.pk)),
        )
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_ne_peut_pas_supprimer(self):
        url  = reverse("treatment-detail", args=[self.traitement.pk])
        resp = self.client.delete(url)
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_ne_peut_pas_demarrer(self):
        url  = reverse("treatment-demarrer", args=[self.traitement.pk])
        resp = self.client.patch(url)
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)


# ══════════════════════════════════════════════════════════════════════════════
# 7. ACTIONS STATUT
# ══════════════════════════════════════════════════════════════════════════════

class TraitementStatutTests(TestCase):

    def setUp(self):
        self.client     = make_client("dentiste", UUID_DENTISTE_1)
        self.patient    = make_patient(dentiste_id=UUID_DENTISTE_1)
        self.traitement = make_traitement(
            patient=self.patient,
            dentiste_id=UUID_DENTISTE_1,
            statut=StatutTraitement.PLANIFIE,
        )

    def test_demarrer(self):
        url  = reverse("treatment-demarrer", args=[self.traitement.pk])
        resp = self.client.patch(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.traitement.refresh_from_db()
        self.assertEqual(self.traitement.statut, StatutTraitement.EN_COURS)

    def test_demarrer_deja_en_cours_retourne_400(self):
        self.traitement.statut = StatutTraitement.EN_COURS
        self.traitement.save()
        url  = reverse("treatment-demarrer", args=[self.traitement.pk])
        resp = self.client.patch(url)
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_terminer(self):
        self.traitement.statut = StatutTraitement.EN_COURS
        self.traitement.save()
        url  = reverse("treatment-terminer", args=[self.traitement.pk])
        resp = self.client.patch(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.traitement.refresh_from_db()
        self.assertEqual(self.traitement.statut,  StatutTraitement.TERMINE)
        self.assertEqual(self.traitement.date_fin, date.today())

    def test_terminer_deja_termine_retourne_400(self):
        self.traitement.statut = StatutTraitement.TERMINE
        self.traitement.save()
        url  = reverse("treatment-terminer", args=[self.traitement.pk])
        resp = self.client.patch(url)
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_abandonner_avec_raison(self):
        url  = reverse("treatment-abandonner", args=[self.traitement.pk])
        resp = self.client.patch(url, {"raison_abandon": "Patient a changé de dentiste"})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.traitement.refresh_from_db()
        self.assertEqual(self.traitement.statut,        StatutTraitement.ABANDONNE)
        self.assertEqual(self.traitement.raison_abandon, "Patient a changé de dentiste")

    def test_abandonner_sans_raison_retourne_400(self):
        url  = reverse("treatment-abandonner", args=[self.traitement.pk])
        resp = self.client.patch(url, {"raison_abandon": ""})
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_abandonner_traitement_termine_retourne_400(self):
        self.traitement.statut = StatutTraitement.TERMINE
        self.traitement.save()
        url  = reverse("treatment-abandonner", args=[self.traitement.pk])
        resp = self.client.patch(url, {"raison_abandon": "Raison valide ici"})
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)


# ══════════════════════════════════════════════════════════════════════════════
# 8. SÉANCES
# ══════════════════════════════════════════════════════════════════════════════

class SeanceSoinTests(TestCase):

    def setUp(self):
        self.client     = make_client("dentiste", UUID_DENTISTE_1)
        self.patient    = make_patient(dentiste_id=UUID_DENTISTE_1)
        self.traitement = make_traitement(
            patient=self.patient,
            dentiste_id=UUID_DENTISTE_1,
            nombre_seances_prevues=3,
            statut=StatutTraitement.EN_COURS,
        )
        self.url_seances = reverse("treatment-seances", args=[self.traitement.pk])

    def test_liste_seances_vide(self):
        resp = self.client.get(self.url_seances)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data, [])

    def test_ajouter_seance(self):
        resp = self.client.post(self.url_seances, {
            "numero_seance": 1,
            "date":          str(date.today()),
            "duree_minutes": 45,
            "acte_realise":  "Mise en forme canalaire — limes K20 à K40",
            "observations":  "Patient coopératif, anesthésie efficace",
        })
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(SeanceSoin.objects.filter(traitement=self.traitement).count(), 1)

    def test_ajouter_seance_passe_traitement_en_cours(self):
        """Ajouter une séance à un traitement PLANIFIE → EN_COURS automatiquement."""
        traitement = make_traitement(
            patient=self.patient,
            dentiste_id=UUID_DENTISTE_1,
            statut=StatutTraitement.PLANIFIE,
            nombre_seances_prevues=2,
        )
        url  = reverse("treatment-seances", args=[traitement.pk])
        resp = self.client.post(url, {
            "numero_seance": 1,
            "date":          str(date.today()),
            "duree_minutes": 30,
            "acte_realise":  "Première séance",
        })
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        traitement.refresh_from_db()
        self.assertEqual(traitement.statut, StatutTraitement.EN_COURS)

    def test_seance_future_invalide(self):
        resp = self.client.post(self.url_seances, {
            "numero_seance": 1,
            "date":          str(date.today() + timedelta(days=1)),
            "duree_minutes": 30,
            "acte_realise":  "Acte futur",
        })
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_liste_seances_apres_ajout(self):
        SeanceSoin.objects.create(
            traitement=self.traitement,
            numero_seance=1,
            date=date.today(),
            duree_minutes=30,
            acte_realise="Séance test",
        )
        resp = self.client.get(self.url_seances)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(len(resp.data), 1)
        self.assertEqual(resp.data[0]["numero_seance"], 1)

    def test_receptioniste_ne_peut_pas_ajouter_seance(self):
        client = make_client("receptionniste", UUID_RECEP)
        resp   = client.post(self.url_seances, {
            "numero_seance": 1,
            "date":          str(date.today()),
            "duree_minutes": 30,
            "acte_realise":  "Test",
        })
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)


# ══════════════════════════════════════════════════════════════════════════════
# 9. STATISTIQUES
# ══════════════════════════════════════════════════════════════════════════════

class TraitementStatsTests(TestCase):

    def setUp(self):
        self.client  = make_client("dentiste", UUID_DENTISTE_1)
        self.patient = make_patient(dentiste_id=UUID_DENTISTE_1)
        make_traitement(patient=self.patient, dentiste_id=UUID_DENTISTE_1,
                        statut=StatutTraitement.PLANIFIE,  cout_total=Decimal("3000"))
        make_traitement(patient=self.patient, dentiste_id=UUID_DENTISTE_1,
                        statut=StatutTraitement.EN_COURS,  cout_total=Decimal("5000"))
        make_traitement(patient=self.patient, dentiste_id=UUID_DENTISTE_1,
                        statut=StatutTraitement.TERMINE,   cout_total=Decimal("8000"))
        make_traitement(patient=self.patient, dentiste_id=UUID_DENTISTE_1,
                        statut=StatutTraitement.ABANDONNE, cout_total=Decimal("1000"))

    def test_stats_champs_presents(self):
        resp = self.client.get(reverse("treatment-stats"))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        for champ in (
            "total", "planifies", "en_cours", "termines",
            "abandonnes", "ce_mois", "chiffre_affaires", "actes_frequents",
        ):
            self.assertIn(champ, resp.data)

    def test_stats_compteurs_corrects(self):
        resp = self.client.get(reverse("treatment-stats"))
        self.assertEqual(resp.data["planifies"],  1)
        self.assertEqual(resp.data["en_cours"],   1)
        self.assertEqual(resp.data["termines"],   1)
        self.assertEqual(resp.data["abandonnes"], 1)
        self.assertEqual(resp.data["total"],      4)

    def test_chiffre_affaires_seulement_termines(self):
        resp = self.client.get(reverse("treatment-stats"))
        # Seul le traitement TERMINE (8000) compte
        self.assertEqual(Decimal(str(resp.data["chiffre_affaires"])), Decimal("8000.00"))


# ══════════════════════════════════════════════════════════════════════════════
# 10. FILTRES ET RECHERCHE
# ══════════════════════════════════════════════════════════════════════════════

class TraitementFiltresTests(TestCase):

    def setUp(self):
        self.client  = make_client("dentiste", UUID_DENTISTE_1)
        self.patient = make_patient(dentiste_id=UUID_DENTISTE_1)
        self.t1 = make_traitement(
            patient=self.patient, dentiste_id=UUID_DENTISTE_1,
            type_acte=TypeActe.EXTRACTION_SIMPLE,
            dent=NumeroDent.D36,
            statut=StatutTraitement.TERMINE,
        )
        self.t2 = make_traitement(
            patient=self.patient, dentiste_id=UUID_DENTISTE_1,
            type_acte=TypeActe.OBTURATION,
            dent=NumeroDent.D16,
            statut=StatutTraitement.EN_COURS,
        )

    def test_filtre_par_statut(self):
        resp = self.client.get(reverse("treatment-list") + "?statut=TERMINE")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        for t in resp.data["results"]:
            self.assertEqual(t["statut"], "TERMINE")

    def test_filtre_par_type_acte(self):
        resp = self.client.get(reverse("treatment-list") + "?type_acte=OBTURATION")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        for t in resp.data["results"]:
            self.assertEqual(t["type_acte"], "OBTURATION")

    def test_filtre_par_dent(self):
        resp = self.client.get(reverse("treatment-list") + "?dent=36")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        for t in resp.data["results"]:
            self.assertEqual(t["dent"], "36")

    def test_tri_par_date_debut_asc(self):
        resp = self.client.get(reverse("treatment-list") + "?ordering=date_debut")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        dates = [t["date_debut"] for t in resp.data["results"]]
        self.assertEqual(dates, sorted(dates))

    def test_tri_par_cout_desc(self):
        resp = self.client.get(reverse("treatment-list") + "?ordering=-cout_total")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        couts = [Decimal(t["cout_total"]) for t in resp.data["results"]]
        self.assertEqual(couts, sorted(couts, reverse=True))


# ══════════════════════════════════════════════════════════════════════════════
# 11. PAR PATIENT (dossier)
# ══════════════════════════════════════════════════════════════════════════════

class TraitementParPatientTests(TestCase):

    def setUp(self):
        self.client  = make_client("dentiste", UUID_DENTISTE_1)
        self.patient = make_patient(dentiste_id=UUID_DENTISTE_1)
        self.t1      = make_traitement(patient=self.patient, dentiste_id=UUID_DENTISTE_1)
        self.t2      = make_traitement(patient=self.patient, dentiste_id=UUID_DENTISTE_1)

    def test_par_patient_retourne_ses_traitements(self):
        url  = reverse("treatment-par-patient", args=[self.patient.pk])
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        ids  = [t["id"] for t in resp.data]
        self.assertIn(str(self.t1.pk), ids)
        self.assertIn(str(self.t2.pk), ids)

    def test_par_patient_uuid_invalide_retourne_400(self):
        url  = reverse("treatment-par-patient", args=["pas-un-uuid"])
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_par_patient_dautrui_retourne_404(self):
        autre_patient = make_patient(dentiste_id=UUID_DENTISTE_2)
        url  = reverse("treatment-par-patient", args=[autre_patient.pk])
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)


# ══════════════════════════════════════════════════════════════════════════════
# 12. PAR DENT (dental chart)
# ══════════════════════════════════════════════════════════════════════════════

class TraitementParDentTests(TestCase):

    def setUp(self):
        self.client  = make_client("dentiste", UUID_DENTISTE_1)
        self.patient = make_patient(dentiste_id=UUID_DENTISTE_1)
        make_traitement(patient=self.patient, dentiste_id=UUID_DENTISTE_1, dent=NumeroDent.D36)
        make_traitement(patient=self.patient, dentiste_id=UUID_DENTISTE_1, dent=NumeroDent.D36)
        make_traitement(patient=self.patient, dentiste_id=UUID_DENTISTE_1, dent=NumeroDent.D16)

    def test_par_dent_retourne_traitements_de_cette_dent(self):
        url  = reverse("treatment-par-dent", args=["36"])
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(len(resp.data), 2)
        for t in resp.data:
            self.assertEqual(t["dent"], "36")

    def test_par_dent_16_retourne_un_traitement(self):
        url  = reverse("treatment-par-dent", args=["16"])
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(len(resp.data), 1)