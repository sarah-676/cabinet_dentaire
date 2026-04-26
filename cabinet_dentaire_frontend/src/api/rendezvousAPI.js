/**
 * src/api/rendezvousAPI.js
 */
import api from "./axios";
const BASE = "/rendezvous";

const EMPTY_LIST_RESPONSE = { count: 0, results: [] };
const EMPTY_STATS_RESPONSE = {
  total: 0,
  aujourd_hui: 0,
  cette_semaine: 0,
  en_attente: 0,
};

function shouldFallback(error) {
  const status = error?.response?.status;
  return status === 404 || status === 501;
}

function unavailableError() {
  const err = new Error("Le module rendez-vous n'est pas activé sur le backend.");
  err.code = "RENDEZVOUS_UNAVAILABLE";
  return err;
}

async function withFallback(request, fallbackData, allowFallback = true) {
  try {
    const { data } = await request();
    return data;
  } catch (error) {
    if (allowFallback && shouldFallback(error)) return fallbackData;
    throw error;
  }
}

export const getRendezVous = async (params = {}) =>
  withFallback(() => api.get(`${BASE}/`, { params }), EMPTY_LIST_RESPONSE);

export const getRendezVousById = async (id) =>
  withFallback(() => api.get(`${BASE}/${id}/`), null);

export const createRendezVous = async (payload) =>
  withFallback(() => api.post(`${BASE}/`, payload), unavailableError(), false);

export const updateRendezVous = async (id, payload) =>
  withFallback(() => api.patch(`${BASE}/${id}/`, payload), unavailableError(), false);

export const deleteRendezVous = async (id) =>
  withFallback(() => api.delete(`${BASE}/${id}/`), unavailableError(), false);

export const getCalendar = async (params = {}) =>
  withFallback(() => api.get(`${BASE}/calendar/`, { params }), EMPTY_LIST_RESPONSE);

export const getRendezVousStats = async () =>
  withFallback(() => api.get(`${BASE}/stats/`), EMPTY_STATS_RESPONSE);

export const validerRendezVous = async (id, payload) =>
  withFallback(() => api.patch(`${BASE}/${id}/valider/`, payload), unavailableError(), false);

export const annulerRendezVous = async (id, raison) =>
  withFallback(() => api.patch(`${BASE}/${id}/annuler/`, { raison }), unavailableError(), false);

export const terminerRendezVous = async (id) =>
  withFallback(() => api.patch(`${BASE}/${id}/terminer/`), unavailableError(), false);
