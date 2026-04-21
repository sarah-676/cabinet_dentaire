"""
ordonnances/admin.py
=====================
Interface d'administration Django pour les ordonnances.
Cohérence avec rendezvous/admin.py.
"""

from django.contrib import admin
from django.utils.html import format_html

from .models import Ordonnance, LigneOrdonnance, StatutOrdonnance


# ── Inline lignes ─────────────────────────────────────────────────────────────

class LigneOrdonnanceInline(admin.TabularInline):
    model        = LigneOrdonnance
    extra        = 1
    fields       = ["ordre", "medicament", "dosage", "forme", "voie", "posologie", "duree_traitement", "quantite"]
    ordering     = ["ordre"]
    show_change_link = False


# ── OrdonnanceAdmin ───────────────────────────────────────────────────────────

@admin.register(Ordonnance)
class OrdonnanceAdmin(admin.ModelAdmin):

    list_display = [
        "numero",
        "patient_nom",
        "date_prescription",
        "date_expiration",
        "statut_badge",
        "nb_medicaments",
        "is_active",
        "created_at",
    ]
    list_filter    = ["statut", "is_active"]
    search_fields  = ["numero", "patient__nom", "patient__prenom", "diagnostic"]
    ordering       = ["-date_prescription"]
    date_hierarchy = "date_prescription"
    inlines        = [LigneOrdonnanceInline]

    readonly_fields = [
        "id", "numero", "created_at", "updated_at",
        "archived_at", "archived_by",
    ]

    fieldsets = (
        ("Identification", {
            "fields": ("id", "numero", "patient", "dentiste_id", "rendezvous"),
        }),
        ("Prescription", {
            "fields": ("date_prescription", "date_expiration", "statut", "diagnostic"),
        }),
        ("Instructions", {
            "fields": ("instructions_generales", "note_pharmacien"),
        }),
        ("Archive", {
            "fields": ("is_active", "archived_at", "archived_by"),
            "classes": ("collapse",),
        }),
        ("Timestamps", {
            "fields": ("created_at", "updated_at"),
            "classes": ("collapse",),
        }),
    )

    actions = ["annuler_ordonnances", "archiver_ordonnances"]

    @admin.action(description="❌ Annuler les ordonnances sélectionnées")
    def annuler_ordonnances(self, request, queryset):
        count = 0
        for ord_ in queryset.filter(statut=StatutOrdonnance.ACTIVE):
            ord_.annuler()
            count += 1
        self.message_user(request, f"{count} ordonnance(s) annulée(s).")

    @admin.action(description="🗄️ Archiver les ordonnances sélectionnées")
    def archiver_ordonnances(self, request, queryset):
        count = 0
        for ord_ in queryset.filter(is_active=True):
            ord_.archiver(archived_by_id=request.user.pk if hasattr(request.user, "pk") else None)
            count += 1
        self.message_user(request, f"{count} ordonnance(s) archivée(s).")

    @admin.display(description="Patient")
    def patient_nom(self, obj):
        return obj.patient.nom_complet if obj.patient_id else "—"

    @admin.display(description="Médicaments")
    def nb_medicaments(self, obj):
        return obj.lignes.count()

    @admin.display(description="Statut")
    def statut_badge(self, obj):
        colors = {
            StatutOrdonnance.ACTIVE:  ("#10B981", "✅"),
            StatutOrdonnance.EXPIREE: ("#F59E0B", "⌛"),
            StatutOrdonnance.ANNULEE: ("#EF4444", "❌"),
        }
        color, icon = colors.get(obj.statut, ("#6B7280", "?"))
        return format_html(
            '<span style="color:{}; font-weight:600;">{} {}</span>',
            color, icon, obj.get_statut_display(),
        )


@admin.register(LigneOrdonnance)
class LigneOrdonnanceAdmin(admin.ModelAdmin):
    list_display  = ["ordonnance", "ordre", "medicament", "dosage", "forme", "posologie", "quantite"]
    list_filter   = ["forme", "voie"]
    search_fields = ["medicament", "ordonnance__numero", "ordonnance__patient__nom"]
    ordering      = ["ordonnance", "ordre"]
