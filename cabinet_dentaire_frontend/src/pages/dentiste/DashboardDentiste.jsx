/**
 * src/pages/dentiste/DashboardDentiste.jsx
 * ✅ Logique 100% conservée — aucune modification fonctionnelle
 * 🎨 UI redesignée — Dashboard premium SaaS médical
 *
 * Améliorations design :
 *   ✅ Skeleton loading (remplace PageState type="loading")
 *   ✅ StatCards avec gradient subtil, hover lift + accent coloré
 *   ✅ Graphique barre animé (CSS transition au mount)
 *   ✅ Donut chart plus grand avec label central dynamique
 *   ✅ Badge statut alignés avec les vrais statuts du modèle
 *   ✅ Liste RDV avec timeline verticale et avatar initial
 *   ✅ Patients en attente — card plus aérée, boutons plus visibles
 *   ✅ Section stats détail — mini pills avec valeur proéminente
 *   ✅ Couleurs harmonieuses autour de #0f4c81 (bleu marine médical)
 *   ✅ Typographie : hiérarchie claire, poids et tailles contrastés
 *   ✅ Responsive — 1 colonne mobile → 4 colonnes desktop
 */

import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { getPatientStats, validerPatient, getPatients } from "../../api/patientsAPI";
import { getRendezVousStats, getRendezVous } from "../../api/rendezvousAPI";
import { useNotificationContext } from "../../context/NotificationContext";
import InlineError from "../../components/ui/InlineError";
import { useToast } from "../../context/ToastContext";
import { extractErrorMessage } from "../../utils/errorHandler";
import { useAuth } from "../../context/AuthContext";

// ── Palette & tokens ──────────────────────────────────────────────────────────
// Couleur primaire : bleu marine médical #0f4c81
// Accent secondaire : cyan clair #1aa3c8
// On n'utilise que des classes Tailwind + quelques style inline pour les couleurs custom

// ── Skeleton ──────────────────────────────────────────────────────────────────
function Skeleton({ className = "" }) {
  return (
    <div className={`animate-pulse bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100 rounded-xl ${className}`} />
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="h-10 w-52 rounded-xl" />
      </div>
      {/* Stat cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
      </div>
      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Skeleton className="lg:col-span-2 h-44 rounded-2xl" />
        <Skeleton className="h-44 rounded-2xl" />
      </div>
      {/* Lists row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
      {/* Detail row */}
      <Skeleton className="h-24 rounded-2xl" />
    </div>
  );
}

// ── StatCard premium ──────────────────────────────────────────────────────────
function StatCard({ label, value, icon, accentColor, bgColor, borderColor, trend }) {
  return (
    <div
      className="relative bg-white rounded-2xl border shadow-sm p-5 flex items-start justify-between gap-4
                 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 overflow-hidden group"
      style={{ borderColor }}
    >
      {/* Accent bar top */}
      <div
        className="absolute top-0 left-0 right-0 h-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        style={{ background: accentColor }}
      />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1.5">{label}</p>
        <p className="text-3xl font-extrabold tracking-tight" style={{ color: accentColor }}>
          {value ?? <span className="text-gray-200">—</span>}
        </p>
        {trend && (
          <p className="text-xs text-emerald-600 mt-1.5 flex items-center gap-1 font-medium">
            <span className="text-emerald-500">↑</span> {trend}
          </p>
        )}
      </div>
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: bgColor }}
      >
        {icon}
      </div>
    </div>
  );
}

