/**
 * pages/receptionniste/DashboardReceptionniste.jsx
 * ==================================================
 * Tableau de bord réceptionniste.
 *
 * Données :
 *   GET /api/patients/stats/
 *   GET /api/rendezvous/stats/
 *   GET /api/rendezvous/?aujourd_hui=true&statut=ACCEPTE  → planning du jour
 *   GET /api/patients/?statut=PENDING                     → patients en attente
 */

import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useDashboard } from '../../hooks/useDashboard'
import { TYPE_SOIN_LABELS } from '../../api/rendezvousAPI'
import { Plus, Users, Calendar, Clock, UserPlus } from 'lucide-react'

function formatHeure(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

export default function DashboardReceptionniste() {
  const { user }  = useAuth()
  const navigate  = useNavigate()
  const { data, loading, error, reload } = useDashboard()

  if (loading) return <div className="loading-center"><div className="spinner" /></div>
  if (error)   return <div className="alert alert-error">{error}</div>

  const { patientStats, rdvStats, rdvAujourdhui, pendingPatients } = data || {}

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Accueil — Réception</h1>
          <p className="page-sub">Gérez les patients et rendez-vous</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/receptionniste/patients/nouveau')}>
          <Plus size={15} /> Nouveau patient
        </button>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <div className="card stat-card" style={{ cursor:'pointer' }} onClick={() => navigate('/receptionniste/patients')}>
          <div>
            <div className="stat-label">Total Patients</div>
            <div className="stat-value">{patientStats?.actifs ?? '—'}</div>
          </div>
          <div className="stat-icon teal"><Users size={22} /></div>
        </div>
        <div className="card stat-card">
          <div>
            <div className="stat-label">RDV aujourd'hui</div>
            <div className="stat-value">{rdvStats?.aujourd_hui ?? '—'}</div>
          </div>
          <div className="stat-icon blue"><Calendar size={22} /></div>
        </div>
        <div className="card stat-card" style={{ cursor:'pointer' }} onClick={() => navigate('/receptionniste/patients?statut=PENDING')}>
          <div>
            <div className="stat-label">En attente</div>
            <div className="stat-value">{patientStats?.en_attente ?? '—'}</div>
          </div>
          <div className="stat-icon amber"><Clock size={22} /></div>
        </div>
        <div className="card stat-card">
          <div>
            <div className="stat-label">Nouveaux ce mois</div>
            <div className="stat-value">{patientStats?.nouveaux_ce_mois ?? '—'}</div>
            {patientStats?.nouveaux_ce_mois > 0 && (
              <div style={{ fontSize:11, color:'#059669', marginTop:2 }}>
                +{patientStats.nouveaux_ce_mois}
              </div>
            )}
          </div>
          <div className="stat-icon green"><UserPlus size={22} /></div>
        </div>
      </div>

      <div className="grid-2">
        {/* Planning du jour */}
        <div className="card">
          <div className="card-header">
            <h3 style={{ display:'flex', alignItems:'center', gap:8 }}>
              <Calendar size={15} color="#00838f" /> Planning du jour
            </h3>
            <button className="btn btn-outline btn-sm" onClick={() => navigate('/receptionniste/agenda')}>
              Agenda complet
            </button>
          </div>
          <div className="card-pad">
            {rdvAujourdhui?.length === 0 ? (
              <p style={{ color:'#9ca3af', fontSize:13 }}>Aucun rendez-vous aujourd'hui.</p>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {rdvAujourdhui?.map(r => (
                  <div key={r.id} style={{
                    display:'flex', alignItems:'center', gap:12,
                    padding:'12px 14px', borderRadius:10,
                    border:'1px solid #e5e7eb',
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

        {/* Patients en attente de validation */}
        <div className="card">
          <div className="card-header">
            <h3 style={{ display:'flex', alignItems:'center', gap:8 }}>
              <Clock size={15} color="#d97706" /> Patients en attente de validation
            </h3>
            {pendingPatients?.length > 0 && (
              <span className="badge badge-warning">{pendingPatients.length}</span>
            )}
          </div>
          <div className="card-pad" style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {pendingPatients?.length === 0 ? (
              <p style={{ color:'#9ca3af', fontSize:13 }}>Aucun patient en attente. ✓</p>
            ) : (
              pendingPatients?.map(p => (
                <div key={p.id} style={{
                  display:'flex', justifyContent:'space-between', alignItems:'center',
                  padding:'12px 14px', borderRadius:10,
                  border:'1px solid #fde68a', background:'#fffbeb',
                }}>
                  <div>
                    <div style={{ fontWeight:600, fontSize:13 }}>
                      {p.nom_complet || `${p.prenom} ${p.nom}`}
                    </div>
                    <div style={{ fontSize:12, color:'#6b7280' }}>
                      {p.dentiste_nom || 'En attente d\'affectation'}
                    </div>
                  </div>
                  <span className="badge badge-warning">En attente</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}