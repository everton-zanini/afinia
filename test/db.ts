import { db } from "@/server/db";
import { assertTestDatabaseUrl } from "@/server/test-db-guard";

/** Limpa todas as tabelas do banco de testes. Recusa qualquer banco que não termine em _test. */
export async function resetDatabase() {
  assertTestDatabaseUrl(process.env.DATABASE_URL);
  const tables = await db.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length === 0) return;
  const list = tables.map((t) => `"public"."${t.tablename}"`).join(", ");
  await db.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}
