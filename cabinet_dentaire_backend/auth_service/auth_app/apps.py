from django.apps import AppConfig


class AuthAppConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name               = "auth_app"
    verbose_name       = "Authentification & Utilisateurs"

    def ready(self):
        import os
        # S'enregistre dans Consul SEULEMENT si CONSUL_REGISTER=true dans .env
        # En dev local → CONSUL_REGISTER=false → pas d'enregistrement
        # En Docker    → CONSUL_REGISTER=true  → enregistrement
        if os.environ.get("CONSUL_REGISTER", "false") == "true":
            try:
                from auth_app.consul_register import register_service
                register_service()
            except Exception:
                pass