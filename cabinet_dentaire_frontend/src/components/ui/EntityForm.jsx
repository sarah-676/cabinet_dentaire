import { useMemo, useState } from "react";

function normalizeError(err) {
  if (!err) return "";
  return Array.isArray(err) ? err[0] : err;
}

export default function EntityForm({
  title,
  fields,
  initialValues,
  errors = {},
  submitting = false,
  submitLabel = "Enregistrer",
  onCancel,
  onSubmit,
  validate,
}) {
  const [values, setValues] = useState(initialValues);
  const [clientErrors, setClientErrors] = useState({});

  const mergedErrors = useMemo(
    () => ({ ...clientErrors, ...errors }),
    [clientErrors, errors]
  );

  const handleChange = (name, value) => {
    setValues((prev) => ({ ...prev, [name]: value }));
    if (clientErrors[name]) {
      setClientErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    const nextErrors = validate ? validate(values) : {};
    setClientErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;
    await onSubmit(values);
  };

  return (
    <div style={styles.overlay} onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <h2 style={styles.title}>{title}</h2>
          <button onClick={onCancel} style={styles.closeBtn} type="button">
            ✕
          </button>
        </div>
        <form noValidate onSubmit={submit} style={styles.form}>
          {normalizeError(mergedErrors.non_field_errors) && (
            <div style={styles.errorBanner}>{normalizeError(mergedErrors.non_field_errors)}</div>
          )}

          {fields.map((field) => (
            <div key={field.name} style={styles.field}>
              <label style={styles.label}>{field.label}</label>
              {renderField(field, values[field.name], handleChange)}
              {normalizeError(mergedErrors[field.name]) && (
                <span style={styles.errorText}>{normalizeError(mergedErrors[field.name])}</span>
              )}
            </div>
          ))}

          <div style={styles.actions}>
            <button type="button" onClick={onCancel} style={styles.cancelBtn}>
              Annuler
            </button>
            <button type="submit" disabled={submitting} style={styles.submitBtn}>
              {submitting ? "..." : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function renderField(field, value, handleChange) {
  const common = {
    name: field.name,
    required: field.required,
    placeholder: field.placeholder,
    style: styles.input,
  };

  if (field.type === "select") {
    return (
      <select
        {...common}
        value={value ?? ""}
        onChange={(e) => handleChange(field.name, e.target.value)}
      >
        {(field.options || []).map((opt) => (
          <option key={String(opt.value)} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === "checkbox") {
    return (
      <label style={styles.checkboxLabel}>
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => handleChange(field.name, e.target.checked)}
        />
        {field.checkboxLabel || field.label}
      </label>
    );
  }

  if (field.type === "textarea") {
    return (
      <textarea
        {...common}
        value={value ?? ""}
        rows={field.rows || 3}
        onChange={(e) => handleChange(field.name, e.target.value)}
        style={styles.textarea}
      />
    );
  }

  return (
    <input
      {...common}
      type={field.type || "text"}
      value={value ?? ""}
      onChange={(e) => handleChange(field.name, e.target.value)}
    />
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
    overflowY: "auto",
    padding: "2rem 1rem",
  },
  modal: {
    background: "#fff",
    borderRadius: "16px",
    width: "100%",
    maxWidth: "620px",
    boxShadow: "0 8px 40px rgba(0,0,0,0.2)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "1.25rem 1.5rem",
    borderBottom: "1px solid #e5e7eb",
  },
  title: { margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "#111827" },
  closeBtn: { background: "none", border: "none", cursor: "pointer", fontSize: "1.1rem", color: "#6b7280" },
  form: { padding: "1.5rem", display: "flex", flexDirection: "column", gap: "0.875rem" },
  field: { display: "flex", flexDirection: "column", gap: "0.3rem" },
  label: { fontSize: "0.8rem", fontWeight: 500, color: "#374151" },
  input: {
    padding: "0.6rem 0.75rem",
    border: "1.5px solid #d1d5db",
    borderRadius: "8px",
    fontSize: "0.9rem",
    width: "100%",
    boxSizing: "border-box",
  },
  textarea: {
    padding: "0.6rem 0.75rem",
    border: "1.5px solid #d1d5db",
    borderRadius: "8px",
    fontSize: "0.875rem",
    width: "100%",
    boxSizing: "border-box",
    resize: "vertical",
    fontFamily: "inherit",
  },
  checkboxLabel: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    fontSize: "0.875rem",
    color: "#111827",
  },
  errorBanner: {
    background: "#fef2f2",
    border: "1px solid #fecaca",
    borderRadius: "8px",
    padding: "0.75rem",
    color: "#dc2626",
    fontSize: "0.875rem",
  },
  errorText: { fontSize: "0.75rem", color: "#dc2626" },
  actions: { display: "flex", justifyContent: "flex-end", gap: "0.75rem", paddingTop: "0.5rem" },
  cancelBtn: {
    padding: "0.6rem 1.25rem",
    border: "1.5px solid #d1d5db",
    borderRadius: "8px",
    background: "#fff",
    cursor: "pointer",
    fontSize: "0.9rem",
  },
  submitBtn: {
    padding: "0.6rem 1.5rem",
    background: "#0f4c81",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    fontWeight: 600,
    cursor: "pointer",
    fontSize: "0.9rem",
  },
};
