"""
gateway_app/apps.py — API Gateway
====================================
Configuration de l'application Django.

Enregistrement Consul :
  - Se connecte à Consul au démarrage de Django (signal ready)
  - Se désenregistre proprement à l'arrêt (signal SIGTERM)

Ce mécanisme permet à Traefik de découvrir automatiquement
le gateway et de configurer le routage dynamiquement.
"""

import logging
import signal

from django.apps import AppConfig
from django.conf import settings

logger = logging.getLogger("gateway_app")


class GatewayAppConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name               = "gateway_app"
    verbose_name       = "API Gateway"

    def ready(self):
        """
        Appelé quand l'application Django est prête.
        - Enregistre le gateway dans Consul (si activé)
        - Configure le handler d'arrêt propre
        """
        # Éviter l'exécution au reload en dev (autoreload child process)
        import sys
        if "runserver" in sys.argv and not _is_main_process():
            return

        self._setup_shutdown_handler()

        if getattr(settings, "CONSUL_REGISTER", False):
            self._register_in_consul()
        else:
            logger.info(
                "Consul désactivé (CONSUL_REGISTER=False). "
                "Mettre CONSUL_REGISTER=True pour activer le service discovery."
            )

    def _register_in_consul(self):
        """Enregistre le gateway dans Consul."""
        try:
            from .consul_client import ConsulClient
            client = ConsulClient()
            success = client.register_service()
            if success:
                # Stocker pour le désenregistrement
                GatewayAppConfig._consul_client = client
        except ImportError:
            logger.warning("python-consul non installé — Consul désactivé.")
        except Exception as exc:
            logger.warning("Enregistrement Consul échoué (non bloquant): %s", exc)

    def _setup_shutdown_handler(self):
        """Configure un handler SIGTERM pour le désenregistrement propre."""
        def handle_shutdown(signum, frame):
            logger.info("Signal d'arrêt reçu — nettoyage...")
            client = getattr(GatewayAppConfig, "_consul_client", None)
            if client:
                try:
                    client.deregister_service()
                except Exception as exc:
                    logger.warning("Erreur désenregistrement: %s", exc)

        try:
            signal.signal(signal.SIGTERM, handle_shutdown)
        except Exception:
            pass  # Windows ne supporte pas tous les signaux

    _consul_client = None


def _is_main_process() -> bool:
    """Détecte si on est dans le processus principal Django (pas le reloader)."""
    import os
    return os.environ.get("RUN_MAIN") == "true"