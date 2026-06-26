import { defineConfig } from "vite";

export default defineConfig({
  root: "renderer",
  build: {
    outDir: "../dist/renderer",
    emptyOutDir: true,
  },
  server: {
    port: 5173,
  },
});
