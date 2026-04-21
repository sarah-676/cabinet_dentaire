/**
 * src/api/ordonnancesAPI.js
 * ──────────────────────────
 * Connexion : api_service/ordonnances/
 * Backend : OrdonnanceViewSet
 */

import api from "./axios";
const BASE = "/api/ordonnances";

export const getOrdonnances         = async (params = {}) => { const { data } = await api.get(`${BASE}/`, { params }); return data; };
export const getOrdonnance          = async (id)          => { const { data } = await api.get(`${BASE}/${id}/`);       return data; };
export const createOrdonnance       = async (payload)     => { const { data } = await api.post(`${BASE}/`, payload);   return data; };
export const updateOrdonnance       = async (id, payload) => { const { data } = await api.patch(`${BASE}/${id}/`, payload); return data; };
export const deleteOrdonnance       = async (id)          => { const { data } = await api.delete(`${BASE}/${id}/`);    return data; };
export const getOrdonnanceStats     = async ()            => { const { data } = await api.get(`${BASE}/stats/`);       return data; };
export const getOrdonnancesPatient  = async (patientId)   => { const { data } = await api.get(`${BASE}/patient/${patientId}/`); return data; };
export const annulerOrdonnance      = async (id)          => { const { data } = await api.patch(`${BASE}/${id}/annuler/`);     return data; };
export const archiverOrdonnance     = async (id)          => { const { data } = await api.patch(`${BASE}/${id}/archiver/`);    return data; };