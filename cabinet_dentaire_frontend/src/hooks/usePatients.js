/**
 * hooks/usePatients.js
 * ======================
 * Hook métier — gestion des patients.
 *
 * Expose :
 *   patients, loading, error         → liste courante
 *   stats                            → PatientStatsSerializer
 *   fetchPatients(params)            → charger / filtrer
 *   fetchStats()                     → recharger les stats
 *   createPatient(data)              → POST + mise à jour liste
 *   updatePatient(id, data)          → PATCH + mise à jour liste
 *   deletePatient(id)                → DELETE soft + retrait liste
 *   validerPatient(id, dec, raison)  → PATCH /valider/
 *   saveNote(id, note)               → PATCH /note/
 *   archiverPatient(id)              → PATCH /archiver/
 *   restaurerPatient(id)             → PATCH /restaurer/
 *
 * Compatible avec PatientListSerializer et PatientDetailSerializer.
 */

import { useCallback, useReducer, useState } from "react";
import * as API from "@/api/patientsAPI";

// ── Reducer ───────────────────────────────────────────────────────────────────

const init = { patients: [], loading: false, error: null };

function reducer(state, action) {
  switch (action.type) {
    case "FETCH_START":
      return { ...state, loading: true, error: null };
    case "FETCH_OK":
      return { ...state, loading: false, patients: action.payload };
    case "FETCH_ERROR":
      return { ...state, loading: false, error: action.payload };
    case "ADD":
      return { ...state, patients: [action.payload, ...state.patients] };
    case "UPDATE":
      return {
        ...state,
        patients: state.patients.map((p) =>
          p.id === action.payload.id ? { ...p, ...action.payload } : p
        ),
      };
    case "REMOVE":
      return {
        ...state,
        patients: state.patients.filter((p) => p.id !== action.payload),
      };
    case "SET_STATUT":
      return {
        ...state,
        patients: state.patients.map((p) =>
          p.id === action.payload.id
            ? { ...p, statut: action.payload.statut }
            : p
        ),
      };
    default:
      return state;
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function usePatients() {
  const [state,    dispatch] = useReducer(reducer, init);
  const [stats,    setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // ── Chargement liste ───────────────────────────────────────────────

  const fetchPatients = useCallback(async (params = {}) => {
    dispatch({ type: "FETCH_START" });
    try {
      const { data } = await API.getPatients(params);
      // Supporte la pagination DRF { results: [...] } et les tableaux directs
      const list = Array.isArray(data) ? data : (data.results ?? []);
      dispatch({ type: "FETCH_OK", payload: list });
      return list;
    } catch (err) {
      const msg =
        err?.response?.data?.detail ?? "Impossible de charger les patients.";
      dispatch({ type: "FETCH_ERROR", payload: msg });
      throw err;
    }
  }, []);

  // ── Stats ──────────────────────────────────────────────────────────

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const { data } = await API.getPatientStats();
      setStats(data);
      return data;
    } catch {
      // silencieux — dashboard affiche "--" si indisponible
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // ── Créer ──────────────────────────────────────────────────────────

  const createPatient = useCallback(async (patientData) => {
    const { data } = await API.createPatient(patientData);
    dispatch({ type: "ADD", payload: data });
    return data;
  }, []);

  // ── Modifier ───────────────────────────────────────────────────────

  const updatePatient = useCallback(async (id, patientData) => {
    const { data } = await API.updatePatient(id, patientData);
    dispatch({ type: "UPDATE", payload: data });
    return data;
  }, []);

  // ── Archiver (soft delete) ─────────────────────────────────────────

  const deletePatient = useCallback(async (id) => {
    await API.deletePatient(id);
    dispatch({ type: "REMOVE", payload: id });
  }, []);

  const archiverPatient = useCallback(async (id) => {
    await API.archiverPatient(id);
    dispatch({ type: "REMOVE", payload: id });
  }, []);

  // ── Restaurer ──────────────────────────────────────────────────────

  const restaurerPatient = useCallback(async (id) => {
    await API.restaurerPatient(id);
    dispatch({ type: "REMOVE", payload: id });
  }, []);

  // ── Valider (accepter / refuser) ───────────────────────────────────

  const validerPatient = useCallback(async (id, decision, refuseRaison = "") => {
    const { data } = await API.validerPatient(id, decision, refuseRaison);
    dispatch({ type: "SET_STATUT", payload: { id, statut: decision } });
    return data;
  }, []);

  // ── Note ───────────────────────────────────────────────────────────

  const saveNote = useCallback(async (id, noteGenerale) => {
    const { data } = await API.saveNote(id, noteGenerale);
    dispatch({ type: "UPDATE", payload: { id, note_generale: data.note_generale } });
    return data;
  }, []);

  // ── Retour ─────────────────────────────────────────────────────────

  return {
    patients:     state.patients,
    loading:      state.loading,
    error:        state.error,
    stats,
    statsLoading,
    fetchPatients,
    fetchStats,
    createPatient,
    updatePatient,
    deletePatient,
    archiverPatient,
    restaurerPatient,
    validerPatient,
    saveNote,
  };
}