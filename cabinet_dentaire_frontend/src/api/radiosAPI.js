/**
 * src/api/radiosAPI.js
 * Upload multipart/form-data pour les images radiographiques.
 */
import api from "./axios";
const BASE = "/api/radios";

export const getRadios     = async (params = {}) => { const { data } = await api.get(`${BASE}/`, { params }); return data; };
export const getRadio      = async (id)          => { const { data } = await api.get(`${BASE}/${id}/`);       return data; };
export const getRadioStats = async ()            => { const { data } = await api.get(`${BASE}/stats/`);       return data; };

/** Upload — multipart/form-data */
export const uploadRadio = async (formData) => {
  const { data } = await api.post(`${BASE}/`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
};

export const updateRadio  = async (id, payload) => { const { data } = await api.patch(`${BASE}/${id}/`, payload);    return data; };
export const deleteRadio  = async (id)          => { const { data } = await api.delete(`${BASE}/${id}/`);            return data; };

/** Lancer l'analyse IA */
export const analyserRadio = async (id) => {
  const { data } = await api.post(`${BASE}/${id}/analyser/`);
  return data;
};