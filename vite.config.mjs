import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  cacheDir: ".vite/build",
  plugins: [react()],
  build: {
    target: "es2018",
  },
  optimizeDeps: {
    include: [],
    noDiscovery: true,
  },
  server: {
    hmr: {
      host: "127.0.0.1",
      port: 24679,
    },
  },
});
