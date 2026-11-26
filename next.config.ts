import type { NextConfig } from "next";

// Plataforma autenticada e personalizada por usuário: todas as telas leem a sessão,
// então usamos o modelo dinâmico padrão (sem Cache Components).
const nextConfig: NextConfig = {
  cacheComponents: false,
  experimental: {
    serverActions: { bodySizeLimit: "4.5mb" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
