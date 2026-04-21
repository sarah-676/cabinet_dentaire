"""
notifications/serializers.py — api_service
============================================
Serializers pour l'API REST des notifications.

  NotificationSerializer     → GET /notifications/          (liste)
  NotificationDetailSerializer → GET /notifications/{id}/   (détail)
  MarquerLueSerializer       → PATCH /notifications/{id}/lire/
  NotificationStatsSerializer → GET /notifications/stats/
"""

from rest_framework import serializers
from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    """
    Version liste — cartes de notification dans la sidebar/dropdown.
    """

    class Meta:
        model  = Notification
        fields = [
            "id",
            "type",
            "niveau",
            "titre",
            "message",
            "patient_id",
            "patient_nom",
            "rdv_id",
            "acteur_nom",
            "is_read",
            "read_at",
            "created_at",
        ]
        read_only_fields = fields


class NotificationDetailSerializer(serializers.ModelSerializer):
    """Version complète avec metadata pour débogage / admin."""

    class Meta:
        model  = Notification
        fields = [
            "id",
            "destinataire_id",
            "acteur_id",
            "acteur_nom",
            "type",
            "niveau",
            "titre",
            "message",
            "patient_id",
            "patient_nom",
            "rdv_id",
            "metadata",
            "is_read",
            "read_at",
            "created_at",
        ]
        read_only_fields = fields


class NotificationStatsSerializer(serializers.Serializer):
    """
    GET /notifications/stats/
    Compteurs pour le badge dans la navbar.
    """
    total       = serializers.IntegerField()
    non_lues    = serializers.IntegerField()
    lues        = serializers.IntegerField()
    par_type    = serializers.DictField(child=serializers.IntegerField())