/**
 * src/pages/auth/LoginPage.jsx
 * ─────────────────────────────
 * Page de connexion — UI redesignée (inspiration Lovable / DentalCare Pro)
 * ✅ Logique métier 100% conservée (login, navigate, useAuth, error, loading)
 * 🎨 Seul l'aspect visuel a été modifié (Tailwind CSS)
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function LoginPage() {
  const { login, loading, error } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ email: "", password: "" });
  const [showPwd, setShowPwd] = useState(false);

  const handleChange = (e) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const route = await login(form.email, form.password);
      navigate(route, { replace: true });
    } catch {
      // erreur gérée dans AuthContext
    }
  };

  return (
    <div className="min-h-screen flex">

      {/* ── Panneau gauche — Hero ───────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        {/* Dégradé teal-cyan */}
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(135deg, #0d9488 0%, #06b6d4 50%, #22d3ee 100%)",
          }}
        />

        {/* Overlay image de fond (cabinet dentaire) */}
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=900&q=80')",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />

        {/* Cercles décoratifs */}
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full opacity-20"
          style={{ background: "rgba(255,255,255,0.3)" }} />
        <div className="absolute -bottom-16 -right-16 w-72 h-72 rounded-full opacity-15"
          style={{ background: "rgba(255,255,255,0.25)" }} />

        {/* Contenu hero */}
        <div className="relative z-10 flex flex-col justify-end p-12 pb-16">
          {/* Logo en haut */}
          <div className="absolute top-10 left-10 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
              <ToothIcon className="w-6 h-6 text-white" />
            </div>
            <span className="text-white font-semibold text-lg tracking-wide">
              DentalCare Pro
            </span>
          </div>

          {/* Texte bas gauche */}
          <h2 className="text-white text-4xl font-bold leading-tight mb-3">
            Gérez votre cabinet<br />dentaire avec<br />efficacité.
          </h2>
          <p className="text-white/80 text-base max-w-xs leading-relaxed">
            Patients, rendez-vous, traitements et ordonnances — tout en un seul espace sécurisé.
          </p>

          {/* Badges features */}
          <div className="flex flex-wrap gap-2 mt-6">
            {["Patients", "Rendez-vous", "Ordonnances", "Radios"].map((f) => (
              <span
                key={f}
                className="px-3 py-1 rounded-full text-xs font-medium text-white border border-white/30 bg-white/10 backdrop-blur"
              >
                {f}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Panneau droit — Formulaire ─────────────────────────────────────── */}
      <div className="w-full lg:w-1/2 flex flex-col items-center justify-center px-6 py-12 bg-gray-50">
        <div className="w-full max-w-md">

          {/* Logo mobile uniquement */}
          <div className="flex lg:hidden items-center justify-center gap-2 mb-8">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #0d9488, #06b6d4)" }}
            >
              <ToothIcon className="w-6 h-6 text-white" />
            </div>
            <span className="font-bold text-gray-800 text-lg">DentalCare Pro</span>
          </div>

          {/* Icône dent centré — desktop */}
          <div className="hidden lg:flex justify-center mb-6">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg"
              style={{ background: "linear-gradient(135deg, #0d9488, #06b6d4)" }}
            >
              <ToothIcon className="w-8 h-8 text-white" />
            </div>
          </div>

          {/* Titre */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Bienvenue</h1>
            <p className="text-gray-500 text-sm">Connectez-vous à votre compte</p>
          </div>

          {/* Card formulaire */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">

            {/* Erreur */}
            {error && (
              <div className="mb-5 flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm">
                <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10A8 8 0 11 2 10a8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">

              {/* Champ Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Email
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </span>
                  <input
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                    placeholder="votre@email.com"
                    required
                    autoComplete="email"
                    className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 text-gray-900 placeholder-gray-400 outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-100 focus:bg-white"
                  />
                </div>
              </div>

              {/* Champ Mot de passe */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Mot de passe
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </span>
                  <input
                    type={showPwd ? "text" : "password"}
                    name="password"
                    value={form.password}
                    onChange={handleChange}
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                    className="w-full pl-10 pr-11 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 text-gray-900 placeholder-gray-400 outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-100 focus:bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((v) => !v)}
                    tabIndex={-1}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                  >
                    {showPwd ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                          d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88L6.59 6.59m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0zm-9.543 0C3.732 7.943 7.522 5 12 5c4.478 0 8.268 2.943 9.543 7-1.275 4.057-5.065 7-9.543 7-4.478 0-8.268-2.943-9.543-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Bouton Se connecter */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl text-white text-sm font-semibold transition-all duration-200 hover:opacity-90 hover:shadow-md active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed mt-2"
                style={{
                  background: loading
                    ? "#9ca3af"
                    : "linear-gradient(135deg, #0d9488 0%, #06b6d4 100%)",
                }}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Connexion en cours...
                  </span>
                ) : (
                  "Se connecter"
                )}
              </button>

            </form>
          </div>

          {/* Footer */}
          <p className="text-center text-xs text-gray-400 mt-6">
            Cabinet Dentaire © {new Date().getFullYear()}
          </p>
        </div>
      </div>

    </div>
  );
}

/* ── Icône dent SVG ─────────────────────────────────────────────────────────── */
function ToothIcon({ className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 2C9.5 2 8 3.5 7 5c-1 1.5-1.5 3-1 5 .5 2 1 3.5 1 5.5 0 1.5.5 3.5 1.5 4.5.5.5 1 .5 1.5 0 .5-.5.5-1.5.5-2.5 0-1 .5-2.5 1.5-2.5s1.5 1.5 1.5 2.5c0 1 0 2 .5 2.5.5.5 1 .5 1.5 0 1-1 1.5-3 1.5-4.5 0-2 .5-3.5 1-5.5.5-2 0-3.5-1-5C16 3.5 14.5 2 12 2z" />
    </svg>
  );
}