/**
 * src/pages/dentiste/MesPatientsPage.jsx
 * ✅ Logique 100% conservée
 * 🎨 UI redesignée — grille de cartes style Lovable
 */

import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { usePatients } from "../../hooks/usePatients";
import { archiverPatient } from "../../api/patientsAPI";
import PatientForm from "../../components/patients/PatientForm";
import Pagination from "../../components/ui/Pagination";
import InlineError from "../../components/ui/InlineError";
import PageState from "../../components/ui/PageState";
import { useToast } from "../../context/ToastContext";
import { extractErrorMessage } from "../../utils/errorHandler";

const STATUT_LABELS = { ACCEPTE: "Actif", PENDING: "En attente", REFUSE: "Refusé" };
const STATUT_STYLE  = {
  ACCEPTE: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  PENDING: "bg-orange-50 text-orange-600 border border-orange-200",
  REFUSE:  "bg-red-50 text-red-600 border border-red-200",
};

export default function MesPatientsPage() {
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();
  const { patients, loading, error, fetchPatients, validerPatient } = usePatients();

  const [total,       setTotal]       = useState(0);
  const [showForm,    setShowForm]    = useState(false);
  const [editPatient, setEditPatient] = useState(null);
  const [search,      setSearch]      = useState("");
  const [statut,      setStatut]      = useState("");
  const [page,        setPage]        = useState(1);

  // Modal refus
  const [refusModal,      setRefusModal]      = useState(false);
  const [refusPatient,    setRefusPatient]    = useState(null);
  const [refusRaison,     setRefusRaison]     = useState("");
  const [refusSubmitting, setRefusSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const params = { page, ordering: "-created_at" };
      if (search) params.search = search;
      if (statut) params.statut = statut;
      const list = await fetchPatients(params);
      setTotal(Array.isArray(list) ? list.length : 0);
    } catch (err) {
      showError(extractErrorMessage(err));
    }
  }, [search, statut, page, fetchPatients, showError]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const t = setTimeout(() => setPage(1), 400);
    return () => clearTimeout(t);
  }, [search]);

  const handleArchiver = async (id, nom) => {
    if (!window.confirm(`Archiver le patient ${nom} ?`)) return;
    try {
      await archiverPatient(id);
      showSuccess(`Patient ${nom} archivé.`);
      load();
    } catch (err) { showError(extractErrorMessage(err)); }
  };

  const handleAccepter = async (id, nom) => {
    try {
      await validerPatient(id, "ACCEPTE");
      showSuccess(`Patient ${nom} accepté.`);
    } catch (err) { showError(extractErrorMessage(err)); }
  };

  const ouvrirRefus = (patient) => {
    setRefusPatient(patient);
    setRefusRaison("");
    setRefusModal(true);
  };

  const confirmerRefus = async () => {
    if (!refusRaison.trim()) { showError("La raison du refus est obligatoire."); return; }
    setRefusSubmitting(true);
    try {
      await validerPatient(refusPatient.id, "REFUSE", refusRaison);
      showSuccess(`Patient ${refusPatient.nom_complet} refusé.`);
      setRefusModal(false);
    } catch (err) { showError(extractErrorMessage(err)); }
    finally { setRefusSubmitting(false); }
  };

  const PAGE_SIZE  = 20;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="flex flex-col gap-5">

      {/* ── Toolbar ─────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mes patients</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {patients.length} patient{patients.length !== 1 ? "s" : ""} trouvé{patients.length !== 1 ? "s" : ""}
            {search && ` · "${search}"`}
          </p>
        </div>
        <button
          onClick={() => { setEditPatient(null); setShowForm(true); }}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold shadow-sm hover:opacity-90 active:scale-[0.97] transition-all flex-shrink-0"
          style={{ background: "linear-gradient(135deg, #1aa3c8, #0e8faf)" }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
          </svg>
          Nouveau patient
        </button>
      </div>

      {/* ── Barre recherche + filtre ─────────────────────────────── */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
              <circle cx="11" cy="11" r="8"/><path strokeLinecap="round" d="M21 21l-4.35-4.35"/>
            </svg>
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par nom, téléphone ou email..."
            className="w-full pl-10 pr-4 py-2.5 text-sm bg-white border border-gray-200 rounded-xl placeholder-gray-400 outline-none focus:border-[#1aa3c8] focus:ring-2 focus:ring-[#1aa3c8]/10 transition shadow-sm"
          />
        </div>
        <select
          value={statut}
          onChange={(e) => setStatut(e.target.value)}
          className="px-3 py-2.5 text-sm bg-white border border-gray-200 rounded-xl outline-none focus:border-[#1aa3c8] focus:ring-2 focus:ring-[#1aa3c8]/10 transition shadow-sm text-gray-700"
        >
          <option value="">Tous les statuts</option>
          <option value="ACCEPTE">Actifs</option>
          <option value="PENDING">En attente</option>
          <option value="REFUSE">Refusés</option>
        </select>
      </div>

      <InlineError message={error} />

      {/* ── Grille cartes patients ───────────────────────────────── */}
      {loading ? (
        <PageState type="loading" />
      ) : patients.length === 0 ? (
        <PageState type="empty" message="Aucun patient trouvé." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {patients.map((p) => (
            <PatientCard
              key={p.id}
              patient={p}
              onView={() => navigate(`/dentiste/patients/${p.id}`)}
              onEdit={() => { setEditPatient(p); setShowForm(true); }}
              onAccepter={() => handleAccepter(p.id, p.nom_complet)}
              onRefuser={() => ouvrirRefus(p)}
              onArchiver={() => handleArchiver(p.id, p.nom_complet)}
            />
          ))}
        </div>
      )}

      <Pagination page={page} totalPages={totalPages} onChange={setPage} />

      {/* ── Modal formulaire patient ─────────────────────────────── */}
      {showForm && (
        <PatientForm
          patient={editPatient}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); }}
        />
      )}

      {/* ── Modal refus ─────────────────────────────────────────── */}
      {refusModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setRefusModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
            <h3 className="text-base font-semibold text-gray-900 mb-1">
              Refuser le patient
            </h3>
            <p className="text-sm text-gray-500 mb-4">{refusPatient?.nom_complet}</p>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Raison du refus <span className="text-red-500">*</span>
            </label>
            <textarea
              value={refusRaison}
              onChange={(e) => setRefusRaison(e.target.value)}
              rows={3}
              placeholder="Indiquez la raison du refus…"
              autoFocus
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl outline-none focus:border-red-300 focus:ring-2 focus:ring-red-100 transition resize-none"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setRefusModal(false)}
                disabled={refusSubmitting}
                className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition"
              >
                Annuler
              </button>
              <button
                onClick={confirmerRefus}
                disabled={refusSubmitting || !refusRaison.trim()}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-red-500 hover:bg-red-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {refusSubmitting ? "Envoi…" : "Confirmer le refus"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Carte patient ─────────────────────────────────────────────────────────────
function PatientCard({ patient: p, onView, onEdit, onAccepter, onRefuser, onArchiver }) {
  const initials = `${(p.prenom || "")[0] || ""}${(p.nom || "")[0] || ""}`.toUpperCase();

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow flex flex-col overflow-hidden">
      {/* Header carte */}
      <div className="p-5 flex items-start gap-3 flex-1">
        {/* Avatar */}
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-base flex-shrink-0"
          style={{ background: "linear-gradient(135deg, #1aa3c8, #0e8faf)" }}
        >
          {initials}
        </div>

        <div className="flex-1 min-w-0">
          {/* Nom cliquable + badge statut */}
          <div className="flex items-start justify-between gap-2 mb-1">
            <button
              onClick={onView}
              className="text-sm font-bold text-gray-900 hover:text-[#1aa3c8] transition-colors text-left leading-tight"
            >
              {p.nom_complet}
            </button>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${STATUT_STYLE[p.statut] || "bg-gray-100 text-gray-600"}`}>
              {STATUT_LABELS[p.statut] || p.statut}
            </span>
          </div>

          {/* Sexe + date naissance */}
          <p className="text-xs text-gray-400 mb-3">
            {p.sexe === "M" ? "♂" : p.sexe === "F" ? "♀" : ""} • {p.date_naissance}
          </p>

          {/* Contacts */}
          <div className="flex flex-col gap-1.5">
            {p.telephone && (
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
                </svg>
                {p.telephone}
              </div>
            )}
            {p.email && (
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                </svg>
                <span className="truncate">{p.email}</span>
              </div>
            )}
          </div>

          {/* Alerte médicale */}
          {p.nb_alertes_critiques > 0 && (
            <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-600 border border-red-200">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
              </svg>
              {p.nb_alertes_critiques} alerte{p.nb_alertes_critiques > 1 ? "s" : ""}
            </div>
          )}
        </div>
      </div>

      {/* Dentiste référent */}
      {p.dentiste_nom && (
        <div className="px-5 pb-3">
          <p className="text-xs text-gray-400">{p.dentiste_nom}</p>
        </div>
      )}

      {/* Footer actions */}
      <div className="border-t border-gray-100 px-4 py-3 flex items-center justify-between gap-2 bg-gray-50/50">
        {/* Actions primaires */}
        <div className="flex items-center gap-2">
          <button
            onClick={onView}
            title="Voir le dossier"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:bg-cyan-50 hover:text-[#1aa3c8] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0zm-9.543 0C3.732 7.943 7.522 5 12 5c4.478 0 8.268 2.943 9.543 7-1.275 4.057-5.065 7-9.543 7-4.478 0-8.268-2.943-9.543-7z"/>
            </svg>
          </button>
          <button
            onClick={onEdit}
            title="Modifier"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:bg-blue-50 hover:text-blue-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
            </svg>
          </button>
          <button
            onClick={onArchiver}
            title="Archiver"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/>
            </svg>
          </button>
        </div>

        {/* Valider si PENDING */}
        {p.statut === "PENDING" && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={onAccepter}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#1aa3c8] text-white hover:opacity-90 transition"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
              </svg>
              Accepter
            </button>
            <button
              onClick={onRefuser}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 transition"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
              </svg>
              Refuser
            </button>
          </div>
        )}
      </div>
    </div>
  );
}