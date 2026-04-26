/**
 * src/api/patientsAPI.js — VERSION CORRIGÉE
 * ───────────────────────────────────────────
 * Correction : "/patients" au lieu de "/api/patients"
 * (axios baseURL = ".../api" — pas besoin de le répéter)
 */

import api from "./axios";

const BASE = "/patients";

export const getPatients = async (params = {}) => {
  const { data } = await api.get(`${BASE}/`, { params });
  return data;
};

export const getPatient = async (id) => {
  const { data } = await api.get(`${BASE}/${id}/`);
  return data;
};

export const createPatient = async (payload) => {
  const { data } = await api.post(`${BASE}/`, payload);
  return data;
};

export const updatePatient = async (id, payload) => {
  const { data } = await api.patch(`${BASE}/${id}/`, payload);
  return data;
};

export const deletePatient = async (id) => {
  const { data } = await api.delete(`${BASE}/${id}/`);
  return data;
};

export const getPatientStats = async () => {
  const { data } = await api.get(`${BASE}/stats/`);
  return data;
};

export const getDossierPatient = async (id) => {
  const { data } = await api.get(`${BASE}/${id}/dossier/`);
  return data;
};

export const validerPatient = async (id, decision, refuse_raison = "") => {
  const { data } = await api.patch(`${BASE}/${id}/valider/`, {
    decision,
    refuse_raison,
  });
  return data;
};

export const archiverPatient = async (id) => {
  const { data } = await api.patch(`${BASE}/${id}/archiver/`);
  return data;
};

export const restaurerPatient = async (id) => {
  const { data } = await api.patch(`${BASE}/${id}/restaurer/`);
  return data;
};

export const updateNote = async (id, note_generale) => {
  const { data } = await api.patch(`${BASE}/${id}/note/`, { note_generale });
  return data;
};
