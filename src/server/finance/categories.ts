import { db } from "@/server/db";
import { DomainError, NotFoundError } from "@/server/errors";
import type { HouseholdContext } from "@/server/households/context";
import type { CategoryInput } from "@/lib/validation/finance";

export type CategoryDTO = {
  id: string;
  name: string;
  kind: "INCOME" | "EXPENSE";
  parentId: string | null;
  color: string;
  icon: string;
  archived: boolean;
};

const select = { id: true, name: true, kind: true, parentId: true, color: true, icon: true, archivedAt: true } as const;

function toDTO(c: { id: string; name: string; kind: "INCOME" | "EXPENSE"; parentId: string | null; color: string; icon: string; archivedAt: Date | null }): CategoryDTO {
  return { id: c.id, name: c.name, kind: c.kind, parentId: c.parentId, color: c.color, icon: c.icon, archived: !!c.archivedAt };
}

export async function listCategories(ctx: HouseholdContext, opts: { includeArchived?: boolean } = {}) {
  const rows = await db.category.findMany({
    where: { householdId: ctx.householdId, ...(opts.includeArchived ? {} : { archivedAt: null }) },
    orderBy: [{ kind: "desc" }, { name: "asc" }],
    select,
  });
  return rows.map(toDTO);
}

export async function getCategory(ctx: HouseholdContext, id: string) {
  const c = await db.category.findFirst({ where: { id, householdId: ctx.householdId }, select });
  if (!c) throw new NotFoundError();
  return toDTO(c);
}

async function assertUniqueName(ctx: HouseholdContext, input: { name: string; kind: string; parentId: string | null }, exceptId?: string) {
  const siblings = await db.category.findMany({
    where: { householdId: ctx.householdId, kind: input.kind as "INCOME" | "EXPENSE", parentId: input.parentId, NOT: exceptId ? { id: exceptId } : undefined },
    select: { name: true },
  });
  const lower = input.name.toLocaleLowerCase("pt-BR");
  if (siblings.some((s) => s.name.toLocaleLowerCase("pt-BR") === lower)) {
    throw new DomainError("Já existe uma categoria com esse nome", "name");
  }
}

async function resolveParent(ctx: HouseholdContext, parentId: string | null, kind: string) {
  if (!parentId) return null;
  const parent = await db.category.findFirst({
    where: { id: parentId, householdId: ctx.householdId },
    select: { id: true, kind: true, parentId: true, archivedAt: true },
  });
  if (!parent) throw new NotFoundError();
  if (parent.parentId) throw new DomainError("Subcategorias não podem ter subcategorias", "parentId");
  if (parent.kind !== kind) throw new DomainError("A subcategoria deve ser do mesmo tipo da categoria principal", "parentId");
  if (parent.archivedAt) throw new DomainError("A categoria principal está arquivada", "parentId");
  return parent;
}

export async function createCategory(ctx: HouseholdContext, input: CategoryInput) {
  await resolveParent(ctx, input.parentId, input.kind);
  await assertUniqueName(ctx, input);
  const c = await db.category.create({
    data: { householdId: ctx.householdId, name: input.name, kind: input.kind, parentId: input.parentId, color: input.color, icon: input.icon },
    select,
  });
  return toDTO(c);
}

/** Edita nome, cor, ícone e categoria principal. O tipo não muda depois de criado. */
export async function updateCategory(ctx: HouseholdContext, id: string, input: CategoryInput) {
  const current = await db.category.findFirst({
    where: { id, householdId: ctx.householdId },
    select: { id: true, kind: true, parentId: true, _count: { select: { children: true } } },
  });
  if (!current) throw new NotFoundError();
  if (input.kind !== current.kind) throw new DomainError("O tipo da categoria não pode ser alterado", "kind");
  if (input.parentId === id) throw new DomainError("Escolha outra categoria principal", "parentId");
  if (input.parentId && current._count.children > 0) {
    throw new DomainError("Uma categoria com subcategorias não pode virar subcategoria", "parentId");
  }
  if (input.parentId !== current.parentId) await resolveParent(ctx, input.parentId, current.kind);
  await assertUniqueName(ctx, { ...input, kind: current.kind }, id);
  const c = await db.category.update({
    where: { id },
    data: { name: input.name, color: input.color, icon: input.icon, parentId: input.parentId },
    select,
  });
  return toDTO(c);
}

/** Arquivar uma categoria principal arquiva também suas subcategorias. */
export async function setCategoryArchived(ctx: HouseholdContext, id: string, archived: boolean) {
  const c = await db.category.findFirst({
    where: { id, householdId: ctx.householdId },
    select: { id: true, parent: { select: { archivedAt: true } } },
  });
  if (!c) throw new NotFoundError();
  if (!archived && c.parent?.archivedAt) {
    throw new DomainError("Reative primeiro a categoria principal");
  }
  const archivedAt = archived ? new Date() : null;
  await db.$transaction([
    db.category.update({ where: { id }, data: { archivedAt } }),
    ...(archived
      ? [db.category.updateMany({ where: { parentId: id, householdId: ctx.householdId, archivedAt: null }, data: { archivedAt } })]
      : []),
  ]);
}

/** Exclui somente categorias nunca usadas e sem subcategorias; caso contrário, oriente arquivar. */
export async function deleteCategory(ctx: HouseholdContext, id: string) {
  const c = await db.category.findFirst({
    where: { id, householdId: ctx.householdId },
    select: { _count: { select: { transactions: true, budgets: true, children: true } } },
  });
  if (!c) throw new NotFoundError();
  if (c._count.transactions > 0 || c._count.budgets > 0 || c._count.children > 0) {
    throw new DomainError("Esta categoria já foi usada ou tem subcategorias. Arquive-a para preservar o histórico.");
  }
  await db.category.delete({ where: { id } });
}

/** Mapa subcategoria → categoria principal (para agregações sem dupla contagem). */
export async function parentMap(ctx: HouseholdContext) {
  const rows = await db.category.findMany({
    where: { householdId: ctx.householdId, parentId: { not: null } },
    select: { id: true, parentId: true },
  });
  return new Map(rows.map((r) => [r.id, r.parentId!]));
}
