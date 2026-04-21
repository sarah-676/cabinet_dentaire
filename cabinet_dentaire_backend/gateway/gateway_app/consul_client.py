"""
gateway_app/consul_client.py — API Gateway
=============================================
Client Consul pour le Service Registry / Discovery.

Fonctions :
  - Enregistrement du gateway dans Consul au démarrage
  - Désenregistrement propre à l'arrêt
  - Health check automatique par Consul
  - Découverte des autres services (auth_service, api_service)

Comment ça marche avec Traefik :
  1. Gateway démarre → s'enregistre dans Consul
  2. Traefik lit Consul en continu (consulCatalog provider)
  3. Traefik crée automatiquement les routes pour "cabinet-gateway"
  4. Consul vérifie /api/gateway/health/ toutes les 10s
  5. Si la santé échoue, Traefik retire le service du load balancer

Prérequis :
  pip install python-consul
  Consul doit tourner sur CONSUL_HOST:CONSUL_PORT
"""

import logging
import socket

from django.conf import settings

logger = logging.getLogger("gateway_app")


class ConsulClient:
    """
    Client Consul pour l'enregistrement et la découverte de services.
    Utilise python-consul comme bibliothèque cliente.
    """

    def __init__(self):
        self.host     = getattr(settings, "CONSUL_HOST",     "localhost")
        self.port     = getattr(settings, "CONSUL_PORT",     8500)
        self._client  = None

    @property
    def client(self):
        """Initialisation lazy du client Consul."""
        if self._client is None:
            try:
                import consul
                self._client = consul.Consul(host=self.host, port=self.port)
            except ImportError:
                logger.error(
                    "python-consul non installé. "
                    "Installer avec : pip install python-consul"
                )
                raise
        return self._client

    # ── Enregistrement ────────────────────────────────────────────────

    def register_service(self) -> bool:
        """
        Enregistre le gateway dans Consul.
        Appelé au démarrage depuis gateway_app/apps.py.

        Returns:
            True si succès, False si échec
        """
        service_name = getattr(settings, "SERVICE_NAME",  "cabinet-gateway")
        service_host = getattr(settings, "SERVICE_HOST",  "localhost")
        service_port = getattr(settings, "SERVICE_PORT",  8080)
        service_id   = f"{service_name}-{service_host}-{service_port}"

        try:
            self.client.agent.service.register(
                name    = service_name,
                service_id = service_id,
                address = service_host,
                port    = service_port,
                tags    = [
                    "traefik.enable=true",
                    f"traefik.http.routers.gateway.rule=PathPrefix(`/`)",
                    f"traefik.http.routers.gateway.entrypoints=web",
                    f"traefik.http.services.gateway.loadbalancer.server.port={service_port}",
                    "gateway",
                    "v1",
                ],
                check = {
                    "http":     f"http://{service_host}:{service_port}/api/gateway/health/",
                    "interval": "10s",
                    "timeout":  "3s",
                    "DeregisterCriticalServiceAfter": "30s",
                },
            )
            logger.info(
                "✓ Service '%s' enregistré dans Consul [%s:%s]",
                service_name, service_host, service_port,
            )
            return True

        except Exception as exc:
            logger.warning("Consul non disponible — enregistrement ignoré: %s", exc)
            return False

    def deregister_service(self) -> bool:
        """
        Désenregistre le gateway de Consul.
        Appelé à l'arrêt (signal SIGTERM/SIGINT).
        """
        service_name = getattr(settings, "SERVICE_NAME", "cabinet-gateway")
        service_host = getattr(settings, "SERVICE_HOST", "localhost")
        service_port = getattr(settings, "SERVICE_PORT", 8080)
        service_id   = f"{service_name}-{service_host}-{service_port}"

        try:
            self.client.agent.service.deregister(service_id)
            logger.info("✓ Service '%s' désenregistré de Consul", service_name)
            return True
        except Exception as exc:
            logger.warning("Erreur désenregistrement Consul: %s", exc)
            return False

    # ── Découverte ────────────────────────────────────────────────────

    def discover_service(self, service_name: str) -> str | None:
        """
        Découvre l'URL d'un service via Consul.

        Args:
            service_name: Nom du service (ex: "auth-service")

        Returns:
            URL du service (ex: "http://localhost:8001") ou None
        """
        try:
            _, instances = self.client.health.service(
                service_name,
                passing=True,
            )
            if not instances:
                logger.warning("Aucune instance saine pour %s", service_name)
                return None

            # Prendre la première instance saine
            instance = instances[0]
            address  = instance["Service"]["Address"] or instance["Node"]["Address"]
            port     = instance["Service"]["Port"]
            return f"http://{address}:{port}"

        except Exception as exc:
            logger.error("Erreur découverte Consul [%s]: %s", service_name, exc)
            return None

    def list_services(self) -> dict:
        """
        Liste tous les services enregistrés dans Consul.

        Returns:
            Dict {service_name: {url, tags, status}}
        """
        try:
            _, services_catalog = self.client.catalog.services()
            result = {}

            for name, tags in services_catalog.items():
                try:
                    _, instances = self.client.health.service(name, passing=True)
                    healthy_count = len(instances)
                    if instances:
                        first = instances[0]
                        addr  = first["Service"]["Address"] or first["Node"]["Address"]
                        port  = first["Service"]["Port"]
                        result[name] = {
                            "url":           f"http://{addr}:{port}",
                            "healthy_count": healthy_count,
                            "tags":          tags,
                        }
                    else:
                        result[name] = {
                            "url":           None,
                            "healthy_count": 0,
                            "tags":          tags,
                        }
                except Exception:
                    result[name] = {"healthy_count": 0, "tags": tags}

            return result

        except Exception as exc:
            logger.error("Erreur liste services Consul: %s", exc)
            return {}

    # ── Health check de Consul lui-même ───────────────────────────────

    def is_available(self) -> bool:
        """Vérifie si Consul est accessible."""
        try:
            self.client.status.leader()
            return True
        except Exception:
            return False