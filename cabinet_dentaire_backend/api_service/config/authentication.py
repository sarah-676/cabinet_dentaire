"""
config/authentication.py — api_service
=======================================
Authentification JWT déléguée à auth_service.

Fonctionnement :
  1. Frontend envoie  →  Authorization: Bearer eyJ...
  2. api_service reçoit la requête
  3. Ce fichier valide le token localement (rapide, sans réseau)
     en utilisant la MÊME JWT_SECRET_KEY que auth_service
  4. Si validation locale échoue → fallback appel réseau vers auth_service
  5. On crée un RemoteUser et on l'injecte dans request.user
  6. Les permissions (IsDentiste, IsAdmin...) lisent request.user.role

Payload JWT (défini dans auth_service/auth_app/serializers.py) :
  {
    "user_id":   "uuid",         ← USER_ID_CLAIM dans auth_service settings
    "email":     "...",
    "full_name": "Prénom Nom",
    "role":      "admin|dentiste|receptionniste",
    "token_type": "access",
    "exp": ...,
    "iat": ...,
  }
"""

import logging

import requests
from django.conf import settings
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.backends import TokenBackend
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError

logger = logging.getLogger(__name__)


# ── Objet utilisateur distant ─────────────────────────────────────────────────

class RemoteUser:
    """
    Représente l'utilisateur dans api_service.
    Pas de modèle Django — les données viennent du token JWT.

    Attributs lus par les permissions :
      .id            → UUID (str)
      .email         → str
      .full_name     → "Prénom Nom"
      .role          → "admin" | "dentiste" | "receptionniste"
      .is_active     → bool
      .is_authenticated → True (requis par DRF)

    IMPORTANT :
      Les permissions accèdent à request.user directement (objet RemoteUser).
      Mais les vues qui utilisent _get_user_id() lisent request.user comme dict.
      → On expose aussi __getitem__ et .get() pour compatibilité.
    """

    def __init__(self, data: dict):
        self.id            = data.get("id") or data.get("user_id")
        self.email         = data.get("email", "")
        self.full_name     = data.get("full_name", "")
        self.role          = data.get("role", "")
        self.is_active     = data.get("is_active", True)
        self.is_authenticated = True
        # Stocker les données brutes pour compatibilité dict
        self._data = {
            "id":        self.id,
            "user_id":   self.id,
            "email":     self.email,
            "full_name": self.full_name,
            "role":      self.role,
            "is_active": self.is_active,
        }

    # ── Compatibilité dict (pour _get_role / _get_user_id dans permissions) ──
    def get(self, key, default=None):
        return self._data.get(key, default)

    def __getitem__(self, key):
        return self._data[key]

    def __contains__(self, key):
        return key in self._data

    def __str__(self):
        return f"{self.full_name} ({self.role})"

    # ── Requis par Django pour les vues admin (non utilisées mais évite les erreurs) ──
    @property
    def is_anonymous(self):
        return False

    @property
    def is_staff(self):
        return self.role == "admin"


# ── Authentification principale ───────────────────────────────────────────────

class RemoteJWTAuthentication(BaseAuthentication):
    """
    Authentification JWT déléguée à auth_service.

    Stratégie : validation locale (rapide) → fallback réseau si échec.

    Validation locale :
      - Décode le token avec JWT_SECRET_KEY (même clé que auth_service)
      - Extrait user_id, email, role directement depuis le payload
      - Zéro appel réseau → très rapide

    Fallback réseau :
      - Appelle GET /api/auth/verify/ sur auth_service
      - Utile si le token a été blacklisté côté auth_service (logout)
    """

    def authenticate(self, request):
        # 1. Récupérer le token du header Authorization
        auth_header = request.META.get("HTTP_AUTHORIZATION", "")
        if not auth_header.startswith("Bearer "):
            return None  # pas de token → DRF gère l'accès anonyme

        token = auth_header.split(" ", 1)[1].strip()
        if not token:
            return None

        # 2. Essayer la validation locale
        user_data = self._validate_local(token)

        # 3. Fallback réseau si validation locale échoue
        if user_data is None:
            logger.debug("Validation locale échouée → fallback réseau")
            user_data = self._validate_remote(token)

        if user_data is None:
            raise AuthenticationFailed("Token invalide ou expiré.")

        user = RemoteUser(user_data)

        # Vérifier que le compte est actif
        if not user.is_active:
            raise AuthenticationFailed("Ce compte est désactivé.")

        return (user, token)

    def _validate_local(self, token: str) -> dict | None:
        """
        Valide le token localement avec JWT_SECRET_KEY.
        Même clé que auth_service → même résultat, zéro réseau.
        """
        try:
            backend = TokenBackend(
                algorithm   = "HS256",
                signing_key = settings.SIMPLE_JWT.get(
                    "SIGNING_KEY", settings.SECRET_KEY
                ),
            )
            payload = backend.decode(token, verify=True)

            # Vérifier que c'est bien un access token (pas un refresh)
            if payload.get("token_type") != "access":
                logger.warning("Token type invalide : %s", payload.get("token_type"))
                return None

            # Extraire les données du payload
            # user_id → défini par USER_ID_CLAIM = "user_id" dans auth_service
            return {
                "id":        str(payload.get("user_id", "")),
                "user_id":   str(payload.get("user_id", "")),
                "email":     payload.get("email", ""),
                "full_name": payload.get("full_name", ""),
                "role":      payload.get("role", ""),
                "is_active": True,
            }

        except (InvalidToken, TokenError) as e:
            logger.debug("Validation locale JWT échouée : %s", e)
            return None
        except Exception as e:
            logger.error("Erreur inattendue validation locale : %s", e)
            return None

    def _validate_remote(self, token: str) -> dict | None:
        """
        Valide le token via appel réseau à auth_service.
        Endpoint : GET /api/auth/verify/
        Utilisé comme fallback (ex: token blacklisté après logout).
        """
        try:
            auth_url = f"{settings.AUTH_SERVICE_URL}/api/auth/verify/"
            response = requests.get(
                auth_url,
                headers={"Authorization": f"Bearer {token}"},
                timeout=5,
            )

            if response.status_code == 401:
                return None

            if response.status_code != 200:
                logger.warning(
                    "auth_service verify/ → HTTP %s", response.status_code
                )
                return None

            data = response.json()
            if not data.get("valid"):
                return None

            user = data.get("user", {})
            # Normaliser : auth_service retourne "id", on veut aussi "user_id"
            user["user_id"] = user.get("id")
            return user

        except requests.Timeout:
            logger.error("auth_service timeout lors de la validation du token")
            raise AuthenticationFailed(
                "Service d'authentification indisponible (timeout)."
            )
        except requests.ConnectionError:
            logger.error("auth_service inaccessible")
            raise AuthenticationFailed(
                "Service d'authentification inaccessible."
            )
        except Exception as exc:
            logger.error("Erreur validation token (réseau) : %s", exc)
            return None