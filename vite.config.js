import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const apiPort = process.env.SOOS_API_PORT || "4177";

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 600,
  },
  server: {
    port: 5173,
    proxy: {
      "/api": `http://127.0.0.1:${apiPort}`,
    },
  },
});
