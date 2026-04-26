/**
 * Panneau latéral — données depuis NotificationContext (REST + WebSocket).
 */
import { useMemo, useState } from "react";
import { useNotificationContext } from "../../context/NotificationContext";

const TYPE_CONFIG = {
  PATIENT_EN_ATTENTE: { color: "#d97706", bg: "#fffbeb", icon: "👤", label: "Patient en attente" },
  PATIENT_VALIDE:     { color: "#059669", bg: "#ecfdf5", icon: "✓",  label: "Patient accepté" },
  PATIENT_REFUSE:     { color: "#dc2626", bg: "#fef2f2", icon: "✗",  label: "Patient refusé" },
  RDV_EN_ATTENTE:     { color: "#2563eb", bg: "#eff6ff", icon: "📅", label: "RDV en attente" },
  RDV_VALIDE:         { color: "#059669", bg: "#ecfdf5", icon: "✓",  label: "RDV confirmé" },
  RDV_REFUSE:         { color: "#dc2626", bg: "#fef2f2", icon: "✗",  label: "RDV refusé" },
  RDV_ANNULE:         { color: "#6b7280", bg: "#f9fafb", icon: "⊘",  label: "RDV annulé" },
  RDV_RAPPEL:         { color: "#7c3aed", bg: "#f5f3ff", icon: "⏰", label: "Rappel RDV" },
  SYSTEME:            { color: "#374151", bg: "#f9fafb", icon: "ℹ",  label: "Système" },
};

const NIVEAU_DOT = {
  CRITIQUE:      "#dc2626",
  ALERTE:        "#d97706",
  SUCCES:        "#059669",
  INFO:          "#2563eb",
};

