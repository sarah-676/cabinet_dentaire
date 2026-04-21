/**
 * pages/receptionniste/AgendaPage.jsx
 * =====================================
 * Agenda complet pour la réceptionniste.
 *
 * Fonctionnalités :
 *   - Liste RDV groupés par date (tous les statuts visibles)
 *   - Créer un RDV → statut PENDING (validation dentiste obligatoire)
 *   - Annuler un RDV existant
 *   - Filtres : statut, date
 *   - Recherche par patient
 *
 * Différence vs dentiste :
 *   - Pas de bouton "Valider" ni "Terminer" (réservé dentiste)
 *   - Création → PENDING automatiquement côté backend
 *   - Peut voir tous les RDV (tous dentistes) — IsReceptionniste
 */

import React, { useState, useEffect } from 'react'
import { Plus } from 'lucide-react'
import { useRendezVous } from '../../hooks/useRendezVous'
import { getPatients } from '../../api/patientsAPI'
import { getDentistes } from '../../api/usersAPI'
import RDVCard from '../../components/rendezvous/RDVCard'
import RDVForm from '../../components/rendezvous/RDVForm'
import {
  TYPE_SOIN_LABELS,
  STATUT_LABELS,
  STATUT_RDV,
} from '../../api/rendezvousAPI'

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

export default function AgendaPage() {
  const {
    rdvs, total, loading, error,
    rechercher, filtrer,
    creerRDV, annuler,
  } = useRendezVous({ ordering: 'date_heure' })

  const [patients,    setPatients]    = useState([])
  const [showForm,    setShowForm]    = useState(false)
  const [formLoading, setFormLoading] = useState(false)
  const [formError,   setFormError]   = useState(null)
  const [activeFilter, setActiveFilter] = useState('all')

  // Charger les patients acceptés pour le formulaire
  useEffect(() => {
    getPatients({ statut: 'ACCEPTE', page_size: 200 })
      .then(({ data }) => {
        const list = data.results ?? data
        setPatients(Array.isArray(list) ? list : [])
      })
      .catch(console.error)
  }, [])

  function applyFilter(f) {
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
      setFormError(
        d?.detail || d?.date_heure?.[0] || d?.patient?.[0] || 'Erreur création'
      )
      throw err
    } finally {
      setFormLoading(false)
    }
  }

  const grouped = groupParDate(rdvs)

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Rendez-vous</h1>
          <p className="page-sub">{total} rendez-vous</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setShowForm(true); setFormError(null) }}>
          <Plus size={15} /> Nouveau RDV
        </button>
      </div>

      {/* Filtres */}
      <div style={{ display:'flex', gap:8, marginBottom:20, flexWrap:'wrap' }}>
        {[
          { key:'all',     label:'Tous' },
          { key:'today',   label:"Aujourd'hui" },
          { key:'pending', label:'En attente' },
        ].map(({ key, label }) => (
          <button
            key={key}
            className={`btn btn-sm ${activeFilter === key ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => applyFilter(key)}
          >
            {label}
          </button>
        ))}

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
            placeholder="Rechercher..."
            onChange={e => rechercher(e.target.value)}
          />
        </div>
      </div>

      {/* Liste */}
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
                  role="receptionniste"
                  onValider={() => {}}   // réception ne valide pas
                  onAnnuler={annuler}
                  onTerminer={() => {}}  // réception ne termine pas
                />
              ))}
            </div>
          </div>
        ))
      )}

      {/* Modal création */}
      {showForm && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="modal modal-lg">
            <div className="modal-header">
              <h2>Nouveau rendez-vous</h2>
              <button onClick={() => setShowForm(false)} style={{ background:'none',border:'none',cursor:'pointer',fontSize:20,color:'#9ca3af' }}>×</button>
            </div>
            <div className="modal-body">
              <div className="alert" style={{ background:'#eff6ff', border:'1px solid #bfdbfe', color:'#1e40af', borderRadius:8, padding:'10px 14px', fontSize:13, marginBottom:16 }}>
                ℹ️ Ce rendez-vous sera envoyé au dentiste pour validation.
              </div>
              <RDVForm
                patients={patients}
                role="receptionniste"
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