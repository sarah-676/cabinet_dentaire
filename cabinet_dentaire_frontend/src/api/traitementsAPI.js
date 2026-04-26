/**
 * src/api/traitementsAPI.js
 * ─────────────────────────
 * Connexion : api_service/treatments/
 */

import api from "./axios";
const BASE = "/treatments";

export const getTraitements = async (params = {}) => {
  const { data } = await api.get(`${BASE}/`, { params });
  return data;
};

export const getTraitement = async (id) => {
  const { data } = await api.get(`${BASE}/${id}/`);
  return data;
};

export const createTraitement = async (payload) => {
  const { data } = await api.post(`${BASE}/`, payload);
  return data;
};

export const updateTraitement = async (id, payload) => {
  const { data } = await api.patch(`${BASE}/${id}/`, payload);
  return data;
};

export const deleteTraitement = async (id) => {
  const { data } = await api.delete(`${BASE}/${id}/`);
  return data;
};

export const getTraitementStats = async () => {
  const { data } = await api.get(`${BASE}/stats/`);
  return data;
};

export const getTraitementsParPatient = async (patientId) => {
  const { data } = await api.get(`${BASE}/par-patient/${patientId}/`);
  return data;
};

export const getTraitementsParDent = async (numeroDent) => {
  const { data } = await api.get(`${BASE}/par-dent/${numeroDent}/`);
  return data;
};

export const ajouterSeance = async (id, payload) => {
  const { data } = await api.post(`${BASE}/${id}/seances/`, payload);
  return data;
};

export const getSeances = async (id) => {
  const { data } = await api.get(`${BASE}/${id}/seances/`);
  return data;
};

export const demarrerTraitement = async (id) => {
  const { data } = await api.patch(`${BASE}/${id}/demarrer/`);
  return data;
};

export const terminerTraitement = async (id) => {
  const { data } = await api.patch(`${BASE}/${id}/terminer/`);
  return data;
};

export const abandonnerTraitement = async (id, raison) => {
  const { data } = await api.patch(`${BASE}/${id}/abandonner/`, { raison });
  return data;
};
