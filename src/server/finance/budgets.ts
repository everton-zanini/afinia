import { db } from "@/server/db";
import { DomainError, NotFoundError } from "@/server/errors";
import type { HouseholdContext } from "@/server/households/context";
import { addMonths, monthRange, toDbDate, type ISOMonth } from "@/lib/dates";
import { budgetProgress, type BudgetRow } from "@/lib/finance/rules";
import { movementSelect, toMovement } from "./common";
import { parentMap } from "./categories";
import { cardMovements } from "./cards";

/** Despesas relevantes para o mês: efetivadas pela data de efetivação, pendentes pela prevista. */
export async function monthExpenseMovements(ctx: HouseholdContext, month: ISOMonth) {
  const { from, to } = monthRange(month);
  const range = { gte: toDbDate(from), lte: toDbDate(to) };
  const [rows, card] = await Promise.all([
    db.transaction.findMany({
      where: {
        householdId: ctx.householdId,
        kind: "EXPENSE",
        OR: [
          { status: "EFFECTIVE", effectiveDate: range },
          { status: "PENDING", dueDate: range },
        ],
      },
      select: movementSelect,
    }),
    // Parcelas confirmadas (realizado) e previsões (pendente) pelo vencimento da fatura.
    cardMovements(ctx, { from, to }),
  ]);
  return [...rows.map(toMovement), ...card];
}

export type BudgetView = BudgetRow & { name: string; color: string; icon: string; archived: boolean };

export async function monthBudget(ctx: HouseholdContext, month: ISOMonth) {
  const [limits, movements, parents, categories] = await Promise.all([
    db.budget.findMany({ where: { householdId: ctx.householdId, month }, select: { categoryId: true, limitCents: true } }),
    monthExpenseMovements(ctx, month),
    parentMap(ctx),
    db.category.findMany({
      where: { householdId: ctx.householdId, kind: "EXPENSE", parentId: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true, color: true, icon: true, archivedAt: true },
    }),
  ]);
  const rows = budgetProgress(limits, movements, month, parents);
  const byId = new Map(rows.map((r) => [r.categoryId, r]));
  const withLimit: BudgetView[] = [];
  const withoutLimit: { id: string; name: string; color: string; icon: string; realizedCents: number; pendingCents: number }[] = [];
  // Consumo das categorias sem limite (para exibir e permitir definir o limite a partir do gasto).
  const noLimitProgress = budgetProgress(
    categories.filter((c) => !byId.has(c.id)).map((c) => ({ categoryId: c.id, limitCents: 1 })),
    movements,
    month,
    parents,
  );
  const noLimitById = new Map(noLimitProgress.map((r) => [r.categoryId, r]));
  for (const c of categories) {
    const r = byId.get(c.id);
    if (r) withLimit.push({ ...r, name: c.name, color: c.color, icon: c.icon, archived: !!c.archivedAt });
    else if (!c.archivedAt) {
      const p = noLimitById.get(c.id)!;
      withoutLimit.push({ id: c.id, name: c.name, color: c.color, icon: c.icon, realizedCents: p.realizedCents, pendingCents: p.pendingCents });
    }
  }
  const totals = withLimit.reduce(
    (acc, r) => ({
      limitCents: acc.limitCents + r.limitCents,
      realizedCents: acc.realizedCents + r.realizedCents,
      pendingCents: acc.pendingCents + r.pendingCents,
    }),
    { limitCents: 0, realizedCents: 0, pendingCents: 0 },
  );
  return { month, rows: withLimit, withoutLimit, totals };
}

async function assertBudgetCategory(ctx: HouseholdContext, categoryId: string) {
  const c = await db.category.findFirst({
    where: { id: categoryId, householdId: ctx.householdId },
    select: { kind: true, parentId: true, archivedAt: true },
  });
  if (!c) throw new NotFoundError();
  if (c.kind !== "EXPENSE" || c.parentId) {
    throw new DomainError("Defina limites apenas em categorias principais de despesa");
  }
  return c;
}

/** Define (ou remove, com null) o limite de uma categoria no mês. */
export async function setBudgetLimit(ctx: HouseholdContext, month: ISOMonth, categoryId: string, limitCents: number | null) {
  const c = await assertBudgetCategory(ctx, categoryId);
  if (limitCents === null) {
    await db.budget.deleteMany({ where: { householdId: ctx.householdId, month, categoryId } });
    return;
  }
  if (c.archivedAt) throw new DomainError("Esta categoria está arquivada");
  await db.budget.upsert({
    where: { householdId_month_categoryId: { householdId: ctx.householdId, month, categoryId } },
    create: { householdId: ctx.householdId, month, categoryId, limitCents },
    update: { limitCents },
  });
}

/** Copia limites do mês anterior sem sobrescrever os já definidos e ignorando arquivadas. */
export async function copyPreviousMonth(ctx: HouseholdContext, month: ISOMonth) {
  const previous = addMonths(month, -1);
  const source = await db.budget.findMany({
    where: { householdId: ctx.householdId, month: previous, category: { archivedAt: null } },
    select: { categoryId: true, limitCents: true },
  });
  if (source.length === 0) return 0;
  const result = await db.budget.createMany({
    data: source.map((s) => ({ householdId: ctx.householdId, month, categoryId: s.categoryId, limitCents: s.limitCents })),
    skipDuplicates: true,
  });
  return result.count;
}
