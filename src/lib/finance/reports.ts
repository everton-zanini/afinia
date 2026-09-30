import { addDays, addMonths, monthOf, monthRange, type ISODate, type ISOMonth } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import { accountBalances, effectOnAccount, referenceDate, type BudgetRow } from "./rules";
import type { AccountOpening, Movement } from "./types";

export type CategorySlice = { categoryId: string; amountCents: number; percent: number };

/** Despesas realizadas do mês por categoria principal, em ordem decrescente. */
export function expensesByCategory(movements: Movement[], month: ISOMonth, parentOf: Map<string, string>) {
  const sums = new Map<string, number>();
  let total = 0;
  for (const m of movements) {
    if (m.kind !== "EXPENSE" || m.status !== "EFFECTIVE" || !m.categoryId) continue;
    if (monthOf(m.effectiveDate!) !== month) continue;
    const top = parentOf.get(m.categoryId) ?? m.categoryId;
    sums.set(top, (sums.get(top) ?? 0) + m.amountCents);
    total += m.amountCents;
  }
  const slices: CategorySlice[] = [...sums.entries()]
    .map(([categoryId, amountCents]) => ({ categoryId, amountCents, percent: Math.round((amountCents * 100) / total) }))
    .sort((a, b) => b.amountCents - a.amountCents);
  return { totalCents: total, slices };
}

export type MonthPoint = { month: ISOMonth; incomeCents: number; expenseCents: number };

/** Receitas e despesas realizadas dos `count` meses terminando em `endMonth` (inclui meses zerados). */
export function monthlySeries(movements: Movement[], endMonth: ISOMonth, count = 6): MonthPoint[] {
  const months = Array.from({ length: count }, (_, i) => addMonths(endMonth, i - count + 1));
  const index = new Map(months.map((m, i) => [m, i]));
  const points = months.map((month) => ({ month, incomeCents: 0, expenseCents: 0 }));
  for (const m of movements) {
    if (m.kind === "TRANSFER" || m.status !== "EFFECTIVE") continue;
    const i = index.get(monthOf(m.effectiveDate!));
    if (i === undefined) continue;
    if (m.kind === "INCOME") points[i].incomeCents += m.amountCents;
    else points[i].expenseCents += m.amountCents;
  }
  return points;
}

export type BalancePoint = { date: ISODate; balanceCents: number };

/**
 * Evolução diária do saldo realizado no mês. `openingCents` é o saldo ao fim do dia anterior ao
 * primeiro dia do mês. Contas abertas no mês entram com o saldo de abertura na data de abertura.
 * `until` limita os pontos (ex.: hoje, no mês corrente).
 */
export function balanceEvolution(accounts: AccountOpening[], movements: Movement[], month: ISOMonth, until?: ISODate) {
  const { from, to } = monthRange(month);
  const last = until && until < to ? until : to;
  const dayBefore = addDays(from, -1);
  let balance = 0;
  for (const v of accountBalances(accounts, movements, dayBefore).values()) balance += v;
  const openingCents = balance;

  const ids = new Set(accounts.map((a) => a.id));
  const deltas = new Map<ISODate, number>();
  const add = (d: ISODate, v: number) => deltas.set(d, (deltas.get(d) ?? 0) + v);
  for (const a of accounts) if (a.openingDate >= from && a.openingDate <= last) add(a.openingDate, a.openingBalanceCents);
  for (const m of movements) {
    if (m.status !== "EFFECTIVE") continue;
    const d = m.effectiveDate!;
    if (d < from || d > last) continue;
    let effect = 0;
    for (const id of new Set([m.accountId, m.toAccountId])) if (id && ids.has(id)) effect += effectOnAccount(m, id);
    if (effect) add(d, effect);
  }

  const points: BalancePoint[] = [];
  if (last >= from) {
    for (let d = from; d <= last; d = addDays(d, 1)) {
      balance += deltas.get(d) ?? 0;
      points.push({ date: d, balanceCents: balance });
    }
  }
  return { openingCents, closingCents: balance, points };
}

export type Comparison = { currentCents: number; previousCents: number; deltaCents: number; percent: number | null };

/** Variação entre meses. Sem base (anterior = 0) não há percentual. */
export function compare(currentCents: number, previousCents: number): Comparison {
  const deltaCents = currentCents - previousCents;
  return {
    currentCents,
    previousCents,
    deltaCents,
    percent: previousCents === 0 ? null : Math.round((deltaCents * 100) / Math.abs(previousCents)),
  };
}

export type Pending = { dueDate: ISODate; amountCents: number; kind: Movement["kind"] };

/** Pendências atrasadas e as que vencem nos próximos `days` dias (inclusive hoje). */
export function upcoming<T extends Pending>(pending: T[], today: ISODate, days = 7) {
  const limit = addDays(today, days);
  const sorted = [...pending].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  return {
    overdue: sorted.filter((p) => p.dueDate < today),
    next: sorted.filter((p) => p.dueDate >= today && p.dueDate <= limit),
  };
}

/** Frases calculadas só com dados do casal. Não fazem recomendações. */
export function buildInsights(input: {
  categoryNames: Map<string, string>;
  byCategory: ReturnType<typeof expensesByCategory>;
  expense: Comparison;
  budgetRows: (BudgetRow & { name: string })[];
  overdue: Pending[];
}): string[] {
  const out: string[] = [];
  const top = input.byCategory.slices[0];
  if (top && input.byCategory.totalCents > 0) {
    out.push(`${input.categoryNames.get(top.categoryId) ?? "Uma categoria"} representa ${top.percent}% das despesas realizadas do mês.`);
  }
  if (input.expense.percent !== null && input.expense.deltaCents !== 0) {
    const dir = input.expense.deltaCents > 0 ? "acima" : "abaixo";
    out.push(`As despesas realizadas estão ${Math.abs(input.expense.percent)}% ${dir} das do mês anterior.`);
  }
  for (const r of input.budgetRows.filter((b) => b.alert === "over").slice(0, 2)) {
    out.push(`${r.name} passou do limite em ${formatBRL(-r.availableCents)}.`);
  }
  const overdueExpenses = input.overdue.filter((p) => p.kind === "EXPENSE");
  if (overdueExpenses.length > 0) {
    const sum = overdueExpenses.reduce((s, p) => s + p.amountCents, 0);
    out.push(
      overdueExpenses.length === 1
        ? `Há 1 despesa atrasada de ${formatBRL(sum)}.`
        : `Há ${overdueExpenses.length} despesas atrasadas somando ${formatBRL(sum)}.`,
    );
  }
  return out;
}

export { referenceDate };
