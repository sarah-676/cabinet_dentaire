"""
radios/admin.py — api_service
"""
from django.contrib import admin
from django.utils.html import format_html
from .models import Radio, StatutAnalyse


@admin.register(Radio)
class RadioAdmin(admin.ModelAdmin):
    list_display = [
        "id_court", "patient", "type_radio",
        "date_prise", "statut_badge", "anomalies_badge",
        "ia_confidence", "created_at",
    ]
    list_filter   = ["type_radio", "statut_analyse", "ia_anomalies_detectees", "date_prise"]
    search_fields = ["patient__nom", "patient__prenom", "description"]
    ordering      = ["-date_prise"]
    readonly_fields = [
        "id", "dentiste_id", "statut_analyse",
        "ia_resultat", "ia_anomalies", "ia_confidence",
        "ia_anomalies_detectees", "ia_analyse_at", "ia_erreur",
        "created_at", "updated_at",
    ]
    fieldsets = (
        ("Radiographie", {
            "fields": ("id", "patient", "dentiste_id", "image", "type_radio", "date_prise", "description"),
        }),
        ("Analyse IA", {
            "fields": (
                "statut_analyse", "ia_resultat", "ia_anomalies",
                "ia_confidence", "ia_anomalies_detectees",
                "ia_analyse_at", "ia_erreur",
            ),
        }),
        ("Métadonnées", {
            "fields": ("is_active", "created_at", "updated_at"),
            "classes": ("collapse",),
        }),
    )

    @admin.display(description="ID")
    def id_court(self, obj):
        return str(obj.id)[:8] + "..."

    @admin.display(description="Statut")
    def statut_badge(self, obj):
        colors = {
            StatutAnalyse.EN_ATTENTE: ("#F59E0B", "⏳"),
            StatutAnalyse.EN_COURS:   ("#3B82F6", "🔄"),
            StatutAnalyse.ANALYSE:    ("#10B981", "✅"),
            StatutAnalyse.ERREUR:     ("#EF4444", "❌"),
        }
        color, icon = colors.get(obj.statut_analyse, ("#6B7280", "?"))
        return format_html(
            '<span style="color:{};">{} {}</span>',
            color, icon, obj.get_statut_analyse_display(),
        )

    @admin.display(description="Anomalies")
    def anomalies_badge(self, obj):
        if obj.statut_analyse != StatutAnalyse.ANALYSE:
            return "—"
        if obj.ia_anomalies_detectees:
            return format_html(
                '<span style="color:#EF4444; font-weight:600;">⚠️ {} anomalie(s)</span>',
                obj.nb_anomalies,
            )
        return format_html('<span style="color:#10B981;">✅ Aucune</span>')
