import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

const envFiles = [
  resolve(process.cwd(), "../../.env"),
  resolve(process.cwd(), ".env"),
  resolve(process.cwd(), ".env.local"),
];

for (const envFile of envFiles) {
  if (existsSync(envFile)) {
    loadEnv({ path: envFile, override: false });
  }
}

const fallbackDatabaseUrl =
  "postgresql://tsudolio:tsudolio@localhost:5432/tsudolio";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? fallbackDatabaseUrl,
  },
});
