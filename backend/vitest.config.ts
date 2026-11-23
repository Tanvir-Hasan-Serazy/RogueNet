import { defineConfig } from "vitest/config";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@core": fileURLToPath(new URL("./src/core", import.meta.url)),
      "@features": fileURLToPath(new URL("./src/features", import.meta.url)),
      "@workers": fileURLToPath(new URL("./src/workers", import.meta.url)),
      "@ws-server": fileURLToPath(new URL("./ws-server", import.meta.url)),
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
