import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const backendTarget =
  process.env.VITE_BACKEND_PROXY_TARGET ||
  "https://nexora-2-6ymt.onrender.com";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: backendTarget,
        changeOrigin: true,
        secure: true,
      },
      "/socket.io": {
        target: backendTarget,
        ws: true,
      },
    },
  },
});
