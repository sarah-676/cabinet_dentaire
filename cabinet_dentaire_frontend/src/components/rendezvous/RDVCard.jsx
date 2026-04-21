/**
 * components/rendezvous/RDVCard.jsx
 * ===================================
 * Carte d'un rendez-vous.
 *
 * Affiche :
 *   - heure + durée
 *   - nom patient
 *   - type de soin
 *   - badge statut
 *   - boutons d'action selon statut et rôle
 *
 * Actions possibles :
 *   dentiste  → Valider (PENDING), Terminer (ACCEPTE), Annuler
 *   réception → Annuler
 *   admin     → Annuler
 *
 * Props :
 *   rdv          : objet RendezVousListSerializer
 *   role         : "dentiste" | "receptionniste" | "admin"
 *   onValider    : (id, decision, raison) => Promise
 *   onAnnuler    : (id, raison) => Promise
 *   onTerminer   : (id) => Promise
 *   onEdit       : (rdv) => void   — optionnel
 */

import React, { useState } from 'react'
import { Check, X, Clock, CheckCircle, Ban } from 'lucide-react'
import {
  STATUT_LABELS,
  STATUT_BADGE_CLASS,
  TYPE_SOIN_LABELS,
  STATUT_RDV,
} from '../../api/rendezvousAPI'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatHeure(isoStr) {
  if (!isoStr) return '—'
  return new Date(isoStr).toLocaleTimeString('fr-FR', {
    hour: '2-digit', minute: '2-digit',
  })
}

function formatDateCourte(isoStr) {
  if (!isoStr) return '—'
  return new Date(isoStr).toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

// ── Composant principal ───────────────────────────────────────────────────────

export default function RDVCard({
  rdv,
  role = 'dentiste',
  onValider,
  onAnnuler,
  onTerminer,
  onEdit,
}) {
  const [loadingAction, setLoadingAction] = useState(null)
  const [showRefusModal, setShowRefusModal] = useState(false)
  const [showAnnulModal, setShowAnnulModal] = useState(false)
  const [refusRaison,   setRefusRaison]   = useState('')
  const [annulRaison,   setAnnulRaison]   = useState('')
  const [actionError,   setActionError]   = useState('')

  // ── Accepter ──────────────────────────────────────────────────────
  async function handleAccepter() {
    setLoadingAction('accepter')
    setActionError('')
    try {
      await onValider(rdv.id, 'ACCEPTE', '')
    } catch (err) {
      setActionError(err?.response?.data?.detail || 'Erreur')
    } finally {
      setLoadingAction(null)
    }
  }

  // ── Refuser ───────────────────────────────────────────────────────
  async function handleRefuser() {
    if (!refusRaison.trim()) {
      setActionError('La raison du refus est obligatoire.')
      return
    }
    setLoadingAction('refuser')
    setActionError('')
    try {
      await onValider(rdv.id, 'REFUSE', refusRaison)
      setShowRefusModal(false)
      setRefusRaison('')
    } catch (err) {
      setActionError(err?.response?.data?.detail || 'Erreur')
    } finally {
      setLoadingAction(null)
    }
  }

  // ── Terminer ──────────────────────────────────────────────────────
  async function handleTerminer() {
    if (!confirm(`Marquer ce RDV avec ${rdv.patient_nom} comme terminé ?`)) return
    setLoadingAction('terminer')
    try {
      await onTerminer(rdv.id)
    } catch (err) {
      alert(err?.response?.data?.detail || 'Erreur')
    } finally {
      setLoadingAction(null)
    }
  }

  // ── Annuler ───────────────────────────────────────────────────────
  async function handleAnnuler() {
    setLoadingAction('annuler')
    setActionError('')
    try {
      await onAnnuler(rdv.id, annulRaison)
      setShowAnnulModal(false)
      setAnnulRaison('')
    } catch (err) {
      setActionError(err?.response?.data?.detail || 'Erreur')
    } finally {
      setLoadingAction(null)
    }
  }

  const isPending  = rdv.statut === STATUT_RDV.PENDING
  const isAccepte  = rdv.statut === STATUT_RDV.ACCEPTE
  const isFinalise = rdv.statut === STATUT_RDV.TERMINE || rdv.statut === STATUT_RDV.ANNULE || rdv.statut === STATUT_RDV.REFUSE

  return (
    <>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16,
        padding: '14px 16px', borderRadius: 10,
        border: `1px solid ${isPending ? '#fde68a' : '#e5e7eb'}`,
        background: isPending ? '#fffbeb' : '#fff',
        transition: 'all .2s',
      }}>
        {/* Heure */}
        <div style={{ minWidth: 52, textAlign: 'center', flexShrink: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: '#0097a7', lineHeight: 1 }}>
            {formatHeure(rdv.date_heure)}
          </div>
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
            {rdv.duree_minutes}min
          </div>
        </div>

        {/* Infos */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: '#111827', marginBottom: 2 }}>
            {rdv.patient_nom || 'Patient'}
          </div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>
            {TYPE_SOIN_LABELS[rdv.type_soin] || rdv.type_soin}
            {rdv.motif && ` · ${rdv.motif}`}
          </div>
        </div>

        {/* Statut badge */}
        <span className={`badge ${STATUT_BADGE_CLASS[rdv.statut] || 'badge-gray'}`}>
          {STATUT_LABELS[rdv.statut] || rdv.statut}
        </span>

        {/* Actions selon rôle + statut */}
        {!isFinalise && (
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>

            {/* Dentiste : Valider un PENDING */}
            {role === 'dentiste' && isPending && (
              <>
                <button
                  className="btn btn-success btn-sm"
                  onClick={handleAccepter}
                  disabled={loadingAction === 'accepter'}
                  title="Accepter"
                >
                  {loadingAction === 'accepter'
                    ? <span className="spinner" style={{ width: 12, height: 12 }} />
                    : <><Check size={12} /> Accepter</>}
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => { setShowRefusModal(true); setActionError('') }}
                  title="Refuser"
                >
                  <X size={12} /> Refuser
                </button>
              </>
            )}

            {/* Dentiste : Terminer un ACCEPTE */}
            {role === 'dentiste' && isAccepte && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleTerminer}
                disabled={loadingAction === 'terminer'}
                title="Marquer terminé"
              >
                {loadingAction === 'terminer'
                  ? <span className="spinner" style={{ width: 12, height: 12 }} />
                  : <><CheckCircle size={12} /> Terminé</>}
              </button>
            )}

            {/* Annuler — tous rôles sur ACCEPTE ou PENDING */}
            {(isAccepte || isPending) && (
              <button
                className="btn btn-outline btn-sm"
                onClick={() => { setShowAnnulModal(true); setActionError('') }}
                title="Annuler"
                style={{ color: '#ef4444' }}
              >
                <Ban size={12} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Modal refus ───────────────────────────────────────────────── */}
      {showRefusModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowRefusModal(false)}>
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h2>Refuser le rendez-vous</h2>
              <button onClick={() => setShowRefusModal(false)} style={{ background:'none',border:'none',cursor:'pointer',fontSize:20,color:'#9ca3af' }}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>
                RDV de <strong>{rdv.patient_nom}</strong> le {formatDateCourte(rdv.date_heure)} à {formatHeure(rdv.date_heure)}
              </p>
              {actionError && <div className="alert alert-error">{actionError}</div>}
              <div className="form-group">
                <label className="form-label">Raison du refus <span style={{ color: '#ef4444' }}>*</span></label>
                <textarea
                  className="form-textarea"
                  placeholder="Expliquez pourquoi vous refusez ce rendez-vous..."
                  value={refusRaison}
                  onChange={e => setRefusRaison(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowRefusModal(false)}>Annuler</button>
              <button
                className="btn btn-danger"
                onClick={handleRefuser}
                disabled={loadingAction === 'refuser'}
              >
                {loadingAction === 'refuser' ? <span className="spinner" /> : 'Confirmer le refus'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal annulation ──────────────────────────────────────────── */}
      {showAnnulModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowAnnulModal(false)}>
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h2>Annuler le rendez-vous</h2>
              <button onClick={() => setShowAnnulModal(false)} style={{ background:'none',border:'none',cursor:'pointer',fontSize:20,color:'#9ca3af' }}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>
                RDV de <strong>{rdv.patient_nom}</strong> le {formatDateCourte(rdv.date_heure)} à {formatHeure(rdv.date_heure)}
              </p>
              {actionError && <div className="alert alert-error">{actionError}</div>}
              <div className="form-group">
                <label className="form-label">Raison de l'annulation (optionnel)</label>
                <textarea
                  className="form-textarea"
                  placeholder="Raison de l'annulation..."
                  value={annulRaison}
                  onChange={e => setAnnulRaison(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowAnnulModal(false)}>Fermer</button>
              <button
                className="btn btn-danger"
                onClick={handleAnnuler}
                disabled={loadingAction === 'annuler'}
              >
                {loadingAction === 'annuler' ? <span className="spinner" /> : 'Confirmer l\'annulation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}