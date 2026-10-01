import { db } from "@/server/db";
import type { HouseholdContext } from "@/server/households/context";
import { addMonths, monthRange, toDbDate, type ISODate, type ISOMonth } from "@/lib/dates";
import { accountBalances, monthTotals, splitBalances } from "@/lib/finance/rules";
import { balanceEvolution, buildInsights, compare, expensesByCategory, monthlySeries, upcoming } from "@/lib/finance/reports";
import { movementSelect, toMovement } from "./common";
import { listAccounts } from "./accounts";
import { parentMap } from "./categories";
import { monthBudget } from "./budgets";
import { listTransactions } from "./transactions";
import { cardDebt, cardMovements } from "./cards";

/** Efetivados até o fim do mês + pendentes, opcionalmente só de uma conta (origem ou destino). */
async function loadMovements(ctx: HouseholdContext, until: ISODate | null, accountId?: string) {
  const rows = await db.transaction.findMany({
    where: {
      householdId: ctx.householdId,
      ...(until ? { OR: [{ status: "EFFECTIVE", effectiveDate: { lte: toDbDate(until) } }, { status: "PENDING" }] } : {}),
      ...(accountId ? { AND: [{ OR: [{ accountId }, { toAccountId: accountId }] }] } : {}),
    },
    select: movementSelect,
  });
  return rows.map(toMovement);
}

async function categoryInfo(ctx: HouseholdContext) {
  const rows = await db.category.findMany({
    where: { householdId: ctx.householdId },
    select: { id: true, name: true, color: true, icon: true },
  });
  return new Map(rows.map((r) => [r.id, r]));
}

/** O saldo total considera todos os efetivados — o mesmo número da página de Contas. */
export async function dashboard(ctx: HouseholdContext, month: ISOMonth, today: ISODate) {
  const [accounts, cashMovements, spending, parents, categories, budget, pendingRows, cardsView] = await Promise.all([
    listAccounts(ctx, { includeArchived: true }),
    loadMovements(ctx, null),
    cardMovements(ctx),
    parentMap(ctx),
    categoryInfo(ctx),
    monthBudget(ctx, month),
    listTransactions(ctx, { status: "PENDING" }, { limit: 200 }),
    cardDebt(ctx, today),
  ]);
  // Caixa: só lançamentos (compras no cartão não mexem nas contas). Gastos: lançamentos + cartão.
  const movements = [...cashMovements, ...spending];
  const active = accounts.filter((a) => !a.archived);
  const balances = accountBalances(accounts, cashMovements.filter((m) => m.status === "EFFECTIVE"));
  const split = splitBalances(accounts, balances);
  const benefitIds = new Set(accounts.filter((a) => a.kind === "BENEFIT").map((a) => a.id));
  const names = new Map(accounts.map((a) => [a.id, a]));

  const current = monthTotals(movements, month, benefitIds);
  const previous = monthTotals(movements, addMonths(month, -1));
  const byCategory = expensesByCategory(movements, month, parents);
  const due = upcoming(pendingRows, today);
  const categoryNames = new Map([...categories].map(([id, c]) => [id, c.name]));

  return {
    hasAccounts: active.length > 0,
    hasTransactions: cashMovements.length > 0 || spending.length > 0,
    /** Consolidado (uso geral + benefícios), sempre exibido com a composição. */
    totalBalanceCents: split.totalCents,
    generalBalanceCents: split.generalCents,
    benefitBalanceCents: split.benefitCents,
    benefits: split.benefits.map((b) => ({
      ...b,
      name: names.get(b.id)!.name,
      purpose: names.get(b.id)!.benefitPurpose,
    })),
    current,
    /** Dívidas de cartão (saldo devedor das faturas) — nunca somadas ao saldo nem ao limite. */
    cardDebtCents: cardsView.debtCents,
    cards: cardsView.cards
      .filter((c) => !c.archived || c.limit.committedCents > 0)
      .map((c) => ({
        id: c.id,
        name: c.name,
        color: c.color,
        committedCents: c.limit.committedCents,
        nextDue: c.nextDue ? { dueDate: c.nextDue.dueDate, remainingCents: c.nextDue.status.remainingCents, overdue: c.nextDue.status.overdue } : null,
      })),
    comparison: {
      income: compare(current.incomeRealized, previous.incomeRealized),
      expense: compare(current.expenseRealized, previous.expenseRealized),
      result: compare(current.result, previous.result),
    },
    overdue: due.overdue,
    next: due.next,
    budgetRows: [...budget.rows].sort((a, b) => b.percent - a.percent),
    topCategories: byCategory.slices.slice(0, 3).map((s) => ({ ...s, ...categories.get(s.categoryId)! })),
    insights: buildInsights({ categoryNames, byCategory, expense: compare(current.expenseRealized, previous.expenseRealized), budgetRows: budget.rows, overdue: due.overdue }),
  };
}

export async function reports(ctx: HouseholdContext, opts: { month: ISOMonth; accountId?: string; today: ISODate }) {
  const { to } = monthRange(opts.month);
  const accountsAll = await listAccounts(ctx, { includeArchived: true });
  const accountId = opts.accountId && accountsAll.some((a) => a.id === opts.accountId) ? opts.accountId : undefined;
  const [cashMovements, spending, parents, categories] = await Promise.all([
    loadMovements(ctx, to, accountId),
    // Com filtro por conta, gastos de cartão não são atribuídos à conta.
    accountId ? Promise.resolve([]) : cardMovements(ctx, { to }),
    parentMap(ctx),
    categoryInfo(ctx),
  ]);
  const movements = [...cashMovements, ...spending];
  const scopeAccounts = accountId ? accountsAll.filter((a) => a.id === accountId) : accountsAll;
  // Receitas/despesas de uma conta: apenas lançamentos cuja conta é ela (transferências já são ignoradas).
  const own = accountId ? movements.filter((m) => m.kind === "TRANSFER" || m.accountId === accountId) : movements;

  const byCategory = expensesByCategory(own, opts.month, parents);
  const evolution = balanceEvolution(scopeAccounts, movements, opts.month, opts.today < to ? opts.today : undefined);
  return {
    accountId: accountId ?? null,
    accounts: accountsAll.map((a) => ({ id: a.id, name: a.name, archived: a.archived })),
    byCategory: {
      totalCents: byCategory.totalCents,
      slices: byCategory.slices.map((s) => {
        const c = categories.get(s.categoryId);
        return { ...s, name: c?.name ?? "Sem nome", color: c?.color ?? "#5f6b6a", icon: c?.icon ?? "tag" };
      }),
    },
    series: monthlySeries(own, opts.month, 6, new Set(accountsAll.filter((a) => a.kind === "BENEFIT").map((a) => a.id))),
    evolution,
  };
}