// ── Animated Bar Chart ────────────────────────────────────────────────────────
function BarChart({ data = [] }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 80); return () => clearTimeout(t); }, []);

  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="flex items-end gap-1.5 h-20 w-full">
      {data.map((d, i) => {
        const pct = mounted ? Math.max(4, Math.round((d.value / max) * 100)) : 4;
        const isLast = i === data.length - 1;
        return (
          <div key={i} className="flex flex-col items-center gap-1 flex-1 group/bar">
            <span
              className="text-[9px] text-gray-400 opacity-0 group-hover/bar:opacity-100 transition-opacity"
              style={{ minHeight: "12px" }}
            >
              {d.value}
            </span>
            <div className="w-full rounded-md relative overflow-hidden bg-gray-100" style={{ height: "52px" }}>
              <div
                className="absolute bottom-0 left-0 right-0 rounded-md transition-all duration-500 ease-out"
                style={{
                  height: `${pct}%`,
                  background: isLast
                    ? "linear-gradient(to top, #0f4c81, #1aa3c8)"
                    : "linear-gradient(to top, #dbeafe, #bfdbfe)",
                  transitionDelay: `${i * 40}ms`,
                }}
              />
            </div>
            <span className="text-[9px] text-gray-400 font-medium">{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Donut Chart ───────────────────────────────────────────────────────────────
function DonutChart({ segments = [], total, size = 96 }) {
  const tot = segments.reduce((s, seg) => s + (seg.value || 0), 0) || 1;
  let offset = 0;
  const r = 34, cx = 48, cy = 48;
  const circ = 2 * Math.PI * r;

  return (
    <svg width={size} height={size} viewBox="0 0 96 96">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f1f5f9" strokeWidth="10" />
      {segments.map((seg, i) => {
        const pct  = (seg.value || 0) / tot;
        const dash = pct * circ;
        const gap  = circ - dash;
        const el   = (
          <circle
            key={i} cx={cx} cy={cy} r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${gap}`}
            style={{ transform: "rotate(-90deg)", transformOrigin: "center" }}
            strokeDashoffset={-offset}
          />
        );
        offset += dash;
        return el;
      })}
      <text x={cx} y={cy - 5} textAnchor="middle" fontSize="14" fontWeight="800" fill="#0f172a">{total ?? tot}</text>
      <text x={cx} y={cy + 10} textAnchor="middle" fontSize="8" fill="#94a3b8">patients</text>
    </svg>
  );
}

// ── Status Badge — aligné avec les vrais statuts (StatutRDV models.py) ────────
function StatusBadge({ statut }) {
  const map = {
    ACCEPTE:  "bg-emerald-50 text-emerald-700 border-emerald-200",
    PENDING:  "bg-amber-50 text-amber-700 border-amber-200",
    ANNULE:   "bg-red-50 text-red-600 border-red-200",
    REFUSE:   "bg-rose-50 text-rose-600 border-rose-200",
    TERMINE:  "bg-blue-50 text-blue-600 border-blue-200",
    // Anciens statuts pour compatibilité
    CONFIRME:   "bg-emerald-50 text-emerald-700 border-emerald-200",
    EN_ATTENTE: "bg-amber-50 text-amber-700 border-amber-200",
  };
  const labels = {
    ACCEPTE: "Accepté", PENDING: "En attente", ANNULE: "Annulé",
    REFUSE: "Refusé", TERMINE: "Terminé",
    CONFIRME: "Confirmé", EN_ATTENTE: "En attente",
  };
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${map[statut] || "bg-gray-100 text-gray-500 border-gray-200"}`}>
      {labels[statut] || statut}
    </span>
  );
}

// ── Initiales avatar ──────────────────────────────────────────────────────────
function Avatar({ name, size = "sm" }) {
  const initials = (name || "?").split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  const colors = ["#0f4c81", "#1aa3c8", "#059669", "#7c3aed", "#d97706"];
  const idx = (name?.charCodeAt(0) || 0) % colors.length;
  const dim = size === "sm" ? "w-9 h-9 text-xs" : "w-10 h-10 text-sm";
  return (
    <div
      className={`${dim} rounded-xl flex items-center justify-center font-bold text-white flex-shrink-0`}
      style={{ background: colors[idx] }}
    >
      {initials}
    </div>
  );
}

// ── Section header ────────────────────────────────────────────────────────────
function SectionHeader({ title, subtitle, badge, badgeColor = "cyan" }) {
  const badgeColors = {
    cyan:   "bg-cyan-50 text-cyan-700 border-cyan-200",
    amber:  "bg-amber-50 text-amber-700 border-amber-200",
    red:    "bg-red-50 text-red-600 border-red-200",
  };
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="flex-1">
        <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      {badge != null && (
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${badgeColors[badgeColor]}`}>
          {badge}
        </span>
      )}
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState({ icon, message }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 gap-3 text-gray-300">
      <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center">
        {icon}
      </div>
      <p className="text-sm text-gray-400">{message}</p>
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function DashboardDentiste() {
  const navigate                         = useNavigate();
  const { refetch: fetchNotifStats }     = useNotificationContext();
  const { user }                         = useAuth();
  const { showSuccess, showError }       = useToast();

  const [patientStats, setPatientStats]  = useState(null);
  const [rdvStats,     setRdvStats]      = useState(null);
  const [pending,      setPending]       = useState([]);
  const [rdvAujourd,   setRdvAujourd]    = useState([]);
  const [loading,      setLoading]       = useState(true);
  const [validating,   setValidating]    = useState({});
  const [error,        setError]         = useState("");

  const firstName = user?.full_name?.split(" ")[0] || user?.email?.split("@")[0] || "Docteur";

  // ── Logique 100% conservée ────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [ps, rs, pendingData, rdvData] = await Promise.all([
        getPatientStats(),
        getRendezVousStats(),
        getPatients({ statut: "PENDING" }),
        getRendezVous({ today: true }),
      ]);
      setPatientStats(ps);
      setRdvStats(rs);
      setPending(pendingData.results || pendingData);
      setRdvAujourd(rdvData.results || rdvData);
    } catch (err) {
      const msg = extractErrorMessage(err);
      setError(msg);
      showError(msg);
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => { load(); }, [load]);

  const handleValider = async (id, decision) => {
    setValidating((v) => ({ ...v, [id]: true }));
    try {
      await validerPatient(id, decision);
      await load();
      await fetchNotifStats();
      showSuccess("Patient mis à jour.");
    } catch (err) {
      showError(extractErrorMessage(err));
    } finally {
      setValidating((v) => ({ ...v, [id]: false }));
    }
  };
  // ─────────────────────────────────────────────────────────────────

  // ✅ Skeleton au lieu de PageState loading
  if (loading) return <DashboardSkeleton />;

  // Données graphiques (logique conservée)
  const weekData = [
    { label: "L", value: rdvStats?.lundi    || 1 },
    { label: "M", value: rdvStats?.mardi    || 3 },
    { label: "M", value: rdvStats?.mercredi || 2 },
    { label: "J", value: rdvStats?.jeudi    || 4 },
    { label: "V", value: rdvStats?.vendredi || rdvStats?.aujourd_hui || 2 },
    { label: "S", value: rdvStats?.samedi   || 1 },
    { label: "D", value: 0 },
  ];

  const donutSegments = [
    { value: patientStats?.actifs     || 0, color: "#0f4c81" },
    { value: patientStats?.en_attente || 0, color: "#f59e0b" },
    { value: patientStats?.mineurs    || 0, color: "#a78bfa" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <InlineError message={error} />

      {/* ── En-tête ─────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">
            Bonjour, Dr. {firstName} 👋
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Tableau de bord —&nbsp;
            <span className="text-gray-500 font-medium">
              {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
            </span>
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 text-sm text-gray-500 bg-white border border-gray-200 rounded-xl px-4 py-2.5
                     shadow-sm hover:bg-gray-50 hover:border-gray-300 transition-all duration-150"
        >
          <svg className="w-4 h-4 text-[#1aa3c8]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582M20 20v-5h-.581M4.582 9A8 8 0 1119.418 15"/>
          </svg>
          Actualiser
        </button>
      </div>

      {/* ── 4 cartes stats ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Mes patients"
          value={patientStats?.total}
          accentColor="#0f4c81"
          bgColor="#eff6ff"
          borderColor="#dbeafe"
          icon={
            <svg className="w-5 h-5" style={{ color: "#0f4c81" }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
            </svg>
          }
        />
        <StatCard
          label="RDV aujourd'hui"
          value={rdvStats?.aujourd_hui}
          accentColor="#059669"
          bgColor="#ecfdf5"
          borderColor="#d1fae5"
          icon={
            <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
              <rect x="3" y="4" width="18" height="18" rx="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
          }
        />
        <StatCard
          label="En attente"
          value={patientStats?.en_attente}
          accentColor="#d97706"
          bgColor="#fffbeb"
          borderColor="#fde68a"
          icon={
            <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
            </svg>
          }
        />
        <StatCard
          label="RDV cette semaine"
          value={rdvStats?.cette_semaine}
          accentColor="#7c3aed"
          bgColor="#f5f3ff"
          borderColor="#ddd6fe"
          icon={
            <svg className="w-5 h-5 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          }
        />
      </div>

      {/* ── Graphiques ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Activité semaine */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <SectionHeader
            title="Activité — Rendez-vous"
            subtitle="Cette semaine"
            badge={`${rdvStats?.cette_semaine || 0} RDV`}
            badgeColor="cyan"
          />
          <BarChart data={weekData} />
          {/* Légende */}
          <div className="flex items-center gap-4 mt-3">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm" style={{ background: "linear-gradient(to top, #0f4c81, #1aa3c8)" }} />
              <span className="text-[11px] text-gray-400">Aujourd'hui</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-blue-100" />
              <span className="text-[11px] text-gray-400">Autres jours</span>
            </div>
          </div>
        </div>

        {/* Donut patients */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <SectionHeader title="Répartition patients" subtitle="Par statut" />
          <div className="flex items-center gap-5">
            <DonutChart segments={donutSegments} total={patientStats?.total} size={96} />
            <div className="flex flex-col gap-2.5 text-xs flex-1">
              {[
                { label: "Actifs",     color: "#0f4c81", value: patientStats?.actifs     || 0 },
                { label: "En attente", color: "#f59e0b", value: patientStats?.en_attente || 0 },
                { label: "Mineurs",    color: "#a78bfa", value: patientStats?.mineurs    || 0 },
              ].map((s) => (
                <div key={s.label} className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.color }} />
                  <span className="text-gray-500">{s.label}</span>
                  <span className="font-bold text-gray-800 ml-auto tabular-nums">{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── RDV du jour + Patients en attente ───────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* RDV du jour */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <SectionHeader
            title="RDV d'aujourd'hui"
            badge={rdvAujourd.length}
            badgeColor="cyan"
          />
          {rdvAujourd.length === 0 ? (
            <EmptyState
              icon={<svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>}
              message="Aucun rendez-vous aujourd'hui"
            />
          ) : (
            <div className="flex flex-col gap-2">
              {rdvAujourd.map((rdv) => (
                <div
                  key={rdv.id}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors duration-150 group cursor-default"
                >
                  {/* Heure */}
                  <div
                    className="text-center min-w-[48px] py-1 px-1.5 rounded-lg"
                    style={{ background: "#eff6ff" }}
                  >
                    <p className="text-sm font-extrabold tabular-nums" style={{ color: "#0f4c81" }}>
                      {rdv.date_heure
                        ? new Date(rdv.date_heure).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
                        : rdv.heure || "—"}
                    </p>
                    {rdv.duree_minutes && (
                      <p className="text-[9px] text-gray-400">{rdv.duree_minutes}min</p>
                    )}
                  </div>
                  {/* Avatar + infos */}
                  <Avatar name={rdv.patient_nom} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{rdv.patient_nom}</p>
                    <p className="text-xs text-gray-400 truncate">{rdv.motif || "Consultation"}</p>
                  </div>
                  <StatusBadge statut={rdv.statut} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Patients en attente */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <SectionHeader
            title="Demandes en attente"
            badge={pending.length > 0 ? pending.length : null}
            badgeColor="amber"
          />
          {pending.length === 0 ? (
            <EmptyState
              icon={<svg className="w-6 h-6 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>}
              message="Toutes les demandes sont traitées ✓"
            />
          ) : (
            <div className="flex flex-col gap-2.5">
              {pending.map((p) => (
                <div
                  key={p.id}
                  className="p-3.5 rounded-xl border border-amber-100 bg-amber-50/40 hover:border-amber-200 transition-colors"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <Avatar name={p.nom_complet} size="sm" />
                    <div className="flex-1 min-w-0">
                      <button
                        onClick={() => navigate(`/dentiste/patients/${p.id}`)}
                        className="text-sm font-semibold text-gray-900 hover:text-[#0f4c81] transition-colors text-left truncate block w-full"
                      >
                        {p.nom_complet}
                      </button>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {p.age ? `${p.age} ans` : ""}
                        {p.age && p.telephone ? " · " : ""}
                        {p.telephone || ""}
                      </p>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700 border border-amber-200 whitespace-nowrap">
                      Nouveau
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleValider(p.id, "ACCEPTE")}
                      disabled={validating[p.id]}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold
                                 text-white transition-all duration-150 disabled:opacity-50 hover:opacity-90 active:scale-95"
                      style={{ background: "linear-gradient(135deg, #0f4c81, #1aa3c8)" }}
                    >
                      {validating[p.id] ? (
                        <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                        </svg>
                      ) : (
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                        </svg>
                      )}
                      Accepter
                    </button>
                    <button
                      onClick={() => handleValider(p.id, "REFUSE")}
                      disabled={validating[p.id]}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold
                                 border border-red-200 text-red-600 bg-white hover:bg-red-50 transition-all duration-150
                                 disabled:opacity-50 active:scale-95"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                      </svg>
                      Refuser
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Stats détail patients ────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h3 className="font-semibold text-gray-900 text-sm mb-4">Vue d'ensemble — Patients</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: "Total",          value: patientStats?.total,            color: "#0f4c81", bg: "#eff6ff", border: "#dbeafe" },
            { label: "Actifs",         value: patientStats?.actifs,           color: "#059669", bg: "#ecfdf5", border: "#d1fae5" },
            { label: "En attente",     value: patientStats?.en_attente,       color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
            { label: "Nouveaux / mois",value: patientStats?.nouveaux_ce_mois, color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe" },
            { label: "Avec alertes",   value: patientStats?.avec_alertes,     color: "#dc2626", bg: "#fef2f2", border: "#fecaca" },
            { label: "Mineurs",        value: patientStats?.mineurs,          color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe" },
          ].map((c) => (
            <div
              key={c.label}
              className="rounded-xl p-3.5 text-center border transition-transform hover:-translate-y-0.5 duration-150"
              style={{ background: c.bg, borderColor: c.border }}
            >
              <p className="text-2xl font-extrabold tabular-nums" style={{ color: c.color }}>
                {c.value ?? <span className="text-gray-200 text-xl">—</span>}
              </p>
              <p className="text-[11px] text-gray-400 mt-0.5 leading-tight">{c.label}</p>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}