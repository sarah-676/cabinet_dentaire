"""
Crée l'administrateur par défaut si aucun admin n'existe.
Lancé automatiquement au démarrage du conteneur Docker.
"""
import os
import logging
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from auth_app.models import UserRole

User   = get_user_model()
logger = logging.getLogger("auth_app")


class Command(BaseCommand):
    help = "Crée l'administrateur par défaut si aucun admin n'existe."

    def handle(self, *args, **options):
        if User.objects.filter(role=UserRole.ADMIN).exists():
            self.stdout.write(self.style.WARNING(
                "⚠️  Un administrateur existe déjà — aucune action."
            ))
            return

        email      = os.environ.get("ADMIN_EMAIL",      "admin@cabinet.dz")
        password   = os.environ.get("ADMIN_PASSWORD",   "Admin@1234")
        first_name = os.environ.get("ADMIN_FIRST_NAME", "Super")
        last_name  = os.environ.get("ADMIN_LAST_NAME",  "Admin")

        User.objects.create_superuser(
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name,
            role=UserRole.ADMIN,
        )
        self.stdout.write(self.style.SUCCESS(
            f"✅  Admin créé → email: {email} | password: {password}"
        ))
        logger.info(f"Admin créé automatiquement : {email}")