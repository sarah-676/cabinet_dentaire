/**
 * src/hooks/useDashboard.js — VERSION CORRIGÉE
 */

import { useState, useEffect, useCallback } from "react";
// ✅ CORRIGÉ : noms alignés avec rendezvousAPI.js
import { getRendezVousStats, getRendezVous } from "../api/rendezvousAPI";
import { getPatientStats, getPatients }      from "../api/patientsAPI";

export function useDashboard() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [pStats, rStats, todayRdvs, pendingPatients, pendingRdvs] =
        await Promise.all([
          getPatientStats(),
          getRendezVousStats(),
          getRendezVous({ aujourd_hui: "true", statut: "ACCEPTE", ordering: "date_heure" }),
          getPatients({ statut: "PENDING" }),
          getRendezVous({ statut: "PENDING" }),
        ]);

      const todayList = todayRdvs?.results ?? todayRdvs ?? [];
      const pendPatList = pendingPatients?.results ?? pendingPatients ?? [];
      const pendRdvList = pendingRdvs?.results ?? pendingRdvs ?? [];

      setData({
        patientStats: pStats ?? {},
        rdvStats: rStats ?? {},
        rdvAujourdhui: Array.isArray(todayList) ? todayList.slice(0, 10) : [],
        pendingPatients: Array.isArray(pendPatList) ? pendPatList.slice(0, 5) : [],
        pendingRdvs: Array.isArray(pendRdvList) ? pendRdvList.slice(0, 5) : [],
        totalDemandes: (pendPatList?.length || 0) + (pendRdvList?.length || 0),
      });
    } catch (err) {
      const d = err?.response?.data;
      setError(d?.detail || err?.message || "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, []);
  return { data, loading, error, reload: load };
}
