/**
 * src/components/ui/Modal.jsx
 * ─────────────────────────────
 * Modal générique réutilisable.
 *
 * Props :
 *   title    : string
 *   onClose  : () => void
 *   children : ReactNode
 *   wide     : bool — modal large (800px vs 500px)
 */

import { useEffect } from "react";

export default function Modal({ title, onClose, children, wide = false }) {
  // Fermer avec Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Bloquer le scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  return (
    <div style={styles.overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ ...styles.modal, maxWidth: wide ? "800px" : "520px" }}>
        {/* Header */}
        <div style={styles.header}>
          <h2 style={styles.title}>{title}</h2>
          <button onClick={onClose} style={styles.closeBtn} aria-label="Fermer">✕</button>
        </div>
        {/* Body */}
        <div style={styles.body}>{children}</div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.45)",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
    zIndex: 1000,
    padding: "2rem 1rem",
    overflowY: "auto",
  },
  modal: {
    background: "#ffffff",
    borderRadius: "16px",
    width: "100%",
    boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
    maxHeight: "90vh",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "1.25rem 1.5rem",
    borderBottom: "1px solid #e5e7eb",
    flexShrink: 0,
  },
  title: {
    fontSize: "1.05rem",
    fontWeight: 600,
    color: "#111827",
    margin: 0,
  },
  closeBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: "1rem",
    color: "#6b7280",
    padding: "4px",
    lineHeight: 1,
  },
  body: {
    padding: "1.5rem",
    overflowY: "auto",
    flex: 1,
  },
};