import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import path from "path";

export default defineConfig({
  plugins: [svelte()],
  base: "./", // relative paths so built dist/ opens without a server
  resolve: {
    alias: { $lib: path.resolve("./src/lib") },
  },
  server: {
    host: "0.0.0.0",
    port: parseInt(process.env.PORT || "3000", 10),
  },
  preview: {
    host: "0.0.0.0",
    port: parseInt(process.env.PORT || "3000", 10),
    allowedHosts: true,
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
