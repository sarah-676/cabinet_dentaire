/**
 * src/hooks/usePatients.js
 * ─────────────────────────
 * Hook métier — gestion des patients.
 *
 * Encapsule toute la logique d'appel API patients :
 *   - Chargement avec filtres
 *   - CRUD complet
 *   - Validation (accepter / refuser)
 *   - Stats
 *
 * Champs retournés par PatientListSerializer (backend) :
 *   id, nom_complet, nom, prenom, age, sexe, telephone,
 *   date_naissance, groupe_sanguin, statut, is_active,
 *   created_at, nb_alertes_critiques
 *
 * Stats retournées par /patients/stats/ :
 *   total, actifs, archives, nouveaux_ce_mois,
 *   en_attente, refuses, mineurs, avec_alertes
 */

import { useState, useCallback, useEffect } from "react";
import {
  getPatients,
  getPatientStats,
  createPatient,
  updatePatient,
  deletePatient,
  validerPatient,
  archiverPatient,
  restaurerPatient,
} from "../api/patientsAPI";

export function usePatients(initialFilters = {}) {
  const [patients,  setPatients]  = useState([]);
  const [stats,     setStats]     = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [error,     setError]     = useState(null);
  const [filters,   setFilters]   = useState(initialFilters);
  const [pagination, setPagination] = useState({ count: 0, next: null, previous: null });

  // ── Charger la liste ────────────────────────────────────────────────
  const fetchPatients = useCallback(async (overrideFilters = null) => {
    setLoading(true);
    setError(null);
    try {
      const params = overrideFilters ?? filters;
      const data   = await getPatients(params);

      // DRF peut retourner { results, count, next, previous } ou un tableau direct
      if (Array.isArray(data)) {
        setPatients(data);
        setPagination({ count: data.length, next: null, previous: null });
      } else {
        setPatients(data.results || []);
        setPagination({
          count:    data.count    || 0,
          next:     data.next     || null,
          previous: data.previous || null,
        });
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Erreur lors du chargement des patients.");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // ── Charger les stats ───────────────────────────────────────────────
  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const data = await getPatientStats();
      setStats(data);
    } catch {
      // silencieux — les stats ne bloquent pas l'UI
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // Chargement initial
  useEffect(() => {
    fetchPatients();
  }, [filters]);

  // ── Recherche (debounce intégré dans le composant appelant) ─────────
  const search = useCallback((query) => {
    setFilters((prev) => ({ ...prev, search: query, page: 1 }));
  }, []);

  const filterByStatut = useCallback((statut) => {
    setFilters((prev) => ({ ...prev, statut: statut || undefined, page: 1 }));
  }, []);

  // ── CRUD ────────────────────────────────────────────────────────────

  const createPatientFn = useCallback(async (payload) => {
    const data = await createPatient(payload);
    await fetchPatients();
    return data;
  }, [fetchPatients]);

  const updatePatientFn = useCallback(async (id, payload) => {
    const data = await updatePatient(id, payload);
    setPatients((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...data } : p))
    );
    return data;
  }, []);

  const deletePatientFn = useCallback(async (id) => {
    await deletePatient(id);
    setPatients((prev) => prev.filter((p) => p.id !== id));
  }, []);

  // ── Validation (dentiste) ────────────────────────────────────────────
  const validerPatientFn = useCallback(async (id, decision, raison = "") => {
    const data = await validerPatient(id, decision, raison);
    // Mettre à jour le statut localement
    setPatients((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, statut: decision } : p
      )
    );
    return data;
  }, []);

  const archiverPatientFn = useCallback(async (id) => {
    await archiverPatient(id);
    setPatients((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const restaurerPatientFn = useCallback(async (id) => {
    const data = await restaurerPatient(id);
    await fetchPatients();
    return data;
  }, [fetchPatients]);

  return {
    // Données
    patients,
    stats,
    pagination,
    loading,
    statsLoading,
    error,
    filters,
    // Actions
    fetchPatients,
    fetchStats,
    search,
    filterByStatut,
    setFilters,
    createPatient:  createPatientFn,
    updatePatient:  updatePatientFn,
    deletePatient:  deletePatientFn,
    validerPatient: validerPatientFn,
    archiverPatient: archiverPatientFn,
    restaurerPatient: restaurerPatientFn,
  };
}