/**
 * src/pages/admin/DashboardAdmin.jsx
 */
import { useEffect, useState } from "react";
import { getUserStats } from "../../api/authAPI";

export default function DashboardAdmin() {
  const [stats, setStats] = useState(null);
  useEffect(() => { getUserStats().then(setStats).catch(() => {}); }, []);

  const cards = [
    { label: "Total actifs",      value: stats?.total,           color: "#0f4c81", bg: "#e8f4fd" },
    { label: "Dentistes",         value: stats?.dentistes,       color: "#059669", bg: "#ecfdf5" },
    { label: "Réceptionnistes",   value: stats?.receptionnistes, color: "#7c3aed", bg: "#f5f3ff" },
    { label: "Admins",            value: stats?.admins,          color: "#d97706", bg: "#fffbeb" },
    { label: "Comptes inactifs",  value: stats?.inactifs,        color: "#dc2626", bg: "#fef2f2" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "1rem" }}>
        {cards.map(c => (
          <div key={c.label} style={{ background: c.bg, borderRadius: "12px", padding: "1.25rem 1rem", textAlign: "center" }}>
            <div style={{ fontSize: "1.75rem", fontWeight: 700, color: c.color }}>{c.value ?? "—"}</div>
            <div style={{ fontSize: "0.8rem", color: "#6b7280", fontWeight: 500 }}>{c.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}