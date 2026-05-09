export const defaultDatabaseUrl =
  "postgresql://tsudolio:tsudolio@localhost:5432/tsudolio";

export function getDatabaseUrl() {
  return process.env.DATABASE_URL ?? defaultDatabaseUrl;
}
