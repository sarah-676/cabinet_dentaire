/**
 * src/components/ui/PageState.jsx
 * ✅ Logique 100% conservée (type, message, InlineError)
 * 🎨 UI redesignée — Tailwind CSS
 */
import { memo } from "react";
import InlineError from "./InlineError";

function PageState({ type, message }) {
  if (type === "loading") {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
        <svg className="w-8 h-8 animate-spin text-[#1aa3c8]" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
        <span className="text-sm">Chargement...</span>
      </div>
    );
  }

  if (type === "empty") {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
        <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center">
          <svg className="w-7 h-7 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
        </div>
        <p className="text-sm font-medium text-gray-500">{message || "Aucune donnée."}</p>
      </div>
    );
  }

  if (type === "error") {
    return (
      <div className="py-4">
        <InlineError message={message || "Une erreur est survenue."} />
      </div>
    );
  }

  return null;
}

export default memo(PageState);