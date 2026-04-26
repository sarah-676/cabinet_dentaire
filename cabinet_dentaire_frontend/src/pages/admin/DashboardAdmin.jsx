/**
 * src/pages/admin/DashboardAdmin.jsx
 * ✅ Logique 100% conservée (getUserStats, loading, error, stats)
 * 🎨 UI redesignée — Dashboard admin professionnel avec graphiques
 */

import { useEffect, useState } from "react";
import { getUserStats } from "../../api/authAPI";
import PageState from "../../components/ui/PageState";
import InlineError from "../../components/ui/InlineError";
import { extractErrorMessage } from "../../utils/errorHandler";
import { useAuth } from "../../context/AuthContext";

// ── Carte stat principale ─────────────────────────────────────────────────────
function StatCard({ label, value, icon, iconBg, iconColor, trend, trendLabel }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-start justify-between gap-3 hover:shadow-md transition-shadow">
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-500 font-medium mb-1">{label}</p>
        <p className="text-3xl font-bold text-gray-900 leading-none">{value ?? "—"}</p>
        {trendLabel && (
          <p className={`text-xs mt-2 flex items-center gap-1 font-medium ${trend === "up" ? "text-emerald-600" : trend === "down" ? "text-red-500" : "text-gray-400"}`}>
            {trend === "up" ? "↑" : trend === "down" ? "↓" : "•"} {trendLabel}
          </p>
        )}
      </div>
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
        <span className={iconColor}>{icon}</span>
      </div>
    </div>
  );
}

// ── Barre de progression ──────────────────────────────────────────────────────
function ProgressBar({ value, total, color }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span className="text-xs text-gray-500 w-8 text-right">{pct}%</span>
    </div>
  );
}

// ── Donut SVG ─────────────────────────────────────────────────────────────────
function DonutChart({ segments = [], size = 100 }) {
  const total = segments.reduce((s, seg) => s + (seg.value || 0), 0) || 1;
  const r = 34, cx = 50, cy = 50;
  const circ = 2 * Math.PI * r;
  let cumulative = 0;

  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f3f4f6" strokeWidth="12" />
      {segments.map((seg, i) => {
        const pct = (seg.value || 0) / total;
        const dash = pct * circ;
        const dashOffset = -(cumulative / total) * circ;
        cumulative += seg.value || 0;
        return (
          <circle
            key={i}
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth="12"
            strokeDasharray={`${dash} ${circ - dash}`}
            strokeDashoffset={dashOffset}
            style={{ transform: "rotate(-90deg)", transformOrigin: "50% 50%" }}
          />
        );
      })}
      <text x={cx} y={cy - 5} textAnchor="middle" fontSize="13" fontWeight="800" fill="#111827">
        {total}
      </text>
      <text x={cx} y={cy + 10} textAnchor="middle" fontSize="7" fill="#9ca3af">
        utilisateurs
      </text>
    </svg>
  );
}

