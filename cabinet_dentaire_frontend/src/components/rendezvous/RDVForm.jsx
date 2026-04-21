/**
 * components/rendezvous/RDVForm.jsx
 * ===================================
 * Formulaire de création / modification d'un rendez-vous.
 *
 * Compatibilité backend (RendezVousCreateUpdateSerializer) :
 *   patient       → UUID (PrimaryKeyRelatedField filtré par rôle côté backend)
 *   date_heure    → ISO 8601 — doit être dans le futur (validate_date_heure)
 *   duree_minutes → entier ≥ 5 et ≤ 480
 *   type_soin     → choix TypeSoin
 *   priorite      → choix PrioriteRDV
 *   motif         → string optionnel
 *   note_interne  → string optionnel (dentiste uniquement)
 *   instructions_patient → string optionnel
 *
 * Différence rôle :
 *   Dentiste     → patient_id pré-filtré sur ses propres patients acceptés
 *   Réceptionniste → peut choisir n'importe quel patient accepté
 *   → Le filtre côté backend garantit l'isolation (pas besoin de filtrer ici)
 *     mais on charge les patients via GET /api/patients/?statut=ACCEPTE
 *
 * Props :
 *   rdv      : objet existant (null = création)
 *   patients : liste [{id, nom_complet}] — fournie par le parent
 *   role     : "dentiste" | "receptionniste"
 *   onSubmit : async (formData) => void
 *   onCancel : () => void
 *   loading  : bool
 *   error    : string | null
 */

import React, { useState, useEffect } from 'react'
import { TYPE_SOIN_LABELS, PRIORITE_LABELS } from '../../api/rendezvousAPI'

// ── Convertir date locale → ISO 8601 pour le backend ─────────────────────────
// Backend attend : "2026-04-21T10:30:00" (sans timezone explicite)
function toISO(dateStr, timeStr) {
  if (!dateStr || !timeStr) return ''
  return `${dateStr}T${timeStr}:00`
}

// ── Extraire date et heure d'un ISO string ────────────────────────────────────
function fromISO(isoStr) {
  if (!isoStr) return { date: '', time: '' }
  const d = new Date(isoStr)
  const date = d.toLocaleDateString('sv-SE')  // "YYYY-MM-DD"
  const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  return { date, time }
}

