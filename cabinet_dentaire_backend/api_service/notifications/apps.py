"""
notifications/apps.py — api_service
======================================
AppConfig — démarre le consumer RabbitMQ au démarrage Django.

CORRECTION BUG 1 :
  La logique RUN_MAIN était inversée :
    ❌ if RUN_MAIN != "true" AND not management → return  (ne démarre JAMAIS en prod)
    ✅ Démarrer SAUF si management command ou si RUN_MAIN == "false" (double rechargeur)

  En production (gunicorn/uvicorn) : RUN_MAIN n'existe pas → doit démarrer
  En développement (runserver)     : RUN_MAIN="true" au second chargement → doit démarrer
  En management commands           : migrate, etc. → ne doit PAS démarrer
"""

import os
import sys
import logging
from django.apps import AppConfig

logger = logging.getLogger("notifications")


class NotificationsConfig(AppConfig):
    name               = "notifications"
    default_auto_field = "django.db.models.BigAutoField"
    verbose_name       = "Notifications"

    def ready(self):
        """
        Appelé quand Django est prêt.
        Démarre le consumer RabbitMQ dans un thread daemon.

        Ne démarre PAS si :
          - On est dans une management command (migrate, test, shell, etc.)
          - Variable d'env DISABLE_RABBITMQ_CONSUMER=true
          - Rechargeur automatique de runserver (premier chargement, RUN_MAIN non défini)
        """
        # ✅ Ne pas démarrer pendant les management commands
        if _is_management_command():
            return

        # ✅ Avec runserver Django, éviter le double démarrage :
        #    Premier passage : RUN_MAIN n'est pas défini → on skip
        #    Second passage  : RUN_MAIN="true" → on démarre
        #    En production (gunicorn) : RUN_MAIN n'est pas défini MAIS
        #    on n'est pas dans runserver → on regarde si on est en mode serveur
        is_runserver = _is_runserver()
        run_main     = os.environ.get("RUN_MAIN")

        if is_runserver and run_main != "true":
            # Premier chargement runserver → skip (le second démarrera
            return

        # ✅ Désactivation manuelle
        if os.environ.get("DISABLE_RABBITMQ_CONSUMER", "").lower() == "true":
            logger.info("Consumer RabbitMQ désactivé (DISABLE_RABBITMQ_CONSUMER=true)")
            return

        try:
            from notifications.handlers import demarrer_consumer_en_thread
            demarrer_consumer_en_thread()
        except Exception as exc:
            # Ne jamais faire crasher Django au démarrage à cause de RabbitMQ
            logger.warning("Impossible de démarrer le consumer RabbitMQ : %s", exc)


def _is_management_command() -> bool:
    """Détecte si on est dans une commande de gestion Django."""
    if len(sys.argv) < 2:
        return False
    management_commands = {
        "migrate", "makemigrations", "collectstatic",
        "shell", "dbshell", "test", "createsuperuser",
        "create_superadmin", "check", "showmigrations",
        "sqlmigrate", "inspectdb",
    }
    return sys.argv[1] in management_commands


def _is_runserver() -> bool:
    """Détecte si on est lancé avec manage.py runserver."""
    return len(sys.argv) >= 2 and sys.argv[1] == "runserver"