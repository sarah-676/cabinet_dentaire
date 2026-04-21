/**
 * src/api/notificationsAPI.js
 */
import api from "./axios";
const BASE = "/api/notifications";

export const getNotifications = async (params = {}) => {
  const { data } = await api.get(`${BASE}/`, { params });
  return data;
};
export const getNotificationStats = async () => {
  const { data } = await api.get(`${BASE}/stats/`);
  return data;
};
export const marquerLue = async (id) => {
  const { data } = await api.patch(`${BASE}/${id}/lire/`);
  return data;
};
export const marquerToutesLues = async () => {
  const { data } = await api.post(`${BASE}/lire-tout/`);
  return data;
};
export const deleteNotification = async (id) => {
  const { data } = await api.delete(`${BASE}/${id}/`);
  return data;
};