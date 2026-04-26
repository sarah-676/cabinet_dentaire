/**
 * src/api/authAPI.js — VERSION CORRIGÉE
 * ───────────────────────────────────────
 * Correction critique : préfixe "/auth" et non "/api/auth"
 * (axios.js a déjà baseURL = ".../api", pas besoin de le répéter)
 */

import api from "./axios";

const AUTH = "/auth";

export const login = async (email, password) => {
  const { data } = await api.post(`${AUTH}/login/`, { email, password });
  return data;
};

export const logout = async (refreshToken) => {
  await api.post(`${AUTH}/logout/`, { refresh: refreshToken });
};

export const refreshToken = async (refresh) => {
  const { data } = await api.post(`${AUTH}/token/refresh/`, { refresh });
  return data.access;
};

export const verifyToken = async () => {
  const { data } = await api.get(`${AUTH}/verify/`);
  return data;
};

export const getProfile = async () => {
  const { data } = await api.get(`${AUTH}/profile/`);
  return data;
};

export const updateProfile = async (payload) => {
  const { data } = await api.patch(`${AUTH}/profile/`, payload);
  return data;
};

export const changePassword = async (payload) => {
  const { data } = await api.post(`${AUTH}/profile/change-password/`, payload);
  return data;
};

export const getUsers = async (params = {}) => {
  const { data } = await api.get(`${AUTH}/users/`, { params });
  return data;
};

export const getDentistes = async () => {
  const { data } = await api.get(`${AUTH}/users/dentistes/`);
  return data;
};

export const getReceptionnistes = async () => {
  const { data } = await api.get(`${AUTH}/users/receptionnistes/`);
  return data;
};

export const getUserStats = async () => {
  const { data } = await api.get(`${AUTH}/users/stats/`);
  return data;
};

export const createUser = async (payload) => {
  const { data } = await api.post(`${AUTH}/users/`, payload);
  return data;
};

export const updateUser = async (id, payload) => {
  const { data } = await api.patch(`${AUTH}/users/${id}/`, payload);
  return data;
};

export const deleteUser = async (id) => {
  const { data } = await api.delete(`${AUTH}/users/${id}/`);
  return data;
};

export const toggleUserActif = async (id) => {
  const { data } = await api.patch(`${AUTH}/users/${id}/toggle-actif/`);
  return data;
};
