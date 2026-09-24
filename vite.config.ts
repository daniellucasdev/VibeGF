import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
  // Prefixo "" lê também o PORT do .env (só aqui no config, nada vai pro bundle).
  const env = loadEnv(mode, process.cwd(), "");
  const apiPort = env.PORT || "8787";
  return {
    plugins: [react(), tailwindcss()],
    build: {
      rollupOptions: {
        // vendors em chunks próprios: nenhum passa de 500 kB e o cache do navegador dura mais
        output: { manualChunks: { react: ["react", "react-dom"], motion: ["motion"], zod: ["zod"] } },
      },
    },
    server: {
      port: 5173,
      proxy: { "/api": `http://localhost:${apiPort}` },
    },
  };
});
