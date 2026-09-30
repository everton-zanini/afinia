import { assertTestDatabaseUrl } from "@/server/test-db-guard";

// Testes de integração só rodam via `npm run test:integration`, que aponta DATABASE_URL para o banco _test.
if (process.env.AFINIA_TEST_DB !== "1") {
  throw new Error("Use `npm run test:integration` para rodar testes de integração.");
}
assertTestDatabaseUrl(process.env.DATABASE_URL);
