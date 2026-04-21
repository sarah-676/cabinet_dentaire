"""
auth_app/tests.py
Tests unitaires complets pour le auth_service.
Couvre : login, logout, refresh, verify, profil, CRUD users, permissions.
"""
import uuid
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from auth_app.models import User, UserRole


# ── Helpers ───────────────────────────────────────────────────────────
def make_user(role=UserRole.RECEPTIONNISTE, email=None, password="Test@1234", **kwargs):
    email = email or f"{role}_{uuid.uuid4().hex[:6]}@test.dz"
    return User.objects.create_user(
        email=email, password=password,
        first_name="Test", last_name="User",
        role=role, **kwargs
    )


def get_tokens(client, email, password="Test@1234"):
    resp = client.post(reverse("auth-login"), {"email": email, "password": password})
    return resp.data.get("access"), resp.data.get("refresh")


# ── Tests Login / Logout / Token ──────────────────────────────────────
class AuthTokenTests(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.admin = make_user(
            role=UserRole.ADMIN, email="admin@test.dz", password="Admin@1234"
        )

    def test_login_success(self):
        resp = self.client.post(reverse("auth-login"), {
            "email": "admin@test.dz", "password": "Admin@1234"
        })
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn("access",  resp.data)
        self.assertIn("refresh", resp.data)
        self.assertIn("user",    resp.data)
        self.assertEqual(resp.data["user"]["role"], UserRole.ADMIN)

    def test_login_wrong_password(self):
        resp = self.client.post(reverse("auth-login"), {
            "email": "admin@test.dz", "password": "wrong"
        })
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_login_inactive_user(self):
        self.admin.is_active = False
        self.admin.save()
        resp = self.client.post(reverse("auth-login"), {
            "email": "admin@test.dz", "password": "Admin@1234"
        })
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_token_refresh(self):
        _, refresh = get_tokens(self.client, "admin@test.dz", "Admin@1234")
        resp = self.client.post(reverse("auth-token-refresh"), {"refresh": refresh})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn("access", resp.data)

    def test_logout_blacklists_token(self):
        access, refresh = get_tokens(self.client, "admin@test.dz", "Admin@1234")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        resp = self.client.post(reverse("auth-logout"), {"refresh": refresh})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        # Après logout, le refresh doit être blacklisté
        resp2 = self.client.post(reverse("auth-token-refresh"), {"refresh": refresh})
        self.assertEqual(resp2.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_logout_without_refresh_returns_400(self):
        access, _ = get_tokens(self.client, "admin@test.dz", "Admin@1234")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        resp = self.client.post(reverse("auth-logout"), {})
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_verify_token(self):
        access, _ = get_tokens(self.client, "admin@test.dz", "Admin@1234")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        resp = self.client.get(reverse("auth-verify"))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertTrue(resp.data["valid"])
        self.assertEqual(resp.data["user"]["role"], UserRole.ADMIN)

    def test_verify_without_token_returns_401(self):
        resp = self.client.get(reverse("auth-verify"))
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)


# ── Tests Profil ──────────────────────────────────────────────────────
class ProfileTests(TestCase):

    def setUp(self):
        self.client    = APIClient()
        self.dentiste  = make_user(
            role=UserRole.DENTISTE, email="dentiste@test.dz",
            specialite="Orthodontie"
        )
        access, _      = get_tokens(self.client, "dentiste@test.dz")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")

    def test_get_profile(self):
        resp = self.client.get(reverse("auth-profile"))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["email"],     "dentiste@test.dz")
        self.assertEqual(resp.data["role"],      UserRole.DENTISTE)
        self.assertEqual(resp.data["specialite"], "Orthodontie")

    def test_patch_profile(self):
        resp = self.client.patch(reverse("auth-profile"), {
            "first_name": "Karim", "phone": "0550000001"
        })
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["first_name"], "Karim")
        self.assertEqual(resp.data["phone"],      "0550000001")

    def test_patch_profile_cannot_change_role(self):
        """Un utilisateur ne peut pas changer son propre rôle."""
        resp = self.client.patch(reverse("auth-profile"), {"role": UserRole.ADMIN})
        # Le champ role n'est pas dans UserUpdateSelfSerializer → ignoré silencieusement
        self.dentiste.refresh_from_db()
        self.assertEqual(self.dentiste.role, UserRole.DENTISTE)


# ── Tests Changement de mot de passe ─────────────────────────────────
class ChangePasswordTests(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.user   = make_user(email="recep@test.dz", password="Old@1234")
        access, _   = get_tokens(self.client, "recep@test.dz", "Old@1234")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")

    def test_change_password_success(self):
        resp = self.client.post(reverse("auth-change-password"), {
            "current_password":     "Old@1234",
            "new_password":         "New@5678",
            "new_password_confirm": "New@5678",
        })
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("New@5678"))

    def test_change_password_wrong_current(self):
        resp = self.client.post(reverse("auth-change-password"), {
            "current_password":     "WrongPass",
            "new_password":         "New@5678",
            "new_password_confirm": "New@5678",
        })
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_change_password_mismatch(self):
        resp = self.client.post(reverse("auth-change-password"), {
            "current_password":     "Old@1234",
            "new_password":         "New@5678",
            "new_password_confirm": "Different@5678",
        })
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)


