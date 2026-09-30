import type { Prisma } from "@/generated/prisma/client";
import { SUGGESTED_CATEGORIES } from "@/lib/category-style";

/** Preparação inicial de um casal recém-criado (executada na mesma transação da criação). */
export async function onHouseholdCreated(tx: Prisma.TransactionClient, householdId: string) {
  await seedSuggestedCategories(tx, householdId);
}

/** Cria as categorias sugeridas que ainda não existem (idempotente, sem sobrescrever edições). */
export async function seedSuggestedCategories(tx: Prisma.TransactionClient, householdId: string) {
  const existing = await tx.category.findMany({
    where: { householdId, parentId: null },
    select: { kind: true, name: true },
  });
  const keys = new Set(existing.map((c) => `${c.kind}:${c.name.toLocaleLowerCase("pt-BR")}`));
  const missing = SUGGESTED_CATEGORIES.filter((c) => !keys.has(`${c.kind}:${c.name.toLocaleLowerCase("pt-BR")}`));
  if (missing.length === 0) return 0;
  await tx.category.createMany({ data: missing.map((c) => ({ ...c, householdId })) });
  return missing.length;
}
