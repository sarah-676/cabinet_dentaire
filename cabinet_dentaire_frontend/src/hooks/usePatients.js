/**
 * src/hooks/usePatients.js
 * ✅ CORRIGÉ : suppression de { data } — patientsAPI retourne data directement
 */

import { useCallback, useReducer, useState } from "react";
import * as API from "../api/patientsAPI";

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
            ? { ...p, statut: action.payload.statut, refuse_raison: action.payload.refuse_raison ?? p.refuse_raison }
            : p
        ),
      };
    default:
      return state;
  }
}

export function usePatients() {
  const [state,        dispatch]        = useReducer(reducer, init);
  const [stats,        setStats]        = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // ✅ CORRIGÉ : API.getPatients() retourne data directement (pas { data })
  const fetchPatients = useCallback(async (params = {}) => {
    dispatch({ type: "FETCH_START" });
    try {
      const data = await API.getPatients(params);
      const list = Array.isArray(data) ? data : (data.results ?? []);
      dispatch({ type: "FETCH_OK", payload: list });
      return list;
    } catch (err) {
      const msg = err?.response?.data?.detail ?? "Impossible de charger les patients.";
      dispatch({ type: "FETCH_ERROR", payload: msg });
      throw err;
    }
  }, []);

  // ✅ CORRIGÉ : API.getPatientStats() retourne data directement
  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const data = await API.getPatientStats();
      setStats(data);
      return data;
    } catch {
      // silencieux
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // ✅ CORRIGÉ : API.createPatient() retourne data directement
  const createPatient = useCallback(async (payload) => {
    const data = await API.createPatient(payload);
    dispatch({ type: "ADD", payload: data });
    return data;
  }, []);

  // ✅ CORRIGÉ : API.updatePatient() retourne data directement
  const updatePatient = useCallback(async (id, payload) => {
    const data = await API.updatePatient(id, payload);
    dispatch({ type: "UPDATE", payload: data });
    return data;
  }, []);

  const deletePatient = useCallback(async (id) => {
    await API.deletePatient(id);
    dispatch({ type: "REMOVE", payload: id });
  }, []);

  const archiverPatient = useCallback(async (id) => {
    await API.archiverPatient(id);
    dispatch({ type: "REMOVE", payload: id });
  }, []);

  const restaurerPatient = useCallback(async (id) => {
    await API.restaurerPatient(id);
    dispatch({ type: "REMOVE", payload: id });
  }, []);

  // ✅ CORRIGÉ : utilise la réponse backend (patient complet avec statut à jour)
  const validerPatient = useCallback(async (id, decision, refuseRaison = "") => {
    const data = await API.validerPatient(id, decision, refuseRaison);
    // ✅ data = patient sérialisé complet retourné par le backend
    // On met à jour avec les vraies données DB, pas juste "decision"
    dispatch({
      type: "SET_STATUT",
      payload: {
        id,
        statut:        data.statut        ?? decision,
        refuse_raison: data.refuse_raison ?? refuseRaison,
      },
    });
    return data;
  }, []);

  // ✅ CORRIGÉ : API.updateNote() retourne data directement
  const saveNote = useCallback(async (id, noteGenerale) => {
    const data = await API.updateNote(id, noteGenerale);
    dispatch({ type: "UPDATE", payload: { id, note_generale: data.note_generale } });
    return data;
  }, []);

  return {
    patients: state.patients,
    loading:  state.loading,
    error:    state.error,
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