# ── Tests CRUD Utilisateurs (Admin) ───────────────────────────────────
class UserViewSetTests(TestCase):

    def setUp(self):
        self.client      = APIClient()
        self.admin       = make_user(role=UserRole.ADMIN, email="admin@test.dz", password="Admin@1234")
        self.dentiste    = make_user(role=UserRole.DENTISTE, email="dr.ali@test.dz", specialite="Pédodontie")
        self.recep       = make_user(role=UserRole.RECEPTIONNISTE, email="recep@test.dz")

        access, _        = get_tokens(self.client, "admin@test.dz", "Admin@1234")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")

    # ── List ──────────────────────────────────────────────────────
    def test_list_users_as_admin(self):
        resp = self.client.get(reverse("users-list"))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(resp.data["count"], 3)

    def test_list_filter_by_role(self):
        resp = self.client.get(reverse("users-list") + "?role=dentiste")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        for u in resp.data["results"]:
            self.assertEqual(u["role"], UserRole.DENTISTE)

    def test_list_search(self):
        resp = self.client.get(reverse("users-list") + "?search=ali")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        emails = [u["email"] for u in resp.data["results"]]
        self.assertIn("dr.ali@test.dz", emails)

    def test_list_forbidden_for_dentiste(self):
        """Un dentiste ne peut pas lister tous les utilisateurs."""
        client2 = APIClient()
        access, _ = get_tokens(client2, "dr.ali@test.dz")
        client2.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        resp = client2.get(reverse("users-list"))
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    # ── Create ────────────────────────────────────────────────────
    def test_create_user_as_admin(self):
        resp = self.client.post(reverse("users-list"), {
            "email":            "new_dentiste@test.dz",
            "first_name":       "Amina",
            "last_name":        "Bouzidi",
            "role":             UserRole.DENTISTE,
            "specialite":       "Chirurgie",
            "password":         "Secure@1234",
            "password_confirm": "Secure@1234",
        })
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp.data["role"], UserRole.DENTISTE)
        self.assertTrue(User.objects.filter(email="new_dentiste@test.dz").exists())

    def test_create_user_password_mismatch(self):
        resp = self.client.post(reverse("users-list"), {
            "email":            "bad@test.dz",
            "first_name":       "Test",
            "last_name":        "User",
            "role":             UserRole.RECEPTIONNISTE,
            "password":         "Secure@1234",
            "password_confirm": "Different@1234",
        })
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    # ── Retrieve ──────────────────────────────────────────────────
    def test_retrieve_user(self):
        resp = self.client.get(reverse("users-detail", args=[self.dentiste.pk]))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["email"], "dr.ali@test.dz")

    # ── Update ────────────────────────────────────────────────────
    def test_patch_user_as_admin(self):
        resp = self.client.patch(
            reverse("users-detail", args=[self.dentiste.pk]),
            {"specialite": "Implantologie", "is_active": True}
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    # ── Soft Delete ───────────────────────────────────────────────
    def test_destroy_deactivates_user(self):
        resp = self.client.delete(reverse("users-detail", args=[self.recep.pk]))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.recep.refresh_from_db()
        self.assertFalse(self.recep.is_active)

    def test_cannot_delete_self(self):
        resp = self.client.delete(reverse("users-detail", args=[self.admin.pk]))
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    # ── Toggle actif ──────────────────────────────────────────────
    def test_toggle_actif(self):
        url  = reverse("users-toggle-actif", args=[self.recep.pk])
        resp = self.client.patch(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.recep.refresh_from_db()
        self.assertFalse(self.recep.is_active)
        # Toggle retour
        resp2 = self.client.patch(url)
        self.assertEqual(resp2.status_code, status.HTTP_200_OK)
        self.recep.refresh_from_db()
        self.assertTrue(self.recep.is_active)

    # ── Action dentistes ──────────────────────────────────────────
    def test_dentistes_list_accessible_by_receptionniste(self):
        client2  = APIClient()
        access, _ = get_tokens(client2, "recep@test.dz")
        client2.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        resp = client2.get(reverse("users-dentistes"))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        roles = [u["role"] for u in resp.data]
        self.assertTrue(all(r == UserRole.DENTISTE for r in roles))

    def test_dentistes_list_only_active(self):
        self.dentiste.is_active = False
        self.dentiste.save()
        resp = self.client.get(reverse("users-dentistes"))
        emails = [u["email"] for u in resp.data]
        self.assertNotIn("dr.ali@test.dz", emails)

    # ── Stats ─────────────────────────────────────────────────────
    def test_stats_as_admin(self):
        resp = self.client.get(reverse("users-stats"))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        for key in ("total", "admins", "dentistes", "receptionnistes", "inactifs"):
            self.assertIn(key, resp.data)

    def test_stats_forbidden_for_non_admin(self):
        client2  = APIClient()
        access, _ = get_tokens(client2, "recep@test.dz")
        client2.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        resp = client2.get(reverse("users-stats"))
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)


# ── Tests Health ──────────────────────────────────────────────────────
class HealthTests(TestCase):

    def test_health_endpoint(self):
        client = APIClient()
        resp   = client.get(reverse("auth-health"))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["status"], "ok")


# ── Tests User Model ──────────────────────────────────────────────────
class UserModelTests(TestCase):

    def test_full_name(self):
        u = make_user(role=UserRole.DENTISTE)
        u.first_name = "Yacine"
        u.last_name  = "Hamidi"
        self.assertEqual(u.full_name, "Yacine Hamidi")

    def test_role_properties(self):
        admin = make_user(role=UserRole.ADMIN)
        self.assertTrue(admin.is_admin)
        self.assertFalse(admin.is_dentiste)
        self.assertFalse(admin.is_receptionniste)

        dentiste = make_user(role=UserRole.DENTISTE)
        self.assertTrue(dentiste.is_dentiste)

        recep = make_user(role=UserRole.RECEPTIONNISTE)
        self.assertTrue(recep.is_receptionniste)

    def test_str_representation(self):
        u = make_user(role=UserRole.DENTISTE)
        u.first_name = "Ali"
        u.last_name  = "Bouaziz"
        self.assertIn("Ali Bouaziz", str(u))
        self.assertIn("Dentiste", str(u))