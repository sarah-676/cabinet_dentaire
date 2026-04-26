/**
 * src/api/radiosAPI.js
 *
 * ✅ FIX 3 : ajout de getImageUrl()
 *
 * Problème :
 *   Les images /media/ ne doivent PAS passer par l'instance axios (qui ajoute
 *   baseURL="/api" et le header Authorization).
 *   Le navigateur doit les charger directement via une balise <img src="...">.
 *
 * Solution :
 *   getImageUrl(radio.image) construit l'URL absolue correcte :
 *     "media/radios/.../image.png"  →  "http://localhost:8000/media/radios/.../image.png"
 *     "/media/radios/.../image.png" →  "http://localhost:8000/media/radios/.../image.png"
 *
 * Usage dans les composants :
 *   import { getImageUrl } from "../../api/radiosAPI";
 *   <img src={getImageUrl(radio.image)} alt="radio" />
 */

import api from "./axios";

const BASE = "/radios";

// ── Helper URL media ──────────────────────────────────────────────────────────
// Construit l'URL absolue d'une image media sans passer par axios.
// Fonctionne que radio.image soit :
//   "media/radios/..."          (sans slash initial — cas Django par défaut)
//   "/media/radios/..."         (avec slash initial)
//   "http://localhost:8000/..." (URL déjà absolue)

const API_ORIGIN =
  (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000")
    .replace(/\/api\/?$/, "")   // retire le "/api" final s'il est présent
    .replace(/\/+$/, "");       // retire les slashes finaux

export function getImageUrl(imagePath) {
  if (!imagePath) return null;

  // Déjà une URL absolue → on la retourne telle quelle
  if (imagePath.startsWith("http://") || imagePath.startsWith("https://")) {
    return imagePath;
  }

  // Normalise le slash initial
  const normalized = imagePath.startsWith("/") ? imagePath : `/${imagePath}`;
  return `${API_ORIGIN}${normalized}`;
}

// ── API calls ─────────────────────────────────────────────────────────────────

// ✅ Upload radio — multipart/form-data
// Payload attendu par RadioUploadSerializer :
//   patient     (UUID)
//   image       (File)
//   type_radio  (PANORAMIQUE|PERIAPICALE|...)
//   date_prise  (YYYY-MM-DD, optionnel)
//   description (optionnel)
export const uploadRadio = (data) =>
  api.post(`${BASE}/`, data, {
    headers: { "Content-Type": "multipart/form-data" },
  });

export const getRadios = async (params = {}) => {
  const { data } = await api.get(`${BASE}/`, { params });
  return data;
};

export const getRadio = async (id) => {
  const { data } = await api.get(`${BASE}/${id}/`);
  return data;
};

export const updateRadio = async (id, payload) => {
  const { data } = await api.patch(`${BASE}/${id}/`, payload);
  return data;
};

export const deleteRadio = async (id) => {
  await api.delete(`${BASE}/${id}/`);
};

// ✅ Lancer l'analyse IA
export const analyserRadio = async (id) => {
  const { data } = await api.post(`${BASE}/${id}/analyser/`);
  return data;
};

export const getRadioStats = async () => {
  const { data } = await api.get(`${BASE}/stats/`);
  return data;
};