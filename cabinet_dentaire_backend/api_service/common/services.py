"""
common/services.py — api_service
==================================
Appels inter-services vers auth_service.

Corrections apportées vs ta version :
  1. URL corrigée : /api/auth/internal/users/{id}/
     (ta version avait /internal/users/{id}/ sans le préfixe /api/auth/)
  2. Header corrigé : Authorization: Bearer <token>
     (auth_service utilise JWT Bearer, pas X-Internal-Token)
  3. dentiste_id accepte UUID (str) ou int
  4. Ajout de get_dentistes_actifs() pour lister les dentistes
  5. Ajout de get_user_info() pour récupérer n'importe quel utilisateur

Endpoints utilisés (définis dans auth_service/auth_app/urls.py) :
  GET /api/auth/internal/users/{user_id}/   → vérifier un utilisateur
  GET /api/auth/users/dentistes/            → liste dentistes actifs
"""

import logging

import requests
from django.conf import settings

logger = logging.getLogger(__name__)


# ── Helper interne ────────────────────────────────────────────────────────────

def _get_auth_headers() -> dict:
    """
    Headers pour les appels inter-services vers auth_service.

    INTERNAL_SERVICE_TOKEN peut être :
      - un JWT valide -> envoyé dans Authorization: Bearer <token>
      - un secret interne arbitraire -> envoyé dans X-Internal-Token

    Dans auth_service, le endpoint interne doit accepter le mode choisi.
    """
    token = getattr(settings, "INTERNAL_SERVICE_TOKEN", "")
    if not token:
        logger.warning(
            "INTERNAL_SERVICE_TOKEN non configuré dans .env — "
            "les appels inter-services vont échouer."
        )

    headers = {"Content-Type": "application/json"}
    if token.count(".") == 2:
        headers["Authorization"] = f"Bearer {token}"
    else:
        headers["X-Internal-Token"] = token

    return headers


# ── Vérification dentiste ─────────────────────────────────────────────────────

def verifier_dentiste_actif(dentiste_id) -> bool:
    """
    Vérifie via auth_service que dentiste_id correspond à un dentiste actif.

    Utilisé dans patients/views.py → perform_create() quand la réceptionniste
    crée un patient et fournit un dentiste_id.

    Retourne False en cas d'erreur réseau (comportement sécurisé).

    Args:
        dentiste_id: UUID (str) ou int de l'utilisateur à vérifier

    Returns:
        True si l'utilisateur existe, a role="dentiste" et is_active=True
        False dans tous les autres cas
    """
    try:
        # ✅ URL correcte : /api/auth/internal/users/{id}/
        # (auth_service/config/urls.py → path("api/auth/", include("auth_app.urls"))
        #  auth_app/urls.py → path("internal/users/<uuid:user_id>/", ...))
        url = (
            f"{settings.AUTH_SERVICE_URL}"
            f"/api/auth/internal/users/{dentiste_id}/"
        )
        resp = requests.get(
            url,
            timeout=3,
            headers=_get_auth_headers(),
        )

        if resp.status_code == 404:
            logger.warning(
                "auth_service: dentiste_id=%s introuvable (404)", dentiste_id
            )
            return False

        if resp.status_code != 200:
            logger.warning(
                "auth_service: dentiste_id=%s → HTTP %s",
                dentiste_id,
                resp.status_code,
            )
            return False

        data = resp.json()

        # Vérifier rôle ET statut actif
        est_valide = (
            data.get("role") == "dentiste"
            and data.get("is_active", False) is True
        )

        if not est_valide:
            logger.info(
                "auth_service: dentiste_id=%s non valide "
                "(role=%s, is_active=%s)",
                dentiste_id,
                data.get("role"),
                data.get("is_active"),
            )

        return est_valide

    except requests.Timeout:
        logger.error(
            "auth_service timeout pour dentiste_id=%s", dentiste_id
        )
        return False
    except requests.ConnectionError:
        logger.error(
            "auth_service inaccessible pour dentiste_id=%s", dentiste_id
        )
        return False
    except requests.RequestException as exc:
        logger.error(
            "auth_service erreur réseau [dentiste=%s] : %s", dentiste_id, exc
        )
        return False


# ── Récupérer les infos d'un utilisateur ─────────────────────────────────────

def get_user_info(user_id) -> dict | None:
    """
    Récupère les informations d'un utilisateur depuis auth_service.

    Endpoint : GET /api/auth/internal/users/{user_id}/

    Réponse (InternalUserSerializer) :
      {
        "id":        "uuid",
        "email":     "...",
        "full_name": "...",
        "role":      "admin|dentiste|receptionniste",
        "is_active": true,
        "specialite": "..."
      }

    Returns:
        dict avec les infos utilisateur, ou None si introuvable/erreur
    """
    try:
        url = (
            f"{settings.AUTH_SERVICE_URL}"
            f"/api/auth/internal/users/{user_id}/"
        )
        resp = requests.get(
            url,
            timeout=3,
            headers=_get_auth_headers(),
        )

        if resp.status_code == 200:
            return resp.json()

        logger.warning(
            "get_user_info: user_id=%s → HTTP %s", user_id, resp.status_code
        )
        return None

    except requests.RequestException as exc:
        logger.error("get_user_info erreur réseau [user=%s] : %s", user_id, exc)
        return None


# ── Récupérer la liste des dentistes actifs ───────────────────────────────────

def get_dentistes_actifs() -> list[dict]:
    """
    Récupère la liste des dentistes actifs depuis auth_service.

    Endpoint : GET /api/auth/users/dentistes/

    Utilisé par le réceptionniste pour choisir un dentiste
    lors de la création d'un patient ou d'un rendez-vous.

    Réponse (UserListSerializer) :
      [
        {
          "id":         "uuid",
          "email":      "...",
          "full_name":  "Dr Nom Prénom",
          "role":       "dentiste",
          "is_active":  true,
          "specialite": "Orthodontie",
          "avatar":     "url ou null"
        },
        ...
      ]

    Returns:
        liste de dicts, [] en cas d'erreur
    """
    try:
        url = f"{settings.AUTH_SERVICE_URL}/api/auth/users/dentistes/"
        resp = requests.get(
            url,
            timeout=5,
            headers=_get_auth_headers(),
        )

        if resp.status_code == 200:
            return resp.json()

        logger.warning(
            "get_dentistes_actifs → HTTP %s", resp.status_code
        )
        return []

    except requests.RequestException as exc:
        logger.error("get_dentistes_actifs erreur réseau : %s", exc)
        return []