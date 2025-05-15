import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd());
  return {
    plugins: [react()],
    preview: {
      allowedHosts: true,
    },
    logLevel: "info",

    server: {
      host: "0.0.0.0", // Allow connections from any IP
      strictPort: true,
      port: 5173,
      allowedHosts: true,
      proxy: {
        "/api": {
          target: env.VITE_BACKEND_URL || "http://localhost:5005",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ""),
        },
        "/wsapi": {
          target: env.VITE_BACKEND_WS_URL || "ws://localhost:5005",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/wsapi/, ""),
          ws: true,
        },
        // important to let the socket.io handshake go through
        "/socket.io": {
          target: env.VITE_BACKEND_WS_URL || "ws://localhost:5005",
          changeOrigin: true,
          ws: true,
        },
      },
    },
  };
});
