/**
 * hooks/useDashboard.js
 * ======================
 * Hook de statistiques pour les tableaux de bord.
 * Charge en parallèle les stats patients ET les stats RDV.
 *
 * Utilise :
 *   GET /api/patients/stats/    → actifs, en_attente, nouveaux_ce_mois, ...
 *   GET /api/rendezvous/stats/  → aujourd_hui, a_venir, en_attente, ...
 *   GET /api/rendezvous/?aujourd_hui=true&statut=ACCEPTE  → RDV du jour
 *   GET /api/patients/?statut=PENDING   → patients à valider
 *   GET /api/rendezvous/?statut=PENDING → RDV à valider
 *
 * Compatible admin, dentiste, réceptionniste.
 */

import { useState, useEffect, useCallback } from 'react'
import { getStatsRDV, getRDVs } from '../api/rendezvousAPI'
import { getPatientStats, getPatients } from '../api/patientsAPI'

export function useDashboard() {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [pStats, rStats, todayRdvs, pendingPatients, pendingRdvs] =
        await Promise.all([
          getPatientStats(),
          getStatsRDV(),
          getRDVs({ aujourd_hui: 'true', statut: 'ACCEPTE', ordering: 'date_heure' }),
          getPatients({ statut: 'PENDING' }),
          getRDVs({ statut: 'PENDING' }),
        ])

      const todayList    = todayRdvs.data.results    ?? todayRdvs.data
      const pendPatList  = pendingPatients.data.results ?? pendingPatients.data
      const pendRdvList  = pendingRdvs.data.results  ?? pendingRdvs.data

      setData({
        patientStats:     pStats.data,
        rdvStats:         rStats.data,
        rdvAujourdhui:    Array.isArray(todayList)   ? todayList.slice(0, 10)  : [],
        pendingPatients:  Array.isArray(pendPatList) ? pendPatList.slice(0, 5) : [],
        pendingRdvs:      Array.isArray(pendRdvList) ? pendRdvList.slice(0, 5) : [],
        totalDemandes:    (pendPatList?.length || 0) + (pendRdvList?.length || 0),
      })
    } catch (err) {
      const d = err?.response?.data
      setError(d?.detail || err?.message || 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [])

  return { data, loading, error, reload: load }
}