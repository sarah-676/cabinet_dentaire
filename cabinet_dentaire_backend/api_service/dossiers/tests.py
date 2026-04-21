"""
dossiers/tests.py — api_service
==================================
Tests pour le module dossier patient agrégé.

Structure :
  DossierListeTests     → GET /dossiers/ — liste résumée
  DossierDetailTests    → GET /dossiers/{id}/ — dossier complet
  DossierTimelineTests  → GET /dossiers/{id}/timeline/
  DossierPermissionTests → accès par rôle
"""

import uuid
from datetime import date, timedelta
from decimal import Decimal

from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from config.authentication import RemoteUser
from patients.models import Patient, StatutValidation
from rendezvous.models import RendezVous, StatutRDV, TypeSoin, PrioriteRDV
from radios.models import Radio, TypeRadio
from ordonnances.models import Ordonnance, LigneOrdonnance
from treatments.models import Traitement, StatutTraitement, TypeActe, NumeroDent, Materiau

# ══════════════════════════════════════════════════════════════════════════════
# HELPERS
# ══════════════════════════════════════════════════════════════════════════════

UUID_DENTISTE_1 = str(uuid.UUID("11111111-1111-1111-1111-111111111111"))
UUID_DENTISTE_2 = str(uuid.UUID("22222222-2222-2222-2222-222222222222"))
UUID_ADMIN      = str(uuid.UUID("33333333-3333-3333-3333-333333333333"))
UUID_RECEP      = str(uuid.UUID("44444444-4444-4444-4444-444444444444"))


def make_client(role: str, user_id: str = None) -> APIClient:
    uid    = user_id or str(uuid.uuid4())
    client = APIClient()
    client.force_authenticate(user=RemoteUser({
        "id": uid, "user_id": uid,
        "email": f"{role}@cabinet.dz",
        "full_name": f"Test {role}",
        "role": role, "is_active": True,
    }))
    return client


def make_patient(dentiste_id: str = UUID_DENTISTE_1, **kwargs) -> Patient:
    defaults = {
        "nom": "BENSAID", "prenom": "Omar",
        "date_naissance": date(1985, 3, 10),
        "telephone": "0551234567",
        "dentiste_id": uuid.UUID(dentiste_id),
        "statut": StatutValidation.ACCEPTE,
    }
    defaults.update(kwargs)
    return Patient.objects.create(**defaults)


def make_rdv(patient: Patient, dentiste_id: str = UUID_DENTISTE_1, **kwargs) -> RendezVous:
    from django.utils import timezone
    defaults = {
        "patient": patient,
        "dentiste_id": uuid.UUID(dentiste_id),
        "date_heure": timezone.now() + timedelta(days=2),
        "duree_minutes": 30,
        "type_soin": TypeSoin.CONSULTATION,
        "priorite": PrioriteRDV.NORMALE,
        "statut": StatutRDV.ACCEPTE,
    }
    defaults.update(kwargs)
    return RendezVous.objects.create(**defaults)


def make_radio(patient: Patient, dentiste_id: str = UUID_DENTISTE_1, **kwargs) -> Radio:
    from django.core.files.base import ContentFile
    defaults = {
        "patient": patient,
        "dentiste_id": uuid.UUID(dentiste_id),
        "type_radio": TypeRadio.PANORAMIQUE,
        "date_prise": date.today(),
        "image": ContentFile(b"fake-image", name="test.jpg"),
    }
    defaults.update(kwargs)
    return Radio.objects.create(**defaults)


def make_ordonnance(patient: Patient, dentiste_id: str = UUID_DENTISTE_1, **kwargs) -> Ordonnance:
    numero = f"ORD-TEST-{uuid.uuid4().hex[:6].upper()}"
    defaults = {
        "patient": patient,
        "dentiste_id": uuid.UUID(dentiste_id),
        "numero": numero,
        "date_prescription": date.today(),
        "diagnostic": "Douleur post-extraction",
    }
    defaults.update(kwargs)
    ord_ = Ordonnance.objects.create(**defaults)
    LigneOrdonnance.objects.create(
        ordonnance=ord_,
        medicament="Amoxicilline 500mg",
        posologie="1 comprimé 3x/jour",
        quantite=1,
        ordre=1,
    )
    return ord_


def make_traitement(patient: Patient, dentiste_id: str = UUID_DENTISTE_1, **kwargs) -> Traitement:
    defaults = {
        "patient": patient,
        "dentiste_id": uuid.UUID(dentiste_id),
        "type_acte": TypeActe.EXTRACTION_SIMPLE,
        "dent": NumeroDent.D36,
        "materiau": Materiau.NON_APPLICABLE,
        "date_debut": date.today() - timedelta(days=3),
        "statut": StatutTraitement.TERMINE,
        "cout_total": Decimal("4000.00"),
        "cout_patient": Decimal("2000.00"),
    }
    defaults.update(kwargs)
    return Traitement.objects.create(**defaults)


