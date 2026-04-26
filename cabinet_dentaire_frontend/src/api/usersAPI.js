/**
 * api/usersAPI.js
 * =================
 * Couche HTTP — gestion des utilisateurs (admin).
 * Paths relatifs à axios baseURL (…/api).
 */

import apiClient from "./axios";

const BASE = "/auth/users";

export const getUsers = (params = {}) =>
  apiClient.get(`${BASE}/`, { params });

export const getUserById = (id) =>
  apiClient.get(`${BASE}/${id}/`);

export const createUser = (userData) =>
  apiClient.post(`${BASE}/`, userData);

export const updateUser = (id, data) =>
  apiClient.patch(`${BASE}/${id}/`, data);

export const updateUserWithAvatar = (id, formData) =>
  apiClient.patch(`${BASE}/${id}/`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

export const deleteUser = (id) =>
  apiClient.delete(`${BASE}/${id}/`);

export const toggleUserActif = (id) =>
  apiClient.patch(`${BASE}/${id}/toggle-actif/`);

export const getDentistes = () =>
  apiClient.get(`${BASE}/dentistes/`);

export const getReceptionnistes = () =>
  apiClient.get(`${BASE}/receptionnistes/`);

export const getUserStats = () =>
  apiClient.get(`${BASE}/stats/`);
