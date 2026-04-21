/**
 * pages/dentiste/MonAgendaPage.jsx
 * ==================================
 * Agenda complet du dentiste.
 *
 * Fonctionnalités :
 *   - Liste des RDV groupés par date
 *   - Filtres : statut, type_soin, date_debut / date_fin
 *   - Créer un RDV (POST /api/rendezvous/)
 *   - Valider PENDING  (PATCH /api/rendezvous/{id}/valider/)
 *   - Terminer ACCEPTE (PATCH /api/rendezvous/{id}/terminer/)
 *   - Annuler           (PATCH /api/rendezvous/{id}/annuler/)
 *
 * Compatibilité backend :
 *   - Filtre aujourd_hui=true pour "Aujourd'hui"
 *   - Filtre statut=PENDING pour les demandes
 *   - createRDV → statut ACCEPTE automatiquement (dentiste)
 */

import React, { useState, useEffect } from 'react'
import { Plus, Filter } from 'lucide-react'
import { useRendezVous } from '../../hooks/useRendezVous'
import { getPatients } from '../../api/patientsAPI'
import RDVCard  from '../../components/rendezvous/RDVCard'
import RDVForm  from '../../components/rendezvous/RDVForm'
import { TYPE_SOIN_LABELS, STATUT_RDV } from '../../api/rendezvousAPI'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDateGroupe(isoStr) {
  return new Date(isoStr).toLocaleDateString('fr-FR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  })
}

function groupParDate(rdvs) {
  const groups = {}
  rdvs.forEach(r => {
    const key = formatDateGroupe(r.date_heure)
    if (!groups[key]) groups[key] = []
    groups[key].push(r)
  })
  return groups
}

// ── Composant ─────────────────────────────────────────────────────────────────

export default function MonAgendaPage() {
  const {
    rdvs, total, loading, error,
    load, rechercher, filtrer,
    creerRDV, valider, annuler, terminer,
  } = useRendezVous({ ordering: 'date_heure' })

  const [patients,    setPatients]    = useState([])
  const [showForm,    setShowForm]    = useState(false)
  const [formLoading, setFormLoading] = useState(false)
  const [formError,   setFormError]   = useState(null)
  const [activeFilter, setActiveFilter] = useState('all')

  // Charger les patients pour le formulaire
  useEffect(() => {
    getPatients({ statut: 'ACCEPTE', page_size: 200 })
      .then(({ data }) => {
        const list = data.results ?? data
        setPatients(Array.isArray(list) ? list : [])
      })
      .catch(console.error)
  }, [])

  // Appliquer les filtres rapides
  function applyQuickFilter(f) {
    setActiveFilter(f)
    if (f === 'today')   filtrer({ aujourd_hui: 'true', statut: undefined })
    if (f === 'pending') filtrer({ statut: 'PENDING', aujourd_hui: undefined })
    if (f === 'all')     filtrer({ statut: undefined, aujourd_hui: undefined })
  }

  async function handleCreate(formData) {
    setFormLoading(true)
    setFormError(null)
    try {
      await creerRDV(formData)
      setShowForm(false)
    } catch (err) {
      const d = err?.response?.data
      setFormError(d?.detail || d?.date_heure?.[0] || d?.patient?.[0] || 'Erreur création')
      throw err // rethrow pour que RDVForm gère aussi
    } finally {
      setFormLoading(false)
    }
  }

  const grouped = groupParDate(rdvs)
  const pendingCount = rdvs.filter(r => r.statut === STATUT_RDV.PENDING).length

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Mes rendez-vous</h1>
          <p className="page-sub">{total} rendez-vous</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setShowForm(true); setFormError(null) }}>
          <Plus size={15} /> Nouveau RDV
        </button>
      </div>

      {/* Filtres rapides */}
      <div style={{ display:'flex', gap:8, marginBottom:20, flexWrap:'wrap' }}>
        {[
          { key:'all',     label:'Tous' },
          { key:'today',   label:"Aujourd'hui" },
          { key:'pending', label:`En attente${pendingCount > 0 ? ` (${pendingCount})` : ''}` },
        ].map(({ key, label }) => (
          <button
            key={key}
            className={`btn btn-sm ${activeFilter === key ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => applyQuickFilter(key)}
          >
            {label}
          </button>
        ))}

        {/* Filtre par type de soin */}
        <select
          className="form-select"
          style={{ width:'auto', height:34, fontSize:13 }}
          onChange={e => filtrer({ type_soin: e.target.value || undefined })}
        >
          <option value="">Type de soin</option>
          {Object.entries(TYPE_SOIN_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {/* Recherche */}
      <div style={{ marginBottom: 20 }}>
        <div className="search-wrap">
          <svg className="search-icon" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            className="form-input"
            placeholder="Rechercher par patient, motif..."
            onChange={e => rechercher(e.target.value)}
          />
        </div>
      </div>

      {/* Contenu */}
      {loading ? (
        <div className="loading-center"><div className="spinner" /></div>
      ) : error ? (
        <div className="alert alert-error">{error}</div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="empty">
          <div className="empty-icon">
            <svg width="48" height="48" fill="none" viewBox="0 0 24 24" stroke="currentColor" opacity=".3">
              <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
            </svg>
          </div>
          <p>Aucun rendez-vous trouvé</p>
        </div>
      ) : (
        Object.entries(grouped).map(([date, list]) => (
          <div key={date} style={{ marginBottom: 24 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#00838f" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
              </svg>
              <span style={{ fontSize:13, fontWeight:600, color:'#374151' }}>{date}</span>
              <span style={{ fontSize:11, padding:'2px 8px', background:'#e0f7f5', color:'#00838f', borderRadius:20, fontWeight:500 }}>
                {list.length} RDV
              </span>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {list.map(r => (
                <RDVCard
                  key={r.id}
                  rdv={r}
                  role="dentiste"
                  onValider={valider}
                  onAnnuler={annuler}
                  onTerminer={terminer}
                />
              ))}
            </div>
          </div>
        ))
      )}

      {/* Modal création RDV */}
      {showForm && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="modal modal-lg">
            <div className="modal-header">
              <h2>Nouveau rendez-vous</h2>
              <button onClick={() => setShowForm(false)} style={{ background:'none',border:'none',cursor:'pointer',fontSize:20,color:'#9ca3af' }}>×</button>
            </div>
            <div className="modal-body">
              <RDVForm
                patients={patients}
                role="dentiste"
                onSubmit={handleCreate}
                onCancel={() => setShowForm(false)}
                loading={formLoading}
                error={formError}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}