# ══════════════════════════════════════════════════════════════════════════════
# 1. PERMISSIONS
# ══════════════════════════════════════════════════════════════════════════════

class DossierPermissionTests(TestCase):

    def setUp(self):
        self.patient = make_patient()

    def test_anonyme_denied(self):
        resp = APIClient().get(reverse("dossier-list"))
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_dentiste_acces_liste(self):
        resp = make_client("dentiste", UUID_DENTISTE_1).get(reverse("dossier-list"))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def test_admin_acces_liste(self):
        resp = make_client("admin", UUID_ADMIN).get(reverse("dossier-list"))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def test_receptioniste_lecture_seule_liste(self):
        resp = make_client("receptionniste", UUID_RECEP).get(reverse("dossier-list"))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def test_dentiste_ne_voit_pas_patient_dautrui(self):
        url  = reverse("dossier-detail", args=[self.patient.pk])
        resp = make_client("dentiste", UUID_DENTISTE_2).get(url)
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

    def test_admin_voit_tous_dossiers(self):
        url  = reverse("dossier-detail", args=[self.patient.pk])
        resp = make_client("admin", UUID_ADMIN).get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)


# ══════════════════════════════════════════════════════════════════════════════
# 2. LISTE DES DOSSIERS
# ══════════════════════════════════════════════════════════════════════════════

class DossierListeTests(TestCase):

    def setUp(self):
        self.client  = make_client("dentiste", UUID_DENTISTE_1)
        self.patient = make_patient(dentiste_id=UUID_DENTISTE_1)
        make_rdv(self.patient)
        make_rdv(self.patient)
        make_traitement(self.patient)
        make_ordonnance(self.patient)

    def test_liste_retourne_patients_du_dentiste(self):
        make_patient(dentiste_id=UUID_DENTISTE_2)
        resp = self.client.get(reverse("dossier-list"))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        ids = [d["patient_id"] for d in resp.data]
        self.assertIn(str(self.patient.pk), ids)
        # Le patient de l'autre dentiste ne doit pas apparaître
        autres = Patient.objects.filter(dentiste_id=UUID_DENTISTE_2)
        for a in autres:
            self.assertNotIn(str(a.pk), ids)

    def test_liste_contient_compteurs(self):
        resp = self.client.get(reverse("dossier-list"))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        dossier = next(d for d in resp.data if d["patient_id"] == str(self.patient.pk))
        self.assertEqual(dossier["nb_rendezvous"],  2)
        self.assertEqual(dossier["nb_traitements"], 1)
        self.assertEqual(dossier["nb_ordonnances"], 1)

    def test_liste_vide_si_aucun_patient(self):
        Patient.objects.all().delete()
        resp = self.client.get(reverse("dossier-list"))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data, [])

    def test_admin_voit_tous_les_patients(self):
        make_patient(dentiste_id=UUID_DENTISTE_2)
        resp = make_client("admin", UUID_ADMIN).get(reverse("dossier-list"))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(resp.data), 2)

    def test_liste_contient_champs_requis(self):
        resp = self.client.get(reverse("dossier-list"))
        d    = resp.data[0]
        for champ in (
            "patient_id", "nom_complet", "nom", "prenom", "age",
            "nb_rendezvous", "nb_radios", "nb_ordonnances",
            "nb_traitements", "nb_alertes_critiques", "created_at",
        ):
            self.assertIn(champ, d)


# ══════════════════════════════════════════════════════════════════════════════
# 3. DOSSIER COMPLET
# ══════════════════════════════════════════════════════════════════════════════

