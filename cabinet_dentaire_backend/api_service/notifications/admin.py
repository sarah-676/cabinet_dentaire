from django.contrib import admin

# Register your models here.
"""
notifications/admin.py — api_service
=======================================
Interface Django Admin pour les notifications.
"""


from django.utils.html import format_html
from .models import Notification, TypeNotification, NiveauNotification


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = [
        "id_court",
        "type",
        "niveau_badge",
        "titre",
        "destinataire_id",
        "patient_nom",
        "statut_lecture",
        "created_at",
    ]
    list_filter   = ["type", "niveau", "is_read"]
    search_fields = ["titre", "message", "patient_nom", "acteur_nom"]
    ordering      = ["-created_at"]
    readonly_fields = [
        "id", "destinataire_id", "acteur_id", "acteur_nom",
        "type", "niveau", "titre", "message",
        "patient_id", "patient_nom", "rdv_id",
        "metadata", "is_read", "read_at", "created_at",
    ]

    fieldsets = (
        ("Destinataire", {
            "fields": ("id", "destinataire_id", "acteur_id", "acteur_nom"),
        }),
        ("Contenu", {
            "fields": ("type", "niveau", "titre", "message"),
        }),
        ("Références", {
            "fields": ("patient_id", "patient_nom", "rdv_id"),
        }),
        ("Statut", {
            "fields": ("is_read", "read_at"),
        }),
        ("Métadonnées", {
            "fields": ("metadata", "created_at"),
            "classes": ("collapse",),
        }),
    )

    actions = ["marquer_lues", "marquer_non_lues", "supprimer_lues"]

    @admin.action(description="✅ Marquer comme lues")
    def marquer_lues(self, request, queryset):
        from django.utils import timezone
        count = queryset.filter(is_read=False).update(
            is_read=True, read_at=timezone.now()
        )
        self.message_user(request, f"{count} notification(s) marquée(s) comme lues.")

    @admin.action(description="🔵 Marquer comme non lues")
    def marquer_non_lues(self, request, queryset):
        count = queryset.filter(is_read=True).update(is_read=False, read_at=None)
        self.message_user(request, f"{count} notification(s) remise(s) en non lu.")

    @admin.action(description="🗑️ Supprimer les notifications lues sélectionnées")
    def supprimer_lues(self, request, queryset):
        count, _ = queryset.filter(is_read=True).delete()
        self.message_user(request, f"{count} notification(s) supprimée(s).")

    @admin.display(description="ID")
    def id_court(self, obj):
        return str(obj.id)[:8] + "…"

    @admin.display(description="Niveau")
    def niveau_badge(self, obj):
        colors = {
            NiveauNotification.INFO:     ("#3B82F6", "ℹ️"),
            NiveauNotification.SUCCES:   ("#10B981", "✅"),
            NiveauNotification.ALERTE:   ("#F59E0B", "⚠️"),
            NiveauNotification.CRITIQUE: ("#EF4444", "🚨"),
        }
        color, icon = colors.get(obj.niveau, ("#6B7280", "?"))
        return format_html(
            '<span style="color:{}; font-weight:600;">{} {}</span>',
            color, icon, obj.get_niveau_display(),
        )

    @admin.display(description="Lu")
    def statut_lecture(self, obj):
        if obj.is_read:
            return format_html('<span style="color:#10B981;">✓ Lu</span>')
        return format_html('<span style="color:#F59E0B; font-weight:600;">● Non lu</span>')