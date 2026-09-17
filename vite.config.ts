import path from "node:path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  plugins: [
    react(),
    tailwindcss(),
  ],
  assetsInclude: ["**/*.wasm"],
  resolve: {
    alias: {
      "~": path.resolve(__dirname, "app"),
    },
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
  },
  optimizeDeps: {
    exclude: ["@bedrock-engineer/gef-parser"],
    esbuildOptions: {
      supported: {
        "top-level-await": true,
      },
    },
  },
});

