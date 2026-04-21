/**
 * src/api/rendezvousAPI.js
 */
import api from "./axios";
const BASE = "/api/rendezvous";

export const getRendezVous      = async (params = {}) => { const { data } = await api.get(`${BASE}/`, { params }); return data; };
export const getRendezVousById  = async (id)          => { const { data } = await api.get(`${BASE}/${id}/`);       return data; };
export const createRendezVous   = async (payload)     => { const { data } = await api.post(`${BASE}/`, payload);   return data; };
export const updateRendezVous   = async (id, payload) => { const { data } = await api.patch(`${BASE}/${id}/`, payload); return data; };
export const deleteRendezVous   = async (id)          => { const { data } = await api.delete(`${BASE}/${id}/`);    return data; };
export const getCalendar        = async (params = {}) => { const { data } = await api.get(`${BASE}/calendar/`, { params }); return data; };
export const getRendezVousStats = async ()            => { const { data } = await api.get(`${BASE}/stats/`);       return data; };
export const validerRendezVous  = async (id, payload) => { const { data } = await api.patch(`${BASE}/${id}/valider/`, payload); return data; };
export const annulerRendezVous  = async (id, raison)  => { const { data } = await api.patch(`${BASE}/${id}/annuler/`, { raison }); return data; };
export const terminerRendezVous = async (id)          => { const { data } = await api.patch(`${BASE}/${id}/terminer/`); return data; };