// ── Bar chart horizontal ──────────────────────────────────────────────────────
function HorizontalBar({ label, value, total, color, icon }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0`}
        style={{ background: color + "20" }}>
        <span style={{ color }}>{icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-gray-700 truncate">{label}</span>
          <span className="text-xs font-bold text-gray-900 ml-2">{value ?? 0}</span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${pct}%`, background: color }}
          />
        </div>
      </div>
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function DashboardAdmin() {
  const [stats,   setStats]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");
  const { user }              = useAuth();

  const firstName = user?.full_name?.split(" ")[0] || "Admin";

  useEffect(() => {
    getUserStats()
      .then(setStats)
      .catch((err) => setError(extractErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageState type="loading" />;

  const total = stats?.total || 0;

  const roleSegments = [
    { value: stats?.dentistes       || 0, color: "#1aa3c8" },
    { value: stats?.receptionnistes || 0, color: "#a78bfa" },
    { value: stats?.admins          || 0, color: "#f59e0b" },
    { value: stats?.inactifs        || 0, color: "#f87171" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <InlineError message={error} />

      {/* ── En-tête ─────────────────────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Bonjour, {firstName} 👋
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Tableau de bord administrateur — vue d'ensemble du système
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500 bg-white border border-gray-100 rounded-xl px-4 py-2 shadow-sm">
          <svg className="w-4 h-4 text-[#1aa3c8]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <rect x="3" y="4" width="18" height="18" rx="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </div>
      </div>

      {/* ── 4 cartes KPI ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Utilisateurs actifs"
          value={stats?.total}
          iconBg="bg-cyan-50"
          iconColor="text-[#1aa3c8]"
          trendLabel="Total comptes actifs"
          trend="up"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
            </svg>
          }
        />
        <StatCard
          label="Dentistes"
          value={stats?.dentistes}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
          trendLabel="Personnel médical"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path d="M12 2C9.5 2 8 3.5 7 5c-1 1.5-1.5 3-1 5 .5 2 1 3.5 1 5.5 0 1.5.5 3.5 1.5 4.5.5.5 1 .5 1.5 0 .5-.5.5-1.5.5-2.5 0-1 .5-2.5 1.5-2.5s1.5 1.5 1.5 2.5c0 1 0 2 .5 2.5.5.5 1 .5 1.5 0 1-1 1.5-3 1.5-4.5 0-2 .5-3.5 1-5.5.5-2 0-3.5-1-5C16 3.5 14.5 2 12 2z"/>
            </svg>
          }
        />
        <StatCard
          label="Réceptionnistes"
          value={stats?.receptionnistes}
          iconBg="bg-purple-50"
          iconColor="text-purple-600"
          trendLabel="Personnel administratif"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
          }
        />
        <StatCard
          label="Comptes inactifs"
          value={stats?.inactifs}
          iconBg="bg-red-50"
          iconColor="text-red-500"
          trendLabel="À vérifier"
          trend={stats?.inactifs > 0 ? "down" : null}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <circle cx="12" cy="12" r="10"/>
              <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
            </svg>
          }
        />
      </div>

      {/* ── Ligne 2 : Donut + Barres + Statut système ───────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Répartition donut */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-semibold text-gray-900 text-sm mb-1">Répartition des rôles</h3>
          <p className="text-xs text-gray-400 mb-5">Proportion par type de compte</p>
          <div className="flex items-center gap-4 justify-center">
            <DonutChart segments={roleSegments} size={110} />
            <div className="flex flex-col gap-2.5 text-xs">
              {[
                { label: "Dentistes",       color: "#1aa3c8", value: stats?.dentistes       || 0 },
                { label: "Réceptionnistes", color: "#a78bfa", value: stats?.receptionnistes || 0 },
                { label: "Admins",          color: "#f59e0b", value: stats?.admins          || 0 },
                { label: "Inactifs",        color: "#f87171", value: stats?.inactifs        || 0 },
              ].map((s) => (
                <div key={s.label} className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
                  <span className="text-gray-500">{s.label}</span>
                  <span className="font-bold text-gray-800 ml-auto pl-3">{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Barres progression */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-semibold text-gray-900 text-sm mb-1">Distribution des comptes</h3>
          <p className="text-xs text-gray-400 mb-5">En proportion du total actif</p>
          <div className="flex flex-col gap-4">
            <HorizontalBar
              label="Dentistes"
              value={stats?.dentistes || 0}
              total={total}
              color="#1aa3c8"
              icon={<svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path d="M12 2C9.5 2 8 3.5 7 5c-1 1.5-1.5 3-1 5 .5 2 1 3.5 1 5.5 0 1.5.5 3.5 1.5 4.5.5.5 1 .5 1.5 0 .5-.5.5-1.5.5-2.5 0-1 .5-2.5 1.5-2.5s1.5 1.5 1.5 2.5c0 1 0 2 .5 2.5.5.5 1 .5 1.5 0 1-1 1.5-3 1.5-4.5 0-2 .5-3.5 1-5.5.5-2 0-3.5-1-5C16 3.5 14.5 2 12 2z"/></svg>}
            />
            <HorizontalBar
              label="Réceptionnistes"
              value={stats?.receptionnistes || 0}
              total={total}
              color="#a78bfa"
              icon={<svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>}
            />
            <HorizontalBar
              label="Administrateurs"
              value={stats?.admins || 0}
              total={total}
              color="#f59e0b"
              icon={<svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><circle cx="12" cy="12" r="3"/></svg>}
            />
            <HorizontalBar
              label="Inactifs"
              value={stats?.inactifs || 0}
              total={Math.max(total + (stats?.inactifs || 0), 1)}
              color="#f87171"
              icon={<svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>}
            />
          </div>
        </div>

        {/* Statut système */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-4">
          <div>
            <h3 className="font-semibold text-gray-900 text-sm mb-1">Santé du système</h3>
            <p className="text-xs text-gray-400">Vue d'ensemble opérationnelle</p>
          </div>

          {[
            {
              label: "Comptes actifs",
              status: (stats?.total || 0) > 0 ? "ok" : "warn",
              detail: `${stats?.total || 0} comptes opérationnels`,
            },
            {
              label: "Comptes inactifs",
              status: (stats?.inactifs || 0) === 0 ? "ok" : "warn",
              detail: (stats?.inactifs || 0) === 0 ? "Aucun compte suspendu" : `${stats?.inactifs} à vérifier`,
            },
            {
              label: "Couverture dentistes",
              status: (stats?.dentistes || 0) > 0 ? "ok" : "error",
              detail: `${stats?.dentistes || 0} dentiste(s) actif(s)`,
            },
            {
              label: "Personnel admin",
              status: (stats?.admins || 0) > 0 ? "ok" : "warn",
              detail: `${stats?.admins || 0} administrateur(s)`,
            },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                item.status === "ok" ? "bg-emerald-400" :
                item.status === "warn" ? "bg-amber-400" : "bg-red-400"
              }`} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-700">{item.label}</p>
                <p className="text-[11px] text-gray-400 truncate">{item.detail}</p>
              </div>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                item.status === "ok"   ? "bg-emerald-50 text-emerald-600" :
                item.status === "warn" ? "bg-amber-50 text-amber-600" :
                                         "bg-red-50 text-red-600"
              }`}>
                {item.status === "ok" ? "OK" : item.status === "warn" ? "Attention" : "Erreur"}
              </span>
            </div>
          ))}

          {/* Score global */}
          <div className="mt-auto pt-3 border-t border-gray-100">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-gray-500 font-medium">Score global</span>
              <span className="text-xs font-bold text-emerald-600">
                {stats?.inactifs === 0 ? "100%" : stats?.inactifs < 2 ? "80%" : "60%"}
              </span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all duration-700"
                style={{ width: stats?.inactifs === 0 ? "100%" : stats?.inactifs < 2 ? "80%" : "60%" }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Tableau récapitulatif ───────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900 text-sm">Récapitulatif des comptes</h3>
          <p className="text-xs text-gray-400 mt-0.5">Détail par rôle et statut</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {["Rôle", "Nombre", "% du total", "Statut"].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {[
                { role: "Dentistes",       value: stats?.dentistes       || 0, color: "#1aa3c8", bg: "bg-cyan-50",   text: "text-cyan-700" },
                { role: "Réceptionnistes", value: stats?.receptionnistes || 0, color: "#a78bfa", bg: "bg-purple-50", text: "text-purple-700" },
                { role: "Administrateurs", value: stats?.admins          || 0, color: "#f59e0b", bg: "bg-amber-50",  text: "text-amber-700" },
                { role: "Inactifs",        value: stats?.inactifs        || 0, color: "#f87171", bg: "bg-red-50",    text: "text-red-700" },
              ].map((row) => (
                <tr key={row.role} className="hover:bg-gray-50/60 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ background: row.color }} />
                      <span className="font-medium text-gray-800 text-sm">{row.role}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 font-bold text-gray-900">{row.value}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${total > 0 ? Math.round((row.value / total) * 100) : 0}%`,
                            background: row.color,
                          }}
                        />
                      </div>
                      <span className="text-xs text-gray-500">
                        {total > 0 ? Math.round((row.value / total) * 100) : 0}%
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${row.bg} ${row.text}`}>
                      {row.role === "Inactifs" ? "Désactivé" : "Actif"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}