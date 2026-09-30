import type { Prisma } from "@/generated/prisma/client";

/** Preparação inicial de um casal recém-criado (executada na mesma transação da criação). */
export async function onHouseholdCreated(tx: Prisma.TransactionClient, householdId: string) {
  // As sugestões de categorias são adicionadas na etapa de gestão financeira.
  void tx;
  void householdId;
}
