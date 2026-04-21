"""
treatments/admin.py — api_service
"""

from django.contrib import admin
from .models import Traitement, SeanceSoin


class SeanceSoinInline(admin.TabularInline):
    model          = SeanceSoin
    extra          = 0
    fields         = ("numero_seance", "date", "duree_minutes", "acte_realise", "is_active")
    readonly_fields = ("created_at",)


@admin.register(Traitement)
class TraitementAdmin(admin.ModelAdmin):
    list_display  = (
        "id", "patient", "type_acte", "dent", "statut",
        "date_debut", "date_fin", "cout_total", "is_active",
    )
    list_filter   = ("statut", "type_acte", "materiau", "is_active", "anesthesie_utilisee")
    search_fields = ("patient__nom", "patient__prenom", "description")
    readonly_fields = ("id", "created_at", "updated_at", "deleted_at")
    inlines       = [SeanceSoinInline]
    ordering      = ("-date_debut",)


@admin.register(SeanceSoin)
class SeanceSoinAdmin(admin.ModelAdmin):
    list_display  = ("traitement", "numero_seance", "date", "duree_minutes", "is_active")
    list_filter   = ("is_active",)
    search_fields = ("traitement__patient__nom", "acte_realise")
    readonly_fields = ("id", "created_at", "updated_at")