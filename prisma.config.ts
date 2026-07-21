import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * Não use env("DATABASE_URL") aqui: o helper falha se a variável não existir,
 * e o `prisma generate` (postinstall/Vercel) não precisa de conexão real.
 * Migrate/seed ainda usam DATABASE_URL via process.env quando disponível.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
