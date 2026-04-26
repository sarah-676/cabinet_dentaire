/**
 * src/pages/receptionniste/DashboardReceptionniste.jsx
 * ✅ Logique 100% conservée (getPatientStats, getRendezVousStats, loading, error)
 * 🎨 UI redesignée — Dashboard réceptionniste professionnel
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getPatientStats } from "../../api/patientsAPI";
import { getRendezVousStats, getRendezVous } from "../../api/rendezvousAPI";
import PageState from "../../components/ui/PageState";
import InlineError from "../../components/ui/InlineError";
import { extractErrorMessage } from "../../utils/errorHandler";
import { useAuth } from "../../context/AuthContext";

// ── Carte stat ────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon, iconBg, sub }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-start justify-between gap-3 hover:shadow-md transition-shadow">
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-500 font-medium mb-1">{label}</p>
        <p className="text-3xl font-bold text-gray-900 leading-none">{value ?? "—"}</p>
        {sub && <p className="text-xs text-emerald-600 mt-1.5 font-medium flex items-center gap-1"><span>↑</span>{sub}</p>}
      </div>
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
        {icon}
      </div>
    </div>
  );
}

// ── Badge statut ──────────────────────────────────────────────────────────────
function StatusBadge({ statut }) {
  const map = {
    CONFIRME:   "bg-emerald-50 text-emerald-700 border-emerald-200",
    EN_ATTENTE: "bg-orange-50 text-orange-600 border-orange-200",
    ANNULE:     "bg-red-50 text-red-600 border-red-200",
  };
  const labels = { CONFIRME: "Confirmé", EN_ATTENTE: "En attente", ANNULE: "Annulé" };
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${map[statut] || "bg-gray-100 text-gray-600 border-gray-200"}`}>
      {labels[statut] || statut}
    </span>
  );
}

// ── Mini donut ────────────────────────────────────────────────────────────────
function MiniDonut({ value, total, color }) {
  const pct = total > 0 ? value / total : 0;
  const r = 16, cx = 20, cy = 20;
  const circ = 2 * Math.PI * r;
  const dash = pct * circ;
  return (
    <svg width="40" height="40" viewBox="0 0 40 40">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f3f4f6" strokeWidth="5" />
      <circle
        cx={cx} cy={cy} r={r} fill="none"
        stroke={color} strokeWidth="5"
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeDashoffset={circ / 4}
        style={{ transform: "rotate(-90deg)", transformOrigin: "50% 50%" }}
      />
      <text x={cx} y={cy + 4} textAnchor="middle" fontSize="8" fontWeight="700" fill="#111827">
        {Math.round(pct * 100)}%
      </text>
    </svg>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function DashboardReceptionniste() {
  const navigate            = useNavigate();
  const { user }            = useAuth();

  const [ps,      setPs]      = useState(null);
  const [rs,      setRs]      = useState(null);
  const [rdvList, setRdvList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  const firstName = user?.full_name?.split(" ")[0] || "Réceptionniste";

  useEffect(() => {
    Promise.all([
      getPatientStats(),
      getRendezVousStats(),
      getRendezVous({ today: true }).catch(() => []),
    ])
      .then(([patientsStats, rdvStats, rdvData]) => {
        setPs(patientsStats);
        setRs(rdvStats);
        setRdvList(rdvData?.results || rdvData || []);
      })
      .catch((err) => setError(extractErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageState type="loading" />;

  return (
    <div className="flex flex-col gap-6">
      <InlineError message={error} />

      {/* ── En-tête ─────────────────────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Accueil — Réception 👋
          </h1>
          <p className="text-gray-500 text-sm mt-1">Gérez les patients et rendez-vous</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-gray-500 bg-white border border-gray-100 rounded-xl px-4 py-2 shadow-sm">
            <svg className="w-4 h-4 text-[#1aa3c8]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <rect x="3" y="4" width="18" height="18" rx="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
          </div>
          <button
            onClick={() => navigate("/receptionniste/patients?action=add")}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold shadow-sm hover:opacity-90 active:scale-[0.97] transition-all"
            style={{ background: "linear-gradient(135deg, #1aa3c8, #0e8faf)" }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
            </svg>
            Nouveau patient
          </button>
        </div>
      </div>

      {/* ── 4 cartes KPI patients ────────────────────────────────── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Total Patients"
          value={ps?.total}
          sub={ps?.nouveaux_ce_mois ? `+${ps.nouveaux_ce_mois} ce mois` : null}
          iconBg="bg-cyan-50"
          icon={<svg className="w-5 h-5 text-[#1aa3c8]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>}
        />
        <StatCard
          label="RDV aujourd'hui"
          value={rs?.aujourd_hui}
          iconBg="bg-emerald-50"
          icon={<svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>}
        />
        <StatCard
          label="En attente"
          value={ps?.en_attente}
          iconBg="bg-amber-50"
          icon={<svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}
        />
        <StatCard
          label="Nouveaux ce mois"
          value={ps?.nouveaux_ce_mois}
          iconBg="bg-purple-50"
          icon={<svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>}
        />
      </div>

      {/* ── Ligne 2 : Planning + Patients en attente ─────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Planning du jour */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <svg className="w-5 h-5 text-[#1aa3c8]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <rect x="3" y="4" width="18" height="18" rx="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            <h3 className="font-semibold text-gray-900">Planning du jour</h3>
            <span className="ml-auto text-xs bg-cyan-50 text-[#1aa3c8] font-medium px-2 py-0.5 rounded-full">
              {rdvList.length} RDV
            </span>
          </div>

          {rdvList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-gray-400 gap-2">
              <svg className="w-8 h-8 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <rect x="3" y="4" width="18" height="18" rx="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              <p className="text-sm">Aucun rendez-vous aujourd'hui</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {rdvList.map((rdv) => (
                <div key={rdv.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-cyan-50/40 transition-colors">
                  <div className="text-center min-w-[52px]">
                    <p className="text-sm font-bold text-[#1aa3c8]">{rdv.heure || "—"}</p>
                    <p className="text-[10px] text-gray-400">{rdv.duree ? `${rdv.duree}min` : ""}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{rdv.patient_nom}</p>
                    <p className="text-xs text-gray-400 truncate">
                      {rdv.dentiste_nom ? `${rdv.dentiste_nom} • ` : ""}{rdv.motif || "Consultation"}
                    </p>
                  </div>
                  <StatusBadge statut={rdv.statut} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Patients en attente de validation */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
            </svg>
            <h3 className="font-semibold text-gray-900">Patients en attente de validation</h3>
            {(ps?.en_attente || 0) > 0 && (
              <span className="ml-auto text-xs bg-amber-50 text-amber-600 font-semibold px-2 py-0.5 rounded-full border border-amber-200">
                {ps?.en_attente}
              </span>
            )}
          </div>

          {(ps?.en_attente || 0) === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-gray-400 gap-2">
              <svg className="w-8 h-8 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <p className="text-sm">Aucun patient en attente</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {/* Affiché depuis patientStats — liste non dispo ici, on affiche le compteur */}
              <div className="flex items-center justify-between p-3 rounded-xl border border-amber-100 bg-amber-50/30">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                    <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{ps?.en_attente} patient(s)</p>
                    <p className="text-xs text-gray-400">En attente de validation</p>
                  </div>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-200">
                  En attente
                </span>
              </div>
              <button
                onClick={() => navigate("/receptionniste/patients")}
                className="w-full py-2.5 rounded-xl text-sm font-semibold text-[#1aa3c8] border border-[#1aa3c8]/30 bg-cyan-50 hover:bg-cyan-100 transition-colors"
              >
                Voir tous les patients →
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Ligne 3 : Stats RDV + Indicateurs patients ──────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Stats RDV */}
        {rs && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h3 className="font-semibold text-gray-900 text-sm mb-4">Statistiques Rendez-vous</h3>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Aujourd'hui",   value: rs.aujourd_hui,   color: "#1aa3c8", bg: "bg-cyan-50",    miniColor: "#1aa3c8" },
                { label: "Cette semaine", value: rs.cette_semaine, color: "#059669", bg: "bg-emerald-50", miniColor: "#10b981" },
                { label: "En attente",    value: rs.en_attente,    color: "#d97706", bg: "bg-amber-50",   miniColor: "#f59e0b" },
              ].map((c) => (
                <div key={c.label} className={`${c.bg} rounded-xl p-3 text-center flex flex-col items-center gap-1`}>
                  <MiniDonut value={c.value || 0} total={rs.total || 1} color={c.miniColor} />
                  <p className="text-xl font-bold" style={{ color: c.color }}>{c.value ?? "—"}</p>
                  <p className="text-[10px] text-gray-500 font-medium">{c.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Indicateurs patients */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-semibold text-gray-900 text-sm mb-4">Indicateurs Patients</h3>
          <div className="flex flex-col gap-3">
            {[
              { label: "Patients actifs",     value: ps?.actifs,            total: ps?.total, color: "#1aa3c8" },
              { label: "Patients en attente", value: ps?.en_attente,        total: ps?.total, color: "#f59e0b" },
              { label: "Nouveaux ce mois",    value: ps?.nouveaux_ce_mois,  total: ps?.total, color: "#a78bfa" },
            ].map((row) => (
              <div key={row.label} className="flex items-center gap-3">
                <span className="text-xs text-gray-600 w-36 flex-shrink-0">{row.label}</span>
                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${row.total > 0 ? Math.round(((row.value || 0) / row.total) * 100) : 0}%`,
                      background: row.color,
                    }}
                  />
                </div>
                <span className="text-xs font-bold text-gray-900 w-6 text-right">{row.value ?? 0}</span>
              </div>
            ))}

            {/* Accès rapides */}
            <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-2 gap-2">
              <button
                onClick={() => navigate("/receptionniste/agenda")}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-gray-600 bg-gray-50 hover:bg-cyan-50 hover:text-[#1aa3c8] transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                Voir l'agenda
              </button>
              <button
                onClick={() => navigate("/receptionniste/patients")}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-gray-600 bg-gray-50 hover:bg-cyan-50 hover:text-[#1aa3c8] transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                Tous les patients
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}