// Executado via tsx pelo global-setup (o client Prisma gerado é ESM e não carrega no runner do Playwright).
import { db } from "../src/server/db";
import { createCredentialUser } from "../src/server/credentials";
import { addMember } from "../src/server/households/members";
import { onHouseholdCreated } from "../src/server/households/setup";
import { assertTestDatabaseUrl } from "../src/server/test-db-guard";
import { resetDatabase } from "../test/db";
import { E2E } from "./fixtures";

async function household(name: string, userIds: string[]) {
  return db.$transaction(async (tx) => {
    const h = await tx.household.create({ data: { name } });
    await onHouseholdCreated(tx, h.id);
    for (const id of userIds) await addMember(tx, h.id, id);
    return h;
  });
}

async function main() {
  assertTestDatabaseUrl(process.env.DATABASE_URL);
  await resetDatabase();
  await createCredentialUser({ ...E2E.admin, isPlatformAdmin: true, mustChangePassword: false });
  const ana = await createCredentialUser({ ...E2E.ana, mustChangePassword: false });
  const beto = await createCredentialUser({ ...E2E.beto, mustChangePassword: false });
  const temp = await createCredentialUser({ ...E2E.temp, mustChangePassword: true });
  await household("Casa Ana e Beto", [ana.id, beto.id]);
  await household("Casa Temporária", [temp.id]);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
