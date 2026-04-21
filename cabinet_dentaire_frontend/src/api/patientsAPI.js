/**
 * src/api/patientsAPI.js
 * ───────────────────────
 * Appels vers api_service/patients/ via le gateway.
 * Base : /api/patients/
 */

import api from "./axios";

const BASE = "/api/patients";

/**
 * GET /api/patients/
 * params : { search, statut, groupe_sanguin, sexe, ordering, page }
 */
export const getPatients = async (params = {}) => {
  const { data } = await api.get(`${BASE}/`, { params });
  return data;
};

/**
 * GET /api/patients/{id}/
 */
export const getPatient = async (id) => {
  const { data } = await api.get(`${BASE}/${id}/`);
  return data;
};

/**
 * POST /api/patients/
 * Dentiste → statut ACCEPTE auto
 * Réceptionniste → body doit contenir dentiste_id → statut PENDING
 */
export const createPatient = async (payload) => {
  const { data } = await api.post(`${BASE}/`, payload);
  return data;
};

/**
 * PATCH /api/patients/{id}/
 */
export const updatePatient = async (id, payload) => {
  const { data } = await api.patch(`${BASE}/${id}/`, payload);
  return data;
};

/**
 * DELETE /api/patients/{id}/   → soft delete (archivage)
 */
export const deletePatient = async (id) => {
  const { data } = await api.delete(`${BASE}/${id}/`);
  return data;
};

/**
 * GET /api/patients/stats/
 * Retourne { total, actifs, archives, nouveaux_ce_mois, en_attente, refuses, mineurs, avec_alertes }
 */
export const getPatientStats = async () => {
  const { data } = await api.get(`${BASE}/stats/`);
  return data;
};

/**
 * GET /api/patients/{id}/dossier/
 * Retourne { patient, rendezvous, ordonnances, radios, dental_chart, treatments }
 */
export const getDossierPatient = async (id) => {
  const { data } = await api.get(`${BASE}/${id}/dossier/`);
  return data;
};

/**
 * PATCH /api/patients/{id}/valider/
 * body : { decision: "ACCEPTE" | "REFUSE", refuse_raison?: "..." }
 * Utilisé par le dentiste pour valider un patient PENDING.
 */
export const validerPatient = async (id, decision, refuse_raison = "") => {
  const { data } = await api.patch(`${BASE}/${id}/valider/`, {
    decision,
    refuse_raison,
  });
  return data;
};

/**
 * PATCH /api/patients/{id}/archiver/
 */
export const archiverPatient = async (id) => {
  const { data } = await api.patch(`${BASE}/${id}/archiver/`);
  return data;
};

/**
 * PATCH /api/patients/{id}/restaurer/
 */
export const restaurerPatient = async (id) => {
  const { data } = await api.patch(`${BASE}/${id}/restaurer/`);
  return data;
};

/**
 * PATCH /api/patients/{id}/note/
 * body : { note_generale: "..." }
 */
export const updateNote = async (id, note_generale) => {
  const { data } = await api.patch(`${BASE}/${id}/note/`, { note_generale });
  return data;
};