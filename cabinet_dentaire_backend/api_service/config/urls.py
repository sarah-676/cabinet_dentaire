"""
config/urls.py — api_service
"""

from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularSwaggerView,
)
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

@api_view(["GET"])
@permission_classes([AllowAny])
def health_check(request):
    return Response({"status": "ok", "service": "api_service"})

urlpatterns = [
    path("django-admin/", admin.site.urls),

    # ── Apps métier ────────────────────────────────────────────────────
    path("api/", include("patients.urls")),
    path("api/", include("rendezvous.urls")),
    path("api/", include("radios.urls")),
    path("api/", include("ordonnances.urls")),
    # path("api/", include("dental_chart.urls")),
    path("api/", include("treatments.urls")),
    path("api/", include("dossiers.urls")),
    path("api/", include("notifications.urls")),
    path("api/health/", health_check, name="health"),  # ✅ pour Consul

    # ── Swagger / OpenAPI ──────────────────────────────────────────────
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/",   SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),

] 
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)