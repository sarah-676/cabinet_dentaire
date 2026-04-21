/**
 * api/rendezvousAPI.js
 * =====================
 * Tous les appels HTTP vers /api/rendezvous/
 * Mappés exactement sur RendezVousViewSet et ses actions custom.
 *
 * Champs POST/PATCH (RendezVousCreateUpdateSerializer) :
 *   patient         → UUID string (PrimaryKeyRelatedField)
 *   date_heure      → ISO 8601 ex: "2026-04-21T10:30:00"
 *   duree_minutes   → entier ≥ 5
 *   type_soin       → CONSULTATION | DETARTRAGE | EXTRACTION | OBTURATION |
 *                     COURONNE | IMPLANT | ORTHODONTIE | RADIOGRAPHIE |
 *                     CHIRURGIE | BLANCHIMENT | CONTROLE | URGENCE | AUTRE
 *   priorite        → NORMALE | URGENTE | HAUTE
 *   motif           → string (optionnel)
 *   note_interne    → string (optionnel, dentiste uniquement)
 *   instructions_patient → string (optionnel)
 *
 * Réponse liste (RendezVousListSerializer) :
 *   id, patient_id, patient_nom, date_heure, date_fin, duree_minutes,
 *   type_soin, priorite, statut, motif, est_passe, est_aujourd_hui,
 *   rappel_envoye, created_at
 *
 * Réponse stats (RendezVousStatsSerializer) :
 *   total, aujourd_hui, cette_semaine, ce_mois, en_attente,
 *   acceptes, refuses, annules, termines, urgents, a_venir
 */

import axiosInstance from './axios'

// ── CRUD de base ──────────────────────────────────────────────────────────────

/** GET /api/rendezvous/
 *  Paramètres optionnels :
 *    statut       → PENDING | ACCEPTE | REFUSE | ANNULE | TERMINE
 *    type_soin    → valeur du choix TypeSoin
 *    priorite     → NORMALE | URGENTE | HAUTE
 *    patient_id   → UUID string
 *    date_debut   → "YYYY-MM-DD"
 *    date_fin     → "YYYY-MM-DD"
 *    aujourd_hui  → "true"
 *    search       → string (patient__nom, patient__prenom, motif)
 *    page         → numéro de page DRF
 */
export const getRDVs = (params = {}) =>
  axiosInstance.get('/api/rendezvous/', { params })

/** GET /api/rendezvous/{id}/ → RendezVousDetailSerializer */
export const getRDVById = (id) =>
  axiosInstance.get(`/api/rendezvous/${id}/`)

/** POST /api/rendezvous/
 *  Dentiste   → statut ACCEPTE automatiquement
 *  Réception. → statut PENDING + notification RabbitMQ au dentiste
 */
export const createRDV = (data) =>
  axiosInstance.post('/api/rendezvous/', data)

/** PATCH /api/rendezvous/{id}/ → modification partielle */
export const updateRDV = (id, data) =>
  axiosInstance.patch(`/api/rendezvous/${id}/`, data)

/** DELETE /api/rendezvous/{id}/ → soft delete (statut ANNULE)
 *  ⚠️  Retourne HTTP 200, pas 204 */
export const deleteRDV = (id) =>
  axiosInstance.delete(`/api/rendezvous/${id}/`)

// ── Actions custom ────────────────────────────────────────────────────────────

/** PATCH /api/rendezvous/{id}/valider/
 *  Body : { decision: "ACCEPTE" | "REFUSE", refuse_raison?: string }
 *  ⚠️  Si decision === "REFUSE" et refuse_raison vide → 400
 */
export const validerRDV = (id, decision, refuse_raison = '') =>
  axiosInstance.patch(`/api/rendezvous/${id}/valider/`, {
    decision,
    refuse_raison,
  })

/** PATCH /api/rendezvous/{id}/annuler/
 *  Body : { raison?: string } — raison optionnelle
 */
export const annulerRDV = (id, raison = '') =>
  axiosInstance.patch(`/api/rendezvous/${id}/annuler/`, { raison })

/** PATCH /api/rendezvous/{id}/terminer/
 *  Corps vide — réservé dentiste + admin
 *  Pré-condition : statut === "ACCEPTE"
 */
export const terminerRDV = (id) =>
  axiosInstance.patch(`/api/rendezvous/${id}/terminer/`, {})

// ── Stats & calendrier ────────────────────────────────────────────────────────

/** GET /api/rendezvous/stats/
 *  Retourne : total, aujourd_hui, cette_semaine, ce_mois,
 *             en_attente, acceptes, refuses, annules, termines,
 *             urgents, a_venir
 */
export const getStatsRDV = () =>
  axiosInstance.get('/api/rendezvous/stats/')

/** GET /api/rendezvous/calendar/
 *  Retourne des events FullCalendar-compatibles :
 *    id, title, start, end, color, statut, type_soin,
 *    priorite, patient_id, patient_nom
 *  Paramètres optionnels : date_debut, date_fin (défaut = mois courant)
 */
export const getCalendar = (params = {}) =>
  axiosInstance.get('/api/rendezvous/calendar/', { params })

// ── Constantes des choix (synchronisées avec backend/models.py) ───────────────

export const STATUT_RDV = {
  PENDING: 'PENDING',
  ACCEPTE: 'ACCEPTE',
  REFUSE:  'REFUSE',
  ANNULE:  'ANNULE',
  TERMINE: 'TERMINE',
}

export const STATUT_LABELS = {
  PENDING: 'En attente',
  ACCEPTE: 'Confirmé',
  REFUSE:  'Refusé',
  ANNULE:  'Annulé',
  TERMINE: 'Terminé',
}

export const STATUT_BADGE_CLASS = {
  PENDING: 'badge-warning',
  ACCEPTE: 'badge-success',
  REFUSE:  'badge-danger',
  ANNULE:  'badge-gray',
  TERMINE: 'badge-info',
}

export const TYPE_SOIN_LABELS = {
  CONSULTATION: 'Consultation',
  DETARTRAGE:   'Détartrage',
  EXTRACTION:   'Extraction',
  OBTURATION:   'Obturation / Plombage',
  COURONNE:     'Couronne',
  IMPLANT:      'Implant',
  ORTHODONTIE:  'Orthodontie',
  RADIOGRAPHIE: 'Radiographie',
  CHIRURGIE:    'Chirurgie buccale',
  BLANCHIMENT:  'Blanchiment',
  CONTROLE:     'Contrôle / Suivi',
  URGENCE:      'Urgence',
  AUTRE:        'Autre',
}

export const PRIORITE_LABELS = {
  NORMALE: 'Normale',
  URGENTE: 'Urgente',
  HAUTE:   'Haute priorité',
}