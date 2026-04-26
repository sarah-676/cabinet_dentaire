/**
 * src/hooks/useRendezVous.js
 * ✅ Architecture propre :
 *   - useDentisteRendezVous  → dentiste (ses RDV + valider/refuser/terminer)
 *   - useReceptionnisteRendezVous → réceptionniste (tous RDV + créer PENDING)
 *   - useRendezVous → hook générique partagé (base commune)
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  getRendezVous,
  createRendezVous,
  updateRendezVous,
  deleteRendezVous,
  validerRendezVous,
  annulerRendezVous,
  terminerRendezVous,
  getRendezVousStats,
} from "../api/rendezvousAPI";

function extractError(err) {
  const d = err?.response?.data;
  if (!d) return err?.message || "Erreur réseau";
  if (typeof d === "string") return d;
  if (d.detail) return d.detail;
  if (d.non_field_errors) return d.non_field_errors[0];
  const first = Object.entries(d)[0];
  if (first) return `${first[0]}: ${Array.isArray(first[1]) ? first[1][0] : first[1]}`;
  return "Erreur de validation";
}

// ── Hook de base (partagé) ────────────────────────────────────────────────────

export function useRendezVous(initialFilters = {}) {
  const [rdvs,    setRdvs]    = useState([]);
  const [total,   setTotal]   = useState(0);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [filters, setFilters] = useState(initialFilters);
  const debounceRef           = useRef(null);

  const load = useCallback(async (params = {}) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getRendezVous({ ...filters, ...params });
      const list = data?.results ?? data;
      setRdvs(Array.isArray(list) ? list : []);
      setTotal(data?.count ?? (Array.isArray(list) ? list.length : 0));
    } catch (err) {
      setError(extractError(err));
      setRdvs([]);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { load(); }, [filters]);

  const rechercher = useCallback((query) => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setFilters((f) => ({ ...f, search: query || undefined }));
    }, 400);
  }, []);

  const filtrer      = useCallback((nf) => setFilters((f) => ({ ...f, ...nf })), []);
  const resetFiltres = useCallback(() => setFilters(initialFilters), [initialFilters]);

  return {
    rdvs, setRdvs, total, setTotal,
    loading, error, filters,
    load, rechercher, filtrer, resetFiltres,
  };
}

// ── Hook dentiste ─────────────────────────────────────────────────────────────

export function useDentisteRendezVous(initialFilters = {}) {
  const base = useRendezVous(initialFilters);

  // ✅ Créer RDV — dentiste → statut ACCEPTE automatiquement côté backend
  const creerRDV = useCallback(async (payload) => {
    // ✅ Payload exact attendu par le backend :
    //    patient (UUID), date_heure, duree_minutes, type_soin, priorite, motif
    //    dentiste_id est injecté par perform_create via request.user
    const data = await createRendezVous(payload);
    await base.load();
    return data;
  }, [base.load]);

  // ✅ Valider — retourne le RDV complet depuis le backend
  const valider = useCallback(async (id, decision, refuse_raison = "") => {
    const resp = await validerRendezVous(id, { decision, refuse_raison });
    if (resp && resp.id) {
      base.setRdvs((prev) =>
        prev.map((r) => r.id === id ? { ...r, ...resp } : r)
      );
    } else {
      base.setRdvs((prev) =>
        prev.map((r) => r.id === id ? { ...r, statut: decision } : r)
      );
    }
    return resp;
  }, [base.setRdvs]);

  const annuler = useCallback(async (id, raison = "") => {
    await annulerRendezVous(id, raison);
    base.setRdvs((prev) => prev.filter((r) => r.id !== id));
    base.setTotal((t) => Math.max(0, t - 1));
  }, [base.setRdvs, base.setTotal]);

  const terminer = useCallback(async (id) => {
    await terminerRendezVous(id);
    base.setRdvs((prev) =>
      prev.map((r) => r.id === id ? { ...r, statut: "TERMINE" } : r)
    );
  }, [base.setRdvs]);

  const modifierRDV = useCallback(async (id, payload) => {
    const resp = await updateRendezVous(id, payload);
    base.setRdvs((prev) =>
      prev.map((r) => r.id === id ? { ...r, ...resp } : r)
    );
    return resp;
  }, [base.setRdvs]);

  const supprimerRDV = useCallback(async (id) => {
    await deleteRendezVous(id);
    base.setRdvs((prev) => prev.filter((r) => r.id !== id));
    base.setTotal((t) => Math.max(0, t - 1));
  }, [base.setRdvs, base.setTotal]);

  return {
    ...base,
    creerRDV,
    valider,
    annuler,
    terminer,
    modifierRDV,
    supprimerRDV,
  };
}

// ── Hook réceptionniste ───────────────────────────────────────────────────────

export function useReceptionnisteRendezVous(initialFilters = {}) {
  const base = useRendezVous(initialFilters);

  // ✅ Créer RDV — réceptionniste → statut PENDING automatiquement côté backend
  // Le backend lit patient.dentiste_id pour assigner le dentiste
  // Le réceptionniste N'envoie PAS dentiste_id
  const creerRDV = useCallback(async (payload) => {
    // ✅ Payload exact :
    //    patient (UUID), date_heure, duree_minutes, type_soin, priorite, motif
    //    dentiste_id est extrait de patient.dentiste_id dans perform_create
    //    statut PENDING assigné automatiquement
    const data = await createRendezVous(payload);
    // Recharger pour voir le nouveau RDV PENDING
    await base.load();
    return data;
  }, [base.load]);

  // ✅ Mise à jour locale du statut depuis notification WebSocket
  const mettreAJourStatut = useCallback((rdvId, nouveauStatut) => {
    base.setRdvs((prev) =>
      prev.map((r) => r.id === rdvId ? { ...r, statut: nouveauStatut } : r)
    );
  }, [base.setRdvs]);

  return {
    ...base,
    creerRDV,
    mettreAJourStatut,
    // ✅ Réceptionniste ne peut PAS valider/refuser/terminer
    // Ces fonctions ne sont pas exposées
  };
}

// ── Hooks utilitaires ─────────────────────────────────────────────────────────

export function useRDVStats() {
  const [stats,   setStats]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getRendezVousStats();
      setStats(data);
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, []);
  return { stats, loading, error, reload: load };
}

export function useRDVAujourdhui() {
  const [rdvs,    setRdvs]    = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getRendezVous({
      aujourd_hui: "true",
      statut: "ACCEPTE",
      ordering: "date_heure",
    })
      .then((data) => {
        const list = data?.results ?? data;
        setRdvs(Array.isArray(list) ? list : []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return { rdvs, loading };
}

export function useRDVEnAttente() {
  const [rdvs,    setRdvs]    = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    return getRendezVous({ statut: "PENDING" })
      .then((data) => {
        const list = data?.results ?? data;
        setRdvs(Array.isArray(list) ? list : []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, []);

  const valider = useCallback(async (id, decision, raison = "") => {
    await validerRendezVous(id, { decision, refuse_raison: raison });
    await load();
  }, [load]);

  return { rdvs, loading, valider, reload: load };
}