class DossierDetailTests(TestCase):

    def setUp(self):
        self.client  = make_client("dentiste", UUID_DENTISTE_1)
        self.patient = make_patient(dentiste_id=UUID_DENTISTE_1)
        self.rdv     = make_rdv(self.patient)
        self.radio   = make_radio(self.patient)
        self.ord_    = make_ordonnance(self.patient)
        self.trait   = make_traitement(self.patient)
        self.url     = reverse("dossier-detail", args=[self.patient.pk])

    def test_dossier_retourne_200(self):
        resp = self.client.get(self.url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def test_dossier_contient_toutes_sections(self):
        resp = self.client.get(self.url)
        for section in ("patient", "resume", "rendezvous", "radios", "ordonnances", "traitements"):
            self.assertIn(section, resp.data)

    def test_dossier_section_structure_meta_items(self):
        resp = self.client.get(self.url)
        for section in ("rendezvous", "radios", "ordonnances", "traitements"):
            self.assertIn("meta",  resp.data[section])
            self.assertIn("items", resp.data[section])

    def test_dossier_rendezvous_count(self):
        make_rdv(self.patient)
        resp = self.client.get(self.url)
        self.assertEqual(resp.data["rendezvous"]["meta"]["count"], 2)

    def test_dossier_radios_count(self):
        resp = self.client.get(self.url)
        self.assertEqual(resp.data["radios"]["meta"]["count"], 1)

    def test_dossier_ordonnances_count(self):
        resp = self.client.get(self.url)
        self.assertEqual(resp.data["ordonnances"]["meta"]["count"], 1)

    def test_dossier_traitements_count(self):
        resp = self.client.get(self.url)
        self.assertEqual(resp.data["traitements"]["meta"]["count"], 1)

    def test_dossier_resume_compteurs_corrects(self):
        resp   = self.client.get(self.url)
        resume = resp.data["resume"]
        self.assertEqual(resume["nb_rendezvous"],  1)
        self.assertEqual(resume["nb_radios"],      1)
        self.assertEqual(resume["nb_ordonnances"], 1)
        self.assertEqual(resume["nb_traitements"], 1)

    def test_dossier_patient_contient_alertes(self):
        self.patient.alerte_anticoagulants = True
        self.patient.save()
        resp    = self.client.get(self.url)
        alertes = resp.data["patient"]["alertes"]
        codes   = [a["code"] for a in alertes]
        self.assertIn("ANTICOAGULANTS", codes)

    def test_dossier_resume_alertes_critiques(self):
        self.patient.alerte_anticoagulants = True
        self.patient.alerte_grossesse      = True
        self.patient.save()
        resp = self.client.get(self.url)
        self.assertEqual(resp.data["resume"]["nb_alertes_critiques"], 2)

    def test_dossier_patient_inexistant_retourne_404(self):
        url  = reverse("dossier-detail", args=[uuid.uuid4()])
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

    def test_dossier_uuid_invalide_retourne_404(self):
        url  = reverse("dossier-detail", args=["pas-un-uuid"])
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

    def test_dossier_sections_vides_si_aucune_donnee(self):
        patient_vide = make_patient(dentiste_id=UUID_DENTISTE_1)
        url  = reverse("dossier-detail", args=[patient_vide.pk])
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["rendezvous"]["meta"]["count"],  0)
        self.assertEqual(resp.data["radios"]["meta"]["count"],      0)
        self.assertEqual(resp.data["ordonnances"]["meta"]["count"], 0)
        self.assertEqual(resp.data["traitements"]["meta"]["count"], 0)

    def test_receptioniste_peut_voir_dossier(self):
        resp = make_client("receptionniste", UUID_RECEP).get(self.url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)


# ══════════════════════════════════════════════════════════════════════════════
# 4. TIMELINE
# ══════════════════════════════════════════════════════════════════════════════

class DossierTimelineTests(TestCase):

    def setUp(self):
        self.client  = make_client("dentiste", UUID_DENTISTE_1)
        self.patient = make_patient(dentiste_id=UUID_DENTISTE_1)
        make_rdv(self.patient)
        make_radio(self.patient)
        make_ordonnance(self.patient)
        make_traitement(self.patient)
        self.url = reverse("dossier-timeline", args=[self.patient.pk])

    def test_timeline_retourne_200(self):
        resp = self.client.get(self.url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def test_timeline_structure(self):
        resp = self.client.get(self.url)
        for champ in ("patient_id", "nom_complet", "nb_evenements", "evenements"):
            self.assertIn(champ, resp.data)

    def test_timeline_contient_4_evenements(self):
        resp = self.client.get(self.url)
        self.assertEqual(resp.data["nb_evenements"], 4)
        self.assertEqual(len(resp.data["evenements"]), 4)

    def test_timeline_types_presents(self):
        resp  = self.client.get(self.url)
        types = {e["type"] for e in resp.data["evenements"]}
        self.assertIn("RENDEZVOUS",  types)
        self.assertIn("RADIO",       types)
        self.assertIn("ORDONNANCE",  types)
        self.assertIn("TRAITEMENT",  types)

    def test_timeline_structure_evenement(self):
        resp = self.client.get(self.url)
        ev   = resp.data["evenements"][0]
        for champ in ("type", "date", "titre", "description", "statut", "id", "meta"):
            self.assertIn(champ, ev)

    def test_timeline_triee_par_date_decroissante(self):
        resp  = self.client.get(self.url)
        dates = [e["date"] for e in resp.data["evenements"]]
        self.assertEqual(dates, sorted(dates, reverse=True))

    def test_timeline_vide_si_aucune_donnee(self):
        patient_vide = make_patient(dentiste_id=UUID_DENTISTE_1)
        url  = reverse("dossier-timeline", args=[patient_vide.pk])
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["nb_evenements"], 0)

    def test_timeline_patient_dautrui_retourne_404(self):
        autre = make_patient(dentiste_id=UUID_DENTISTE_2)
        url   = reverse("dossier-timeline", args=[autre.pk])
        resp  = make_client("dentiste", UUID_DENTISTE_1).get(url)
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)