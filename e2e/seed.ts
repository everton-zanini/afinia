// Executado via tsx pelo global-setup (o client Prisma gerado é ESM e não carrega no runner do Playwright).
import { db } from "../src/server/db";
import { createCredentialUser } from "../src/server/credentials";
import { addMember } from "../src/server/households/members";
import { onHouseholdCreated } from "../src/server/households/setup";
import { assertTestDatabaseUrl } from "../src/server/test-db-guard";
import { getHouseholdContext } from "../src/server/households/context";
import { resetDatabase } from "../test/db";
import { loadFixture } from "../test/finance-fixture";
import { createAccount } from "../src/server/finance/accounts";
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
  const fx = await createCredentialUser({ ...E2E.fixture, mustChangePassword: false });
  await household("Casa Fixture", [fx.id]);
  await loadFixture((await getHouseholdContext(fx.id))!);
  const rec = await createCredentialUser({ ...E2E.rec, mustChangePassword: false });
  await household("Casa Recorrência", [rec.id]);
  await createAccount((await getHouseholdContext(rec.id))!, {
    name: "Corrente", kind: "CHECKING", openingBalance: 500_000, openingDate: "2025-01-01",
  });
  const ben = await createCredentialUser({ ...E2E.ben, mustChangePassword: false });
  await household("Casa Benefício", [ben.id]);
  await createAccount((await getHouseholdContext(ben.id))!, {
    name: "Corrente", kind: "CHECKING", openingBalance: 100_000, openingDate: "2025-01-01",
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
