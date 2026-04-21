"""
auth_app/consul_register.py
Enregistrement automatique du service dans Consul au démarrage.
"""
import os
import logging
import consul

logger = logging.getLogger("auth_app")


def register_service():
    """
    Enregistre auth_service dans Consul pour le service discovery.
    Appelé depuis le signal AppConfig.ready().
    """
    host         = os.environ.get("CONSUL_HOST",   "consul")
    port         = int(os.environ.get("CONSUL_PORT",  "8500"))
    service_host = os.environ.get("SERVICE_HOST",  "auth_service")
    service_port = int(os.environ.get("SERVICE_PORT", "8001"))

    try:
        c = consul.Consul(host=host, port=port)
        c.agent.service.register(
            name="auth_service",
            service_id="auth_service_1",
            address=service_host,
            port=service_port,
            tags=["auth", "jwt", "django"],
            check=consul.Check.http(
                url=f"http://{service_host}:{service_port}/api/auth/health/",
                interval="15s",
                timeout="5s",
                deregister="1m",
            ),
        )
        logger.info(f"✅  auth_service enregistré dans Consul ({service_host}:{service_port})")
    except Exception as exc:
        logger.warning(f"⚠️  Impossible d'enregistrer dans Consul : {exc}")