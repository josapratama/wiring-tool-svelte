import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import path from "path";

export default defineConfig({
  plugins: [svelte()],
  base: "./", // relative paths so built dist/ opens without a server
  resolve: {
    alias: { $lib: path.resolve("./src/lib") },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
