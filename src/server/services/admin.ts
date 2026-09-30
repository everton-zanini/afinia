import { db } from "@/server/db";
import { createCredentialUser, normalizeEmail, setTemporaryPassword } from "@/server/credentials";
import { DomainError, NotFoundError } from "@/server/errors";
import { addMember } from "@/server/households/members";
import { onHouseholdCreated } from "@/server/households/setup";
import type { CreateHouseholdInput, ParticipantInput } from "@/lib/validation/admin";

// Serviço do painel administrativo. Só expõe dados de gestão — nunca dados financeiros.
// Quem chama deve garantir que o usuário é administrador (requireAdmin).

async function assertEmailsFree(emails: string[]) {
  const taken = await db.user.findMany({
    where: { email: { in: emails.map(normalizeEmail) } },
    select: { email: true },
  });
  if (taken.length > 0) {
    throw new DomainError(`Email já cadastrado: ${taken.map((t) => t.email).join(", ")}`, "participants");
  }
}

export async function createHousehold(adminUserId: string, input: CreateHouseholdInput) {
  await assertEmailsFree(input.participants.map((p) => p.email));
  return db.$transaction(async (tx) => {
    const household = await tx.household.create({ data: { name: input.name.trim() } });
    await onHouseholdCreated(tx, household.id);
    if (input.includeMe) await addMember(tx, household.id, adminUserId);
    for (const p of input.participants) {
      const user = await createCredentialUser({ ...p, mustChangePassword: true }, tx);
      await addMember(tx, household.id, user.id);
    }
    return household;
  });
}

export async function addParticipant(householdId: string, participant: ParticipantInput) {
  await assertEmailsFree([participant.email]);
  return db.$transaction(async (tx) => {
    const exists = await tx.household.findUnique({ where: { id: householdId }, select: { id: true } });
    if (!exists) throw new NotFoundError("Casal não encontrado");
    const user = await createCredentialUser({ ...participant, mustChangePassword: true }, tx);
    await addMember(tx, householdId, user.id);
    return user.id;
  });
}

export async function setHouseholdActive(householdId: string, active: boolean) {
  await db.$transaction(async (tx) => {
    const household = await tx.household.findUnique({
      where: { id: householdId },
      select: { members: { select: { userId: true } } },
    });
    if (!household) throw new NotFoundError("Casal não encontrado");
    await tx.household.update({ where: { id: householdId }, data: { active } });
    if (!active) {
      await tx.session.deleteMany({
        where: { userId: { in: household.members.map((m) => m.userId) } },
      });
    }
  });
}

export async function resetParticipantPassword(householdId: string, userId: string, password: string) {
  const member = await db.householdMember.findFirst({ where: { householdId, userId }, select: { id: true } });
  if (!member) throw new NotFoundError("Participante não encontrado");
  await setTemporaryPassword(userId, password);
}

const managementSelect = {
  id: true,
  name: true,
  active: true,
  createdAt: true,
  members: {
    orderBy: { createdAt: "asc" as const },
    select: {
      id: true,
      active: true,
      createdAt: true,
      user: { select: { id: true, name: true, email: true, mustChangePassword: true, isPlatformAdmin: true } },
    },
  },
};

export async function listHouseholds() {
  return db.household.findMany({ orderBy: { createdAt: "asc" }, select: managementSelect });
}

export async function getHouseholdForAdmin(householdId: string) {
  return db.household.findUnique({ where: { id: householdId }, select: managementSelect });
}

export async function adminHasHousehold(adminUserId: string) {
  return !!(await db.householdMember.findUnique({ where: { userId: adminUserId }, select: { id: true } }));
}
