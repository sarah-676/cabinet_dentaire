"""
ordonnances/apps.py
"""

from django.apps import AppConfig


class OrdonnancesConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name               = "ordonnances"
    verbose_name       = "Ordonnances & Prescriptions"

    def ready(self):
        pass  # Pas de signals nécessaires (pas de notifications)
