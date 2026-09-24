import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// O proxy de /api -> :8787 entra na fase 3, junto com o servidor.
export default defineConfig({
  plugins: [react(), tailwindcss()],
});
