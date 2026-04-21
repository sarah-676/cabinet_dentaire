/**
 * src/api/traitementsAPI.js
 * ─────────────────────────
 * Connexion : api_service/treatments/
 * Backend : TraitementViewSet + SeanceSoin
 */

import api from "./axios";
const BASE = "/api/treatments";

/** GET /api/treatments/  — liste filtrée */
export const getTraitements = async (params = {}) => {
  const { data } = await api.get(`${BASE}/`, { params });
  return data;
};

/** GET /api/treatments/{id}/  — détail + séances */
export const getTraitement = async (id) => {
  const { data } = await api.get(`${BASE}/${id}/`);
  return data;
};

/** POST /api/treatments/  — créer */
export const createTraitement = async (payload) => {
  const { data } = await api.post(`${BASE}/`, payload);
  return data;
};

/** PATCH /api/treatments/{id}/  — modifier */
export const updateTraitement = async (id, payload) => {
  const { data } = await api.patch(`${BASE}/${id}/`, payload);
  return data;
};

/** DELETE /api/treatments/{id}/  — soft delete */
export const deleteTraitement = async (id) => {
  const { data } = await api.delete(`${BASE}/${id}/`);
  return data;
};

/** GET /api/treatments/stats/ */
export const getTraitementStats = async () => {
  const { data } = await api.get(`${BASE}/stats/`);
  return data;
};

/** GET /api/treatments/par-patient/{patient_id}/ */
export const getTraitementsParPatient = async (patientId) => {
  const { data } = await api.get(`${BASE}/par-patient/${patientId}/`);
  return data;
};

/** GET /api/treatments/par-dent/{numero_dent}/ — pour dental chart */
export const getTraitementsParDent = async (numeroDent) => {
  const { data } = await api.get(`${BASE}/par-dent/${numeroDent}/`);
  return data;
};

/** POST /api/treatments/{id}/seances/  — ajouter une séance */
export const ajouterSeance = async (id, payload) => {
  const { data } = await api.post(`${BASE}/${id}/seances/`, payload);
  return data;
};

/** GET /api/treatments/{id}/seances/ */
export const getSeances = async (id) => {
  const { data } = await api.get(`${BASE}/${id}/seances/`);
  return data;
};

/** PATCH /api/treatments/{id}/demarrer/ → PLANIFIE → EN_COURS */
export const demarrerTraitement = async (id) => {
  const { data } = await api.patch(`${BASE}/${id}/demarrer/`);
  return data;
};

/** PATCH /api/treatments/{id}/terminer/ → TERMINE */
export const terminerTraitement = async (id) => {
  const { data } = await api.patch(`${BASE}/${id}/terminer/`);
  return data;
};

/** PATCH /api/treatments/{id}/abandonner/  — raison obligatoire */
export const abandonnerTraitement = async (id, raison) => {
  const { data } = await api.patch(`${BASE}/${id}/abandonner/`, { raison });
  return data;
};