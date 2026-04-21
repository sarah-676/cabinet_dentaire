/**
 * hooks/useRendezVous.js
 * =======================
 * Hook principal pour la gestion des rendez-vous.
 * Gère : liste paginée, CRUD, valider, annuler, terminer.
 *
 * Compatibilité backend :
 *   - Pagination DRF  → data.results ?? data
 *   - DELETE retourne HTTP 200, pas 204
 *   - valider() envoie { decision, refuse_raison }
 *   - annuler() envoie { raison } (pas refuse_raison)
 *   - terminer() envoie corps vide {}
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  getRDVs,
  createRDV,
  updateRDV,
  deleteRDV,
  validerRDV,
  annulerRDV,
  terminerRDV,
  getStatsRDV,
} from '../api/rendezvousAPI'

// ── Helper d'extraction des erreurs backend ────────────────────────────────────
function extractError(err) {
  const d = err?.response?.data
  if (!d) return err?.message || 'Erreur réseau'
  if (typeof d === 'string') return d
  if (d.detail) return d.detail
  if (d.non_field_errors) return d.non_field_errors[0]
  // Erreur de champ : renvoyer la première
  const first = Object.entries(d)[0]
  if (first) return `${first[0]}: ${Array.isArray(first[1]) ? first[1][0] : first[1]}`
  return 'Erreur de validation'
}

// ── Hook liste + CRUD ─────────────────────────────────────────────────────────

export function useRendezVous(initialFilters = {}) {
  const [rdvs,    setRdvs]    = useState([])
  const [total,   setTotal]   = useState(0)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const [filters, setFilters] = useState(initialFilters)

  // Debounce ref pour la recherche
  const debounceRef = useRef(null)

  const load = useCallback(async (params = {}) => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await getRDVs({ ...filters, ...params })
      const list = data.results ?? data
      setRdvs(Array.isArray(list) ? list : [])
      setTotal(data.count ?? (Array.isArray(list) ? list.length : 0))
    } catch (err) {
      setError(extractError(err))
      setRdvs([])
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => { load() }, [filters])

  // ── Recherche avec debounce 400ms ─────────────────────────────────
  const rechercher = useCallback((query) => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setFilters(f => ({ ...f, search: query || undefined }))
    }, 400)
  }, [])

  const filtrer = useCallback((newFilters) => {
    setFilters(f => ({ ...f, ...newFilters }))
  }, [])

  const resetFiltres = useCallback(() => {
    setFilters(initialFilters)
  }, [initialFilters])

  // ── CRUD ──────────────────────────────────────────────────────────

  /** POST /api/rendezvous/
   *  Champs : patient, date_heure, duree_minutes, type_soin,
   *           priorite, motif, note_interne, instructions_patient
   */
  const creerRDV = useCallback(async (data) => {
    const resp = await createRDV(data)
    await load()
    return resp.data
  }, [load])

  /** PATCH /api/rendezvous/{id}/ */
  const modifierRDV = useCallback(async (id, data) => {
    const resp = await updateRDV(id, data)
    setRdvs(prev => prev.map(r => r.id === id ? { ...r, ...resp.data } : r))
    return resp.data
  }, [])

  /** DELETE /api/rendezvous/{id}/ → HTTP 200, soft delete */
  const supprimerRDV = useCallback(async (id) => {
    await deleteRDV(id)
    setRdvs(prev => prev.filter(r => r.id !== id))
    setTotal(t => Math.max(0, t - 1))
  }, [])

  // ── Actions de statut ─────────────────────────────────────────────

  /** PATCH /api/rendezvous/{id}/valider/
   *  @param {string} id
   *  @param {"ACCEPTE"|"REFUSE"} decision
   *  @param {string} [refuse_raison] — obligatoire si decision === "REFUSE"
   */
  const valider = useCallback(async (id, decision, refuse_raison = '') => {
    const resp = await validerRDV(id, decision, refuse_raison)
    // Mettre à jour le statut dans la liste locale
    setRdvs(prev => prev.map(r =>
      r.id === id ? { ...r, statut: decision } : r
    ))
    return resp.data
  }, [])

  /** PATCH /api/rendezvous/{id}/annuler/ */
  const annuler = useCallback(async (id, raison = '') => {
    const resp = await annulerRDV(id, raison)
    setRdvs(prev => prev.filter(r => r.id !== id))
    setTotal(t => Math.max(0, t - 1))
    return resp.data
  }, [])

  /** PATCH /api/rendezvous/{id}/terminer/ — dentiste seulement */
  const terminer = useCallback(async (id) => {
    const resp = await terminerRDV(id)
    setRdvs(prev => prev.map(r =>
      r.id === id ? { ...r, statut: 'TERMINE' } : r
    ))
    return resp.data
  }, [])

  return {
    rdvs, total, loading, error,
    filters,
    load, rechercher, filtrer, resetFiltres,
    creerRDV, modifierRDV, supprimerRDV,
    valider, annuler, terminer,
  }
}

// ── Hook stats du tableau de bord ─────────────────────────────────────────────

export function useRDVStats() {
  const [stats,   setStats]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await getStatsRDV()
      setStats(data)
    } catch (err) {
      setError(extractError(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [])

  return { stats, loading, error, reload: load }
}

// ── Hook RDV du jour (pour le dashboard) ──────────────────────────────────────

export function useRDVAujourdhui() {
  const [rdvs,    setRdvs]    = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getRDVs({ aujourd_hui: 'true', statut: 'ACCEPTE', ordering: 'date_heure' })
      .then(({ data }) => {
        const list = data.results ?? data
        setRdvs(Array.isArray(list) ? list : [])
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  return { rdvs, loading }
}

// ── Hook demandes en attente (RDV PENDING — pour le dentiste) ─────────────────

export function useRDVEnAttente() {
  const [rdvs,    setRdvs]    = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    return getRDVs({ statut: 'PENDING' })
      .then(({ data }) => {
        const list = data.results ?? data
        setRdvs(Array.isArray(list) ? list : [])
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [])

  const valider = useCallback(async (id, decision, raison = '') => {
    await validerRDV(id, decision, raison)
    await load()
  }, [load])

  return { rdvs, loading, valider, reload: load }
}