import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import preact from "@preact/preset-vite";

export default defineConfig({
  plugins: [preact(), viteSingleFile()],
  build: {
    outDir: "dist/ui",
    rollupOptions: {
      input: process.env.INPUT,
    },
  },
});
