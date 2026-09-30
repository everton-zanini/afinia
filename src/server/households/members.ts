import type { Prisma } from "@/generated/prisma/client";
import { DomainError } from "@/server/errors";

export const MAX_ACTIVE_MEMBERS = 2;

/**
 * Único ponto que cria vínculos usuário ↔ casal. Deve rodar dentro de uma transação:
 * bloqueia a linha do casal para que duas inclusões simultâneas não ultrapassem o limite.
 */
export async function addMember(tx: Prisma.TransactionClient, householdId: string, userId: string) {
  const locked = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM "household" WHERE id = ${householdId} FOR UPDATE`;
  if (locked.length === 0) throw new DomainError("Casal não encontrado");

  const existing = await tx.householdMember.findUnique({ where: { userId }, select: { id: true } });
  if (existing) throw new DomainError("Esta pessoa já participa de um casal");

  const activeCount = await tx.householdMember.count({ where: { householdId, active: true } });
  if (activeCount >= MAX_ACTIVE_MEMBERS) {
    throw new DomainError("Este casal já tem dois participantes");
  }
  return tx.householdMember.create({ data: { householdId, userId } });
}
