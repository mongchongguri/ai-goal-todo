import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";
import react from "@vitejs/plugin-react";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

await build({
  configFile: false,
  root: __dirname,
  base: "./",
  cacheDir: path.join(__dirname, ".vite", "build"),
  plugins: [react()],
  optimizeDeps: {
    include: [],
    noDiscovery: true,
  },
  build: {
    emptyOutDir: true,
    target: "es2018",
  },
});
