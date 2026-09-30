import { db } from "@/server/db";
import { createCredentialUser } from "@/server/credentials";
import { addMember } from "@/server/households/members";
import { onHouseholdCreated } from "@/server/households/setup";
import { getHouseholdContext, type HouseholdContext } from "@/server/households/context";

let seq = 0;

export async function createUser(overrides: { name?: string; email?: string; password?: string; mustChangePassword?: boolean; isPlatformAdmin?: boolean } = {}) {
  seq += 1;
  return createCredentialUser({
    name: overrides.name ?? `Pessoa ${seq}`,
    email: overrides.email ?? `pessoa${seq}-${Date.now()}@teste.dev`,
    password: overrides.password ?? "senha-de-teste-1",
    mustChangePassword: overrides.mustChangePassword ?? false,
    isPlatformAdmin: overrides.isPlatformAdmin ?? false,
  });
}

/** Cria um casal com os usuários informados (ou dois novos) e devolve o contexto de cada membro. */
export async function createHouseholdWith(name: string, users?: { id: string }[]) {
  const members = users ?? [await createUser(), await createUser()];
  const household = await db.$transaction(async (tx) => {
    const h = await tx.household.create({ data: { name } });
    await onHouseholdCreated(tx, h.id);
    for (const u of members) await addMember(tx, h.id, u.id);
    return h;
  });
  const contexts: HouseholdContext[] = [];
  for (const u of members) contexts.push((await getHouseholdContext(u.id))!);
  return { household, users: members, contexts };
}
