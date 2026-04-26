import { createContext, useCallback, useContext, useMemo, useState } from "react";
import ErrorToast from "../components/ui/ErrorToast";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);

  const showError = useCallback((message) => {
    if (!message) return;
    setToast({ type: "error", message });
  }, []);

  const showSuccess = useCallback((message) => {
    if (!message) return;
    setToast({ type: "success", message });
  }, []);

  const clearToast = useCallback(() => setToast(null), []);

  const value = useMemo(
    () => ({ showError, showSuccess, clearToast }),
    [showError, showSuccess, clearToast]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ErrorToast
        type={toast?.type}
        message={toast?.message}
        onClose={clearToast}
      />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}
