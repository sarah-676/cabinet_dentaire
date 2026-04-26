import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envDir = path.resolve(__dirname, "src");

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, envDir, "VITE_");

  return {
    envDir,
    plugins: [react()],

    server: {
      port: 5173,
      host: "localhost",

      // ✅ PROXY — résout les erreurs CORS et WebSocket
      proxy: {
        // ── auth_service (port 8001) ──────────────────────────────
        // DOIT être avant /api/ car plus spécifique
        "/api/auth": {
          target:      "http://localhost:8001",
          changeOrigin: true,
          secure:      false,
          rewrite: (path) => path.replace(/^\/api/, ""),
        },

        // ── api_service (port 8000) ───────────────────────────────
        "/api": {
          target:      "http://localhost:8000",
          changeOrigin: true,
          secure:      false,
        },

        // ── WebSocket notifications (api_service port 8000) ───────
        // ✅ ws: true obligatoire pour que Vite proxifie le WebSocket
        "/ws": {
          target:      "http://localhost:8000",
          changeOrigin: true,
          secure:      false,
          ws:          true,   // ← clé pour résoudre l'erreur WS
        },
      },
    },

    build: {
      outDir:   "dist",
      sourcemap: mode === "development",
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes("node_modules/react-dom") || id.includes("node_modules/react/")) {
              return "react-vendor";
            }
            if (id.includes("node_modules/react-router")) {
              return "router-vendor";
            }
            if (id.includes("node_modules/axios")) {
              return "api-vendor";
            }
          },
        },
      },
    },

    define: {
      _APP_VERSION_: JSON.stringify(env.VITE_APP_VERSION || "0.0.0"),
      _APP_TITLE_:   JSON.stringify(env.VITE_APP_TITLE   || "Cabinet Dentaire"),
    },

    test: {
      environment: "jsdom",
      globals:     false,
      setupFiles:  "./src/test/setup.js",
      css:         true,
      pool:        "forks",
    },
  };
});