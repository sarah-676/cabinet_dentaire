/**
 * pages/dentiste/DashboardDentiste.jsx
 * ======================================
 * Tableau de bord dentiste — connecté au backend.
 *
 * Données chargées :
 *   GET /api/patients/stats/
 *   GET /api/rendezvous/stats/
 *   GET /api/rendezvous/?aujourd_hui=true&statut=ACCEPTE
 *   GET /api/patients/?statut=PENDING       → patients à valider
 *   GET /api/rendezvous/?statut=PENDING     → RDV à valider
 *
 * Actions disponibles :
 *   Accepter / Refuser patient  → PATCH /api/patients/{id}/valider/
 *   Accepter / Refuser RDV      → PATCH /api/rendezvous/{id}/valider/
 */

import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useDashboard } from '../../hooks/useDashboard'
import { validerRDV, STATUT_RDV, TYPE_SOIN_LABELS } from '../../api/rendezvousAPI'
import { validerPatient } from '../../api/patientsAPI'
import { Check, X, Users, Calendar, ClipboardList, CheckCircle } from 'lucide-react'

function formatHeure(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function formatDateCourte(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function DashboardDentiste() {
  const { user }    = useAuth()
  const navigate    = useNavigate()
  const { data, loading, error, reload } = useDashboard()

  const [busy, setBusy] = useState({})

  // ── Valider patient ───────────────────────────────────────────────
  async function handleValiderPatient(id, decision) {
    setBusy(b => ({ ...b, [`p-${id}`]: true }))
    try {
      await validerPatient(id, decision, '')
      reload()
    } catch (err) {
      alert(err?.response?.data?.detail || 'Erreur')
    } finally {
      setBusy(b => ({ ...b, [`p-${id}`]: false }))
    }
  }

  // ── Valider RDV ───────────────────────────────────────────────────
  async function handleValiderRDV(id, decision) {
    setBusy(b => ({ ...b, [`r-${id}`]: true }))
    try {
      await validerRDV(id, decision, '')
      reload()
    } catch (err) {
      alert(err?.response?.data?.detail || 'Erreur')
    } finally {
      setBusy(b => ({ ...b, [`r-${id}`]: false }))
    }
  }

  if (loading) {
    return (
      <div className="loading-center">
        <div className="spinner" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="alert alert-error" style={{ margin: 0 }}>
        {error}
        <button className="btn btn-secondary btn-sm" onClick={reload} style={{ marginLeft: 12 }}>
          Réessayer
        </button>
      </div>
    )
  }

  const { patientStats, rdvStats, rdvAujourdhui, pendingPatients, pendingRdvs, totalDemandes } = data || {}

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Bonjour, {user?.full_name} 👋</h1>
          <p className="page-sub">Voici un résumé de votre journée</p>
        </div>
      </div>

      {/* Statistiques */}
      <div className="stats-grid">
        <div className="card stat-card" style={{ cursor:'pointer' }} onClick={() => navigate('/dentiste/patients')}>
          <div>
            <div className="stat-label">Mes patients</div>
            <div className="stat-value">{patientStats?.actifs ?? '—'}</div>
          </div>
          <div className="stat-icon teal"><Users size={22} /></div>
        </div>
        <div className="card stat-card" style={{ cursor:'pointer' }} onClick={() => navigate('/dentiste/agenda')}>
          <div>
            <div className="stat-label">RDV aujourd'hui</div>
            <div className="stat-value">{rdvStats?.aujourd_hui ?? '—'}</div>
          </div>
          <div className="stat-icon blue"><Calendar size={22} /></div>
        </div>
        <div className="card stat-card" style={{ cursor:'pointer' }} onClick={() => navigate('/dentiste/agenda')}>
          <div>
            <div className="stat-label">Demandes en attente</div>
            <div className="stat-value">{totalDemandes ?? '—'}</div>
          </div>
          <div className="stat-icon amber"><ClipboardList size={22} /></div>
        </div>
        <div className="card stat-card">
          <div>
            <div className="stat-label">Terminés ce mois</div>
            <div className="stat-value">{rdvStats?.termines ?? '—'}</div>
          </div>
          <div className="stat-icon green"><CheckCircle size={22} /></div>
        </div>
      </div>

      <div className="grid-2">
        {/* RDV du jour */}
        <div className="card">
          <div className="card-header">
            <h3 style={{ display:'flex', alignItems:'center', gap:8 }}>
              <Calendar size={15} color="#00838f" /> RDV d'aujourd'hui
            </h3>
            <button className="btn btn-outline btn-sm" onClick={() => navigate('/dentiste/agenda')}>
              Voir tout
            </button>
          </div>
          <div className="card-pad">
            {rdvAujourdhui?.length === 0 ? (
              <p style={{ color: '#9ca3af', fontSize: 13 }}>
                Aucun rendez-vous aujourd'hui.
              </p>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {rdvAujourdhui?.map(r => (
                  <div key={r.id} style={{
                    display:'flex', alignItems:'center', gap:12,
                    padding:'12px 14px', borderRadius:10,
                    border:'1px solid #e5e7eb', background:'#fff',
                  }}>
                    <div style={{ minWidth:48, textAlign:'center' }}>
                      <div style={{ fontSize:16, fontWeight:700, color:'#0097a7' }}>
                        {formatHeure(r.date_heure)}
                      </div>
                      <div style={{ fontSize:11, color:'#9ca3af' }}>{r.duree_minutes}min</div>
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:600, fontSize:13 }}>{r.patient_nom}</div>
                      <div style={{ fontSize:12, color:'#6b7280' }}>
                        {TYPE_SOIN_LABELS[r.type_soin] || r.type_soin}
                      </div>
                    </div>
                    <span className="badge badge-success">Confirmé</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Demandes en attente */}
        <div className="card">
          <div className="card-header">
            <h3 style={{ display:'flex', alignItems:'center', gap:8 }}>
              <ClipboardList size={15} color="#d97706" /> Demandes en attente
            </h3>
            {totalDemandes > 0 && (
              <span className="badge badge-warning">{totalDemandes}</span>
            )}
          </div>
          <div className="card-pad" style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {/* Patients PENDING */}
            {pendingPatients?.map(p => (
              <DemandeItem
                key={`p-${p.id}`}
                type="Patient"
                name={p.nom_complet || `${p.prenom} ${p.nom}`}
                detail={`Nouveau patient · ${p.telephone}`}
                color="amber"
                loading={busy[`p-${p.id}`]}
                onAccept={() => handleValiderPatient(p.id, 'ACCEPTE')}
                onRefuse={() => handleValiderPatient(p.id, 'REFUSE')}
              />
            ))}

            {/* RDV PENDING */}
            {pendingRdvs?.map(r => (
              <DemandeItem
                key={`r-${r.id}`}
                type="RDV"
                name={r.patient_nom}
                detail={`${formatDateCourte(r.date_heure)} à ${formatHeure(r.date_heure)} · ${TYPE_SOIN_LABELS[r.type_soin] || r.type_soin}`}
                color="blue"
                loading={busy[`r-${r.id}`]}
                onAccept={() => handleValiderRDV(r.id, 'ACCEPTE')}
                onRefuse={() => handleValiderRDV(r.id, 'REFUSE')}
              />
            ))}

            {totalDemandes === 0 && (
              <p style={{ color: '#9ca3af', fontSize: 13 }}>
                Aucune demande en attente. ✓
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Sous-composant carte de demande ───────────────────────────────────────────
function DemandeItem({ type, name, detail, color, loading, onAccept, onRefuse }) {
  const colors = {
    amber: { bg: '#fffbeb', border: '#fde68a', badge: 'badge-warning' },
    blue:  { bg: '#eff6ff', border: '#bfdbfe', badge: 'badge-info' },
  }
  const c = colors[color] || colors.amber

  return (
    <div style={{ padding:12, background:c.bg, borderRadius:10, border:`1px solid ${c.border}` }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
        <div style={{ fontWeight:600, fontSize:13 }}>{name}</div>
        <span className={`badge ${c.badge}`}>{type}</span>
      </div>
      <div style={{ fontSize:12, color:'#6b7280', marginBottom:8 }}>{detail}</div>
      <div style={{ display:'flex', gap:6 }}>
        <button className="btn btn-success btn-sm" onClick={onAccept} disabled={loading}>
          {loading ? <span className="spinner" style={{ width:12, height:12 }} /> : <><Check size={12} /> Accepter</>}
        </button>
        <button className="btn btn-danger btn-sm" onClick={onRefuse} disabled={loading}>
          <X size={12} /> Refuser
        </button>
      </div>
    </div>
  )
}