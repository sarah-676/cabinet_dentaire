/**
 * api/patientsAPI.js
 * ====================
 * Couche HTTP — endpoints patients (api_service).
 *
 * Tous les appels passent par le gateway (8080) → api_service (8000).
 *
 * Endpoints (patients/urls.py → PatientViewSet) :
 *
 *   GET    /api/patients/                    → liste paginée + filtres
 *   POST   /api/patients/                    → créer
 *   GET    /api/patients/{id}/               → fiche détaillée
 *   PATCH  /api/patients/{id}/               → modifier
 *   DELETE /api/patients/{id}/               → archiver (soft delete)
 *
 *   GET    /api/patients/stats/              → statistiques dashboard
 *   GET    /api/patients/{id}/dossier/       → dossier complet agrégé
 *   PATCH  /api/patients/{id}/valider/       → accepter / refuser
 *   PATCH  /api/patients/{id}/archiver/      → archiver explicitement
 *   PATCH  /api/patients/{id}/restaurer/     → restaurer
 *   PATCH  /api/patients/{id}/note/          → auto-save note libre
 */

import apiClient from "./axios";

const BASE = "/api/patients";

// ── Liste & détail ────────────────────────────────────────────────────────────

/**
 * GET /api/patients/
 * Retourne PatientListSerializer[] selon le rôle appelant.
 *
 * @param {Object} params
 * @param {string}  [params.search]           - nom, prénom, téléphone, email
 * @param {string}  [params.statut]           - "ACCEPTE" | "PENDING" | "REFUSE"
 * @param {string}  [params.groupe_sanguin]   - "A+" | "O-" | etc.
 * @param {string}  [params.sexe]             - "M" | "F"
 * @param {string}  [params.ordering]         - "nom" | "created_at" | etc.
 * @param {boolean} [params.include_archived] - admin seulement
 * @param {number}  [params.page]
 */
export const getPatients = (params = {}) =>
  apiClient.get(`${BASE}/`, { params });

/**
 * GET /api/patients/{id}/
 * Retourne PatientDetailSerializer (fiche complète, read-only).
 *
 * @param {string} id - UUID
 */
export const getPatientById = (id) =>
  apiClient.get(`${BASE}/${id}/`);

// ── Création ──────────────────────────────────────────────────────────────────

/**
 * POST /api/patients/
 * Crée un patient.
 *
 * Body (PatientCreateUpdateSerializer) :
 *   nom, prenom, sexe, date_naissance, telephone, email?, adresse?,
 *   groupe_sanguin?, allergies?, antecedents?, medicaments_actuels?,
 *   note_generale?,
 *   alerte_anticoagulants, alerte_diabete, alerte_grossesse,
 *   alerte_allergie_latex, alerte_cardiopathie, alerte_immunodeprime
 *
 * Comportement selon rôle (perform_create) :
 *   dentiste       → statut ACCEPTE, dentiste_id = token.user.id
 *   réceptionniste → statut PENDING, dentiste_id requis dans le body
 *   admin          → statut ACCEPTE, dentiste_id requis dans le body
 *
 * @param {Object} patientData
 */
export const createPatient = (patientData) =>
  apiClient.post(`${BASE}/`, patientData);

// ── Modification ──────────────────────────────────────────────────────────────

/**
 * PATCH /api/patients/{id}/
 * Modification partielle — PatientCreateUpdateSerializer.
 * La réceptionniste ne peut pas modifier (403 backend).
 *
 * @param {string} id
 * @param {Object} data
 */
export const updatePatient = (id, data) =>
  apiClient.patch(`${BASE}/${id}/`, data);

// ── Suppression / archivage ───────────────────────────────────────────────────

/**
 * DELETE /api/patients/{id}/
 * Soft delete → archivage (is_active=False).
 * Réponse : { detail: "Patient ... archivé." } (200)
 *
 * @param {string} id
 */
export const deletePatient = (id) =>
  apiClient.delete(`${BASE}/${id}/`);

/**
 * PATCH /api/patients/{id}/archiver/
 * Archivage explicite avec réponse détaillée.
 *
 * @param {string} id
 */
export const archiverPatient = (id) =>
  apiClient.patch(`${BASE}/${id}/archiver/`);

/**
 * PATCH /api/patients/{id}/restaurer/
 * Restaurer un patient archivé.
 *
 * @param {string} id
 */
export const restaurerPatient = (id) =>
  apiClient.patch(`${BASE}/${id}/restaurer/`);

// ── Validation ────────────────────────────────────────────────────────────────

/**
 * PATCH /api/patients/{id}/valider/
 * Accepter ou refuser un patient en attente (PENDING).
 * Réservé au dentiste propriétaire.
 *
 * Body (PatientValidationSerializer) :
 *   { decision: "ACCEPTE" | "REFUSE", refuse_raison?: string }
 *
 * @param {string} id
 * @param {string} decision        - "ACCEPTE" | "REFUSE"
 * @param {string} [refuseRaison]  - obligatoire si decision === "REFUSE"
 */
export const validerPatient = (id, decision, refuseRaison = "") =>
  apiClient.patch(`${BASE}/${id}/valider/`, {
    decision,
    refuse_raison: refuseRaison,
  });

// ── Note libre ────────────────────────────────────────────────────────────────

/**
 * PATCH /api/patients/{id}/note/
 * Auto-save de la note interne.
 *
 * @param {string} id
 * @param {string} noteGenerale
 */
export const saveNote = (id, noteGenerale) =>
  apiClient.patch(`${BASE}/${id}/note/`, { note_generale: noteGenerale });

// ── Dossier complet ───────────────────────────────────────────────────────────

/**
 * GET /api/patients/{id}/dossier/
 * Agrégation : patient + rendezvous + ordonnances + radios + dental_chart + treatments.
 *
 * @param {string} id
 */
export const getDossierPatient = (id) =>
  apiClient.get(`${BASE}/${id}/dossier/`);

// ── Statistiques ──────────────────────────────────────────────────────────────

/**
 * GET /api/patients/stats/
 * Retourne PatientStatsSerializer :
 * { total, actifs, archives, nouveaux_ce_mois, en_attente, refuses, mineurs, avec_alertes }
 */
export const getPatientStats = () =>
  apiClient.get(`${BASE}/stats/`);