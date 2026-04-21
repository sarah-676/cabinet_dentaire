/**
 * src/pages/receptionniste/DashboardReceptionniste.jsx
 */
import { useEffect, useState } from "react";
import { getPatientStats } from "../../api/patientsAPI";
import { getRendezVousStats } from "../../api/rendezvousAPI";

function StatCard({ label, value, color = "#0f4c81", bg = "#e8f4fd" }) {
  return (
    <div style={{ background: bg, borderRadius: "12px", padding: "1.25rem 1rem", textAlign: "center" }}>
      <div style={{ fontSize: "1.75rem", fontWeight: 700, color, marginBottom: "0.25rem" }}>{value ?? "—"}</div>
      <div style={{ fontSize: "0.8rem", color: "#6b7280", fontWeight: 500 }}>{label}</div>
    </div>
  );
}

export default function DashboardReceptionniste() {
  const [ps, setPs] = useState(null);
  const [rs, setRs] = useState(null);

  useEffect(() => {
    getPatientStats().then(setPs).catch(() => {});
    getRendezVousStats().then(setRs).catch(() => {});
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      <section>
        <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "1rem" }}>Patients gérés</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "1rem" }}>
          <StatCard label="Total"       value={ps?.total}          />
          <StatCard label="En attente"  value={ps?.en_attente}  color="#d97706" bg="#fffbeb" />
          <StatCard label="Actifs"      value={ps?.actifs}      color="#059669" bg="#ecfdf5" />
          <StatCard label="Ce mois"     value={ps?.nouveaux_ce_mois} color="#7c3aed" bg="#f5f3ff" />
        </div>
      </section>
      {rs && (
        <section>
          <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "1rem" }}>Rendez-vous</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "1rem" }}>
            <StatCard label="Aujourd'hui"  value={rs.aujourd_hui}  />
            <StatCard label="Cette semaine" value={rs.cette_semaine} color="#059669" bg="#ecfdf5" />
            <StatCard label="En attente"   value={rs.en_attente}  color="#d97706" bg="#fffbeb" />
          </div>
        </section>
      )}
    </div>
  );
}