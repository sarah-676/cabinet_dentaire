"""
rendezvous/admin.py
====================
Interface d'administration Django pour les rendez-vous.
"""

from django.contrib import admin
from django.utils import timezone
from django.utils.html import format_html

from .models import RendezVous, StatutRDV


@admin.register(RendezVous)
class RendezVousAdmin(admin.ModelAdmin):

    list_display = [
        "id_court",
        "patient_nom",
        "date_heure",
        "duree_minutes",
        "type_soin",
        "priorite",
        "statut_badge",
        "rappel_envoye",
        "is_active",
        "created_at",
    ]
    list_filter   = ["statut", "type_soin", "priorite", "is_active", "rappel_envoye"]
    search_fields = ["patient__nom", "patient__prenom", "motif"]
    ordering      = ["-date_heure"]
    readonly_fields = [
        "id", "created_at", "updated_at",
        "cancelled_at", "cancelled_by",
        "rappel_at",
    ]
    date_hierarchy = "date_heure"

    fieldsets = (
        ("Identification", {
            "fields": ("id", "patient", "dentiste_id", "receptionniste_id"),
        }),
        ("Planification", {
            "fields": ("date_heure", "duree_minutes", "type_soin", "priorite"),
        }),
        ("Contenu", {
            "fields": ("motif", "note_interne", "instructions_patient"),
        }),
        ("Statut", {
            "fields": ("statut", "refuse_raison", "is_active", "cancelled_at", "cancelled_by"),
        }),
        ("Rappels", {
            "fields": ("rappel_envoye", "rappel_at"),
        }),
        ("Timestamps", {
            "fields": ("created_at", "updated_at"),
            "classes": ("collapse",),
        }),
    )

    # ── Actions admin ─────────────────────────────────────────────────

    actions = ["accepter_rdv", "refuser_rdv", "marquer_termines"]

    @admin.action(description="✅ Accepter les RDV sélectionnés")
    def accepter_rdv(self, request, queryset):
        count = 0
        for rdv in queryset.filter(statut=StatutRDV.PENDING):
            rdv.accepter()
            count += 1
        self.message_user(request, f"{count} rendez-vous accepté(s).")

    @admin.action(description="❌ Refuser les RDV sélectionnés")
    def refuser_rdv(self, request, queryset):
        count = 0
        for rdv in queryset.filter(statut=StatutRDV.PENDING):
            rdv.refuser(raison="Refusé via l'interface admin.")
            count += 1
        self.message_user(request, f"{count} rendez-vous refusé(s).")

    @admin.action(description="🏁 Marquer comme terminés")
    def marquer_termines(self, request, queryset):
        count = queryset.filter(
            statut=StatutRDV.ACCEPTE,
            date_heure__lt=timezone.now(),
        ).update(statut=StatutRDV.TERMINE)
        self.message_user(request, f"{count} rendez-vous marqué(s) comme terminé(s).")

    # ── Colonnes custom ───────────────────────────────────────────────

    @admin.display(description="ID")
    def id_court(self, obj):
        return str(obj.id)[:8] + "…"

    @admin.display(description="Patient")
    def patient_nom(self, obj):
        return obj.patient.nom_complet if obj.patient_id else "—"

    @admin.display(description="Statut")
    def statut_badge(self, obj):
        colors = {
            StatutRDV.PENDING: ("#F59E0B", "🕐"),
            StatutRDV.ACCEPTE: ("#10B981", "✅"),
            StatutRDV.REFUSE:  ("#EF4444", "❌"),
            StatutRDV.ANNULE:  ("#6B7280", "🚫"),
            StatutRDV.TERMINE: ("#3B82F6", "🏁"),
        }
        color, icon = colors.get(obj.statut, ("#6B7280", "?"))
        return format_html(
            '<span style="color:{}; font-weight:600;">{} {}</span>',
            color, icon, obj.get_statut_display(),
        )