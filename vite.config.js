import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // Lets `netlify dev` proxy /.netlify/functions/* to the local
    // functions server while Vite serves the frontend during development.
    port: 5173,
  },
});
