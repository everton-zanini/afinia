// Executado via tsx pelo global-setup (o client Prisma gerado é ESM e não carrega no runner do Playwright).
import { db } from "../src/server/db";
import { createCredentialUser } from "../src/server/credentials";
import { assertTestDatabaseUrl } from "../src/server/test-db-guard";
import { resetDatabase } from "../test/db";
import { E2E } from "./fixtures";

async function main() {
  assertTestDatabaseUrl(process.env.DATABASE_URL);
  await resetDatabase();
  await createCredentialUser({ ...E2E.ana, mustChangePassword: false });
  await createCredentialUser({ ...E2E.temp, mustChangePassword: true });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
