"""config/urls.py — Gateway"""
from django.urls import path, include
from django.http import JsonResponse

def health(request):
    return JsonResponse({"status": "ok"})
urlpatterns = [
    path("", include("gateway_app.urls")),
    path("api/gateway/health/", health),
]