export default function NotificationPanel({ onClose }) {
  const {
    notifications,
    stats,
    loading,
    marquerLue,
    marquerToutesLues,
    supprimerNotification,
    refetch,
  } = useNotificationContext();

  const [filter, setFilter]   = useState("all");
  const [deleting, setDeleting] = useState(null);
  const [marking, setMarking]  = useState(null);

  const notifs = useMemo(() => {
    if (filter === "unread") return notifications.filter((n) => !n.is_read);
    if (filter === "read") return notifications.filter((n) => n.is_read);
    return notifications;
  }, [notifications, filter]);

  const handleLire = async (id) => {
    setMarking(id);
    try {
      await marquerLue(id);
    } finally {
      setMarking(null);
    }
  };

  const handleLireTout = async () => {
    try {
      await marquerToutesLues();
    } catch {
      refetch();
    }
  };

  const handleDelete = async (id) => {
    setDeleting(id);
    try {
      await supprimerNotification(id);
    } finally {
      setDeleting(null);
    }
  };

  const formatDate = (iso) => {
    const d = new Date(iso);
    const now = new Date();
    const diff = Math.floor((now - d) / 1000);
    if (diff < 60) return "À l'instant";
    if (diff < 3600) return `Il y a ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)} h`;
    return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
  };

  return (
    <>
      <div style={styles.overlay} onClick={onClose} />

      <div style={styles.panel}>
        <div style={styles.panelHeader}>
          <div>
            <h2 style={styles.panelTitle}>Notifications</h2>
            {stats && (
              <span style={styles.countBadge}>
                {stats.non_lues} non lue{stats.non_lues > 1 ? "s" : ""}
              </span>
            )}
          </div>
          <div style={styles.headerActions}>
            {stats?.non_lues > 0 && (
              <button type="button" onClick={handleLireTout} style={styles.markAllBtn}>
                Tout marquer lu
              </button>
            )}
            <button type="button" onClick={onClose} style={styles.closeBtn}>
              ✕
            </button>
          </div>
        </div>

        {stats?.par_type && Object.keys(stats.par_type).length > 0 && (
          <div style={styles.typeBar}>
            {Object.entries(stats.par_type).slice(0, 4).map(([type, count]) => {
              const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.SYSTEME;
              return (
                <div key={type} style={{ ...styles.typeChip, background: cfg.bg, color: cfg.color }}>
                  {cfg.icon} {count}
                </div>
              );
            })}
          </div>
        )}

        <div style={styles.filters}>
          {[
            ["all", "Toutes"],
            ["unread", "Non lues"],
            ["read", "Lues"],
          ].map(([val, label]) => (
            <button
              key={val}
              type="button"
              onClick={() => setFilter(val)}
              style={{ ...styles.filterBtn, ...(filter === val ? styles.filterBtnActive : {}) }}
            >
              {label}
              {val === "unread" && stats?.non_lues > 0 && (
                <span style={styles.filterCount}>{stats.non_lues}</span>
              )}
            </button>
          ))}
        </div>

        <div style={styles.list}>
          {loading ? (
            <div style={styles.loadingMsg}>Chargement...</div>
          ) : notifs.length === 0 ? (
            <div style={styles.emptyState}>
              <div style={styles.emptyIcon}>🔔</div>
              <p style={styles.emptyText}>
                {filter === "unread" ? "Aucune notification non lue." : "Aucune notification."}
              </p>
            </div>
          ) : (
            notifs.map((notif) => {
              const cfg = TYPE_CONFIG[notif.type] || TYPE_CONFIG.SYSTEME;
              const dotCol = NIVEAU_DOT[notif.niveau] || "#6b7280";

              return (
                <div
                  key={notif.id}
                  style={{
                    ...styles.notifItem,
                    background: notif.is_read ? "#fafafa" : "#fff",
                    borderLeft: `3px solid ${notif.is_read ? "#e5e7eb" : cfg.color}`,
                  }}
                >
                  <div style={{ ...styles.notifIcon, background: cfg.bg, color: cfg.color }}>
                    {cfg.icon}
                  </div>

                  <div style={styles.notifBody}>
                    <div style={styles.notifTop}>
                      <span style={{ ...styles.notifTitle, fontWeight: notif.is_read ? 400 : 600 }}>
                        {notif.titre}
                      </span>
                      {!notif.is_read && (
                        <span style={{ ...styles.unreadDot, background: dotCol }} />
                      )}
                    </div>
                    <p style={styles.notifMsg}>{notif.message}</p>
                    {notif.patient_nom && (
                      <span style={styles.notifMeta}>Patient : {notif.patient_nom}</span>
                    )}
                    <span style={styles.notifTime}>{formatDate(notif.created_at)}</span>
                  </div>

                  <div style={styles.notifActions}>
                    {!notif.is_read && (
                      <button
                        type="button"
                        onClick={() => handleLire(notif.id)}
                        disabled={marking === notif.id}
                        style={styles.readBtn}
                        title="Marquer comme lu"
                      >
                        {marking === notif.id ? "…" : "✓"}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDelete(notif.id)}
                      disabled={deleting === notif.id}
                      style={styles.deleteBtn}
                      title="Supprimer"
                    >
                      {deleting === notif.id ? "…" : "✕"}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}

const styles = {
  overlay: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.2)",
    zIndex: 1100,
  },
  panel: {
    position: "fixed", top: 0, right: 0, bottom: 0,
    width: "380px", background: "#fff",
    boxShadow: "-4px 0 24px rgba(0,0,0,0.12)",
    zIndex: 1101, display: "flex", flexDirection: "column",
    fontFamily: "'Segoe UI', system-ui, sans-serif",
  },
  panelHeader: {
    display: "flex", justifyContent: "space-between", alignItems: "flex-start",
    padding: "1.25rem 1.25rem 0.75rem",
    borderBottom: "1px solid #e5e7eb",
  },
  panelTitle: { margin: "0 0 4px", fontSize: "1.1rem", fontWeight: 700, color: "#111827" },
  countBadge: {
    fontSize: "0.75rem", color: "#6b7280",
  },
  headerActions: { display: "flex", alignItems: "center", gap: "0.5rem" },
  markAllBtn: {
    padding: "0.3rem 0.75rem", background: "#eff6ff", color: "#2563eb",
    border: "1px solid #bfdbfe", borderRadius: "6px",
    fontSize: "0.8rem", cursor: "pointer", fontWeight: 500,
  },
  closeBtn: {
    background: "none", border: "none", cursor: "pointer",
    fontSize: "1.1rem", color: "#6b7280", padding: "4px",
  },
  typeBar: {
    display: "flex", gap: "0.5rem", padding: "0.75rem 1.25rem",
    borderBottom: "1px solid #f3f4f6", flexWrap: "wrap",
  },
  typeChip: {
    padding: "3px 10px", borderRadius: "12px", fontSize: "0.75rem", fontWeight: 600,
  },
  filters: {
    display: "flex", gap: "0.25rem", padding: "0.75rem 1.25rem",
    borderBottom: "1px solid #f3f4f6",
  },
  filterBtn: {
    padding: "0.35rem 0.875rem", border: "1px solid #e5e7eb",
    borderRadius: "20px", background: "#f9fafb", cursor: "pointer",
    fontSize: "0.8rem", color: "#374151", display: "flex", alignItems: "center", gap: "0.3rem",
  },
  filterBtnActive: {
    background: "#0f4c81", color: "#fff", borderColor: "#0f4c81",
  },
  filterCount: {
    background: "#dc2626", color: "#fff", borderRadius: "10px",
    padding: "1px 5px", fontSize: "10px", fontWeight: 700,
  },
  list: {
    flex: 1, overflowY: "auto", padding: "0.5rem 0",
  },
  loadingMsg: { padding: "2rem", textAlign: "center", color: "#6b7280", fontSize: "0.9rem" },
  emptyState: { padding: "3rem 1.5rem", textAlign: "center" },
  emptyIcon:  { fontSize: "2.5rem", marginBottom: "0.75rem" },
  emptyText:  { color: "#6b7280", fontSize: "0.9rem", margin: 0 },
  notifItem: {
    display: "flex", gap: "0.875rem", padding: "0.875rem 1.25rem",
    borderBottom: "1px solid #f3f4f6", transition: "background 0.15s",
    alignItems: "flex-start",
  },
  notifIcon: {
    width: "36px", height: "36px", borderRadius: "8px",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: "1rem", flexShrink: 0,
  },
  notifBody: { flex: 1, minWidth: 0 },
  notifTop:  { display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "3px" },
  notifTitle: { fontSize: "0.875rem", color: "#111827", lineHeight: 1.3 },
  unreadDot: {
    width: "8px", height: "8px", borderRadius: "50%", flexShrink: 0,
  },
  notifMsg:  { margin: "0 0 4px", fontSize: "0.8rem", color: "#4b5563", lineHeight: 1.4 },
  notifMeta: { display: "block", fontSize: "0.75rem", color: "#9ca3af", marginBottom: "2px" },
  notifTime: { fontSize: "0.72rem", color: "#9ca3af" },
  notifActions: { display: "flex", flexDirection: "column", gap: "4px", flexShrink: 0 },
  readBtn: {
    width: "26px", height: "26px", background: "#ecfdf5", color: "#059669",
    border: "1px solid #a7f3d0", borderRadius: "6px",
    cursor: "pointer", fontSize: "0.8rem", fontWeight: 700,
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  deleteBtn: {
    width: "26px", height: "26px", background: "#fef2f2", color: "#dc2626",
    border: "1px solid #fecaca", borderRadius: "6px",
    cursor: "pointer", fontSize: "0.8rem",
    display: "flex", alignItems: "center", justifyContent: "center",
  },
};
