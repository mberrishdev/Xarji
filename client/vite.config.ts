import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * During development the client runs on Vite's dev server (default
 * 5173) while the service runs separately on 127.0.0.1:8721. The client
 * calls /api/* endpoints; without a proxy those requests would 404 on
 * the Vite dev server. Route them through to the service so the same
 * code path works in dev and in the compiled binary.
 *
 * In production (compiled binary) the service serves both the client
 * assets and /api/* on the same port, so there's no proxy involved.
 */
const API_TARGET = process.env.XARJI_SERVICE_URL ?? "http://127.0.0.1:8721";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: API_TARGET,
        changeOrigin: false,
      },
    },
  },
});
