import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      // only REST goes through Vite
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
});