export default function RDVForm({ rdv, patients = [], role = 'dentiste', onSubmit, onCancel, loading = false, error = null }) {
  const isEdit = !!rdv
  const existing = rdv ? fromISO(rdv.date_heure) : { date: '', time: '' }

  const [form, setForm] = useState({
    patient:              rdv?.patient_id  || '',
    date:                 existing.date    || '',
    time:                 existing.time    || '',
    duree_minutes:        rdv?.duree_minutes || 30,
    type_soin:            rdv?.type_soin   || 'CONSULTATION',
    priorite:             rdv?.priorite    || 'NORMALE',
    motif:                rdv?.motif       || '',
    note_interne:         rdv?.note_interne || '',
    instructions_patient: rdv?.instructions_patient || '',
  })

  const [formError, setFormError] = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e) {
    e.preventDefault()
    setFormError('')

    if (!form.patient)      { setFormError('Veuillez sélectionner un patient.'); return }
    if (!form.date)         { setFormError('Veuillez choisir une date.'); return }
    if (!form.time)         { setFormError('Veuillez choisir une heure.'); return }
    if (form.duree_minutes < 5) { setFormError('La durée minimale est 5 minutes.'); return }

    const date_heure = toISO(form.date, form.time)

    // Vérifier que la date est dans le futur (validate_date_heure côté backend aussi)
    if (!isEdit && new Date(date_heure) <= new Date()) {
      setFormError('La date et l\'heure doivent être dans le futur.')
      return
    }

    try {
      await onSubmit({
        patient:              form.patient,
        date_heure,
        duree_minutes:        parseInt(form.duree_minutes, 10),
        type_soin:            form.type_soin,
        priorite:             form.priorite,
        motif:                form.motif     || undefined,
        note_interne:         form.note_interne || undefined,
        instructions_patient: form.instructions_patient || undefined,
      })
    } catch (err) {
      const d = err?.response?.data
      if (d?.date_heure) setFormError(`Date : ${d.date_heure[0] || d.date_heure}`)
      else if (d?.detail) setFormError(d.detail)
      else if (d?.non_field_errors) setFormError(d.non_field_errors[0])
      else setFormError('Erreur de validation.')
    }
  }

  const displayError = formError || error

  // Date minimum = aujourd'hui
  const today = new Date().toLocaleDateString('sv-SE')

  return (
    <form onSubmit={handleSubmit}>
      {displayError && (
        <div className="alert alert-error" style={{ marginBottom: 16 }}>{displayError}</div>
      )}

      {/* Patient */}
      <div className="form-group">
        <label className="form-label">
          Patient <span style={{ color: '#ef4444' }}>*</span>
        </label>
        <select
          className="form-select"
          value={form.patient}
          onChange={e => set('patient', e.target.value)}
          required
          disabled={isEdit}
        >
          <option value="">— Sélectionner un patient —</option>
          {patients.map(p => (
            <option key={p.id} value={p.id}>
              {p.nom_complet || `${p.prenom} ${p.nom}`}
            </option>
          ))}
        </select>
        {patients.length === 0 && (
          <p style={{ fontSize: 11, color: '#f59e0b', marginTop: 4 }}>
            Aucun patient accepté disponible.
          </p>
        )}
      </div>

      {/* Date + heure */}
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Date <span style={{ color: '#ef4444' }}>*</span></label>
          <input
            type="date"
            className="form-input"
            value={form.date}
            min={isEdit ? undefined : today}
            onChange={e => set('date', e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label className="form-label">Heure <span style={{ color: '#ef4444' }}>*</span></label>
          <input
            type="time"
            className="form-input"
            value={form.time}
            onChange={e => set('time', e.target.value)}
            required
          />
        </div>
      </div>

      {/* Durée + Type */}
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Durée (minutes)</label>
          <input
            type="number"
            className="form-input"
            value={form.duree_minutes}
            min={5}
            max={480}
            onChange={e => set('duree_minutes', e.target.value)}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Type de soin</label>
          <select
            className="form-select"
            value={form.type_soin}
            onChange={e => set('type_soin', e.target.value)}
          >
            {Object.entries(TYPE_SOIN_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Priorité */}
      <div className="form-group">
        <label className="form-label">Priorité</label>
        <div style={{ display: 'flex', gap: 8 }}>
          {Object.entries(PRIORITE_LABELS).map(([k, v]) => (
            <label key={k} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 14px', borderRadius: 8, cursor: 'pointer',
              border: `1.5px solid ${form.priorite === k ? '#00acc1' : '#e5e7eb'}`,
              background: form.priorite === k ? '#e0f7f5' : '#fff',
              fontSize: 13, fontWeight: form.priorite === k ? 500 : 400,
              color: form.priorite === k ? '#00838f' : '#374151',
              transition: 'all .15s',
            }}>
              <input
                type="radio"
                name="priorite"
                value={k}
                checked={form.priorite === k}
                onChange={() => set('priorite', k)}
                style={{ display: 'none' }}
              />
              {k === 'URGENTE' ? '🔴' : k === 'HAUTE' ? '🟡' : '🟢'} {v}
            </label>
          ))}
        </div>
      </div>

      {/* Motif */}
      <div className="form-group">
        <label className="form-label">Motif de la consultation</label>
        <input
          className="form-input"
          placeholder="Douleur, contrôle annuel..."
          value={form.motif}
          onChange={e => set('motif', e.target.value)}
        />
      </div>

      {/* Note interne — dentiste uniquement */}
      {role === 'dentiste' && (
        <div className="form-group">
          <label className="form-label">Note interne (visible dentiste uniquement)</label>
          <textarea
            className="form-textarea"
            placeholder="Observations, précautions..."
            value={form.note_interne}
            onChange={e => set('note_interne', e.target.value)}
            rows={2}
          />
        </div>
      )}

      {/* Instructions patient */}
      <div className="form-group">
        <label className="form-label">Instructions pour le patient</label>
        <textarea
          className="form-textarea"
          placeholder="Venir à jeun, apporter les radios..."
          value={form.instructions_patient}
          onChange={e => set('instructions_patient', e.target.value)}
          rows={2}
        />
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={loading}>
          Annuler
        </button>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading
            ? <span className="spinner" />
            : isEdit ? 'Enregistrer' : 'Créer le rendez-vous'}
        </button>
      </div>
    </form>
  )
}