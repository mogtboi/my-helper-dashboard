import { defineConfig } from "vite";

/**
 * GitHub project Pages: https://mogt.github.io/my-helper-dashboard/
 * Set VITE_BASE_PATH=/my-helper-dashboard/ in CI. Local/dev keeps relative "./".
 */
const base = process.env.VITE_BASE_PATH || "./";

export default defineConfig({
  base,
  server: {
    host: true,
    port: 5173,
  },
  preview: {
    host: true,
    port: 4173,
  },
  build: {
    target: "es2020",
    sourcemap: true,
  },
});
