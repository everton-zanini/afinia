import { monthOf } from "@/lib/dates";
import { assertCents } from "@/lib/money";
import type { AccountOpening, ISODate, ISOMonth, Movement } from "./types";

/**
 * Data que posiciona o lançamento no tempo: efetivados pela data de efetivação,
 * pendentes pela data prevista.
 */
export function referenceDate(m: Pick<Movement, "status" | "dueDate" | "effectiveDate">): ISODate {
  return m.status === "EFFECTIVE" ? m.effectiveDate! : m.dueDate;
}

/** Efeito de um lançamento efetivado sobre uma conta (centavos com sinal). */
export function effectOnAccount(m: Movement, accountId: string): number {
  if (m.status !== "EFFECTIVE") return 0;
  switch (m.kind) {
    case "INCOME":
      return m.accountId === accountId ? m.amountCents : 0;
    case "EXPENSE":
      return m.accountId === accountId ? -m.amountCents : 0;
    case "TRANSFER":
      if (m.accountId === accountId) return -m.amountCents;
      if (m.toAccountId === accountId) return m.amountCents;
      return 0;
  }
}

/**
 * Saldo realizado por conta até `asOf` (inclusive): saldo inicial + efeitos dos efetivados.
 * Sem `asOf`, considera todos os efetivados. O saldo inicial vale a partir da data de abertura.
 */
export function accountBalances(accounts: AccountOpening[], movements: Movement[], asOf?: ISODate) {
  const balances = new Map<string, number>();
  for (const a of accounts) {
    balances.set(a.id, !asOf || a.openingDate <= asOf ? a.openingBalanceCents : 0);
  }
  for (const m of movements) {
    if (m.status !== "EFFECTIVE") continue;
    if (asOf && m.effectiveDate! > asOf) continue;
    for (const id of [m.accountId, m.toAccountId]) {
      if (id && balances.has(id)) balances.set(id, assertCents(balances.get(id)! + effectOnAccount(m, id)));
    }
  }
  return balances;
}

export function totalBalance(accounts: AccountOpening[], movements: Movement[], asOf?: ISODate) {
  let total = 0;
  for (const v of accountBalances(accounts, movements, asOf).values()) total += v;
  return assertCents(total);
}

export type MonthTotals = {
  incomeRealized: number;
  expenseRealized: number;
  result: number;
  incomePending: number;
  expensePending: number;
};

/** Receitas separadas por origem: dinheiro (banco, dinheiro, reserva) × créditos de benefício. */
export type IncomeBreakdown = {
  incomeCash: number;
  incomeBenefit: number;
  incomeCashPending: number;
  incomeBenefitPending: number;
};

/**
 * Totais do mês. Transferências nunca entram em receitas ou despesas. Receitas em contas de
 * benefício (`benefitAccountIds`) são créditos de benefício: entram no total e no resultado,
 * mas aparecem separadas das receitas em dinheiro.
 */
export function monthTotals(movements: Movement[], month: ISOMonth): MonthTotals;
export function monthTotals(movements: Movement[], month: ISOMonth, benefitAccountIds: Set<string>): MonthTotals & IncomeBreakdown;
export function monthTotals(movements: Movement[], month: ISOMonth, benefitAccountIds?: Set<string>) {
  const t = { incomeRealized: 0, expenseRealized: 0, incomePending: 0, expensePending: 0 };
  const b = { incomeCash: 0, incomeBenefit: 0, incomeCashPending: 0, incomeBenefitPending: 0 };
  for (const m of movements) {
    if (m.kind === "TRANSFER") continue;
    if (monthOf(referenceDate(m)) !== month) continue;
    const effective = m.status === "EFFECTIVE";
    const key = effective
      ? m.kind === "INCOME" ? "incomeRealized" : "expenseRealized"
      : m.kind === "INCOME" ? "incomePending" : "expensePending";
    t[key] += m.amountCents;
    if (m.kind === "INCOME") {
      const benefit = benefitAccountIds?.has(m.accountId) ?? false;
      const bKey = benefit
        ? effective ? "incomeBenefit" : "incomeBenefitPending"
        : effective ? "incomeCash" : "incomeCashPending";
      b[bKey] += m.amountCents;
    }
  }
  const totals = { ...t, result: t.incomeRealized - t.expenseRealized };
  return benefitAccountIds ? { ...totals, ...b } : totals;
}

export type BalanceSplit = {
  /** Disponível para uso geral: contas bancárias, dinheiro e reservas. */
  generalCents: number;
  benefitCents: number;
  totalCents: number;
  benefits: { id: string; cents: number }[];
};

/** Separa saldos de contas ativas em uso geral e benefícios. */
export function splitBalances(
  accounts: { id: string; kind: string; archived?: boolean }[],
  balances: Map<string, number>,
): BalanceSplit {
  let generalCents = 0;
  let benefitCents = 0;
  const benefits: BalanceSplit["benefits"] = [];
  for (const a of accounts) {
    if (a.archived) continue;
    const cents = balances.get(a.id) ?? 0;
    if (a.kind === "BENEFIT") {
      benefitCents += cents;
      benefits.push({ id: a.id, cents });
    } else {
      generalCents += cents;
    }
  }
  return {
    generalCents: assertCents(generalCents),
    benefitCents: assertCents(benefitCents),
    totalCents: assertCents(generalCents + benefitCents),
    benefits,
  };
}

export type BudgetAlert = "ok" | "near" | "over";

export function budgetAlert(realized: number, limit: number): BudgetAlert {
  // Comparação em inteiros: realized/limit > 1 ⇔ realized > limit; ≥ 0,8 ⇔ 5·realized ≥ 4·limit.
  if (realized > limit) return "over";
  if (realized * 5 >= limit * 4) return "near";
  return "ok";
}

export type BudgetRow = {
  categoryId: string;
  limitCents: number;
  realizedCents: number;
  pendingCents: number;
  availableCents: number;
  percent: number;
  alert: BudgetAlert;
};

/**
 * Progresso do orçamento do mês. Despesas de subcategorias contam na categoria principal
 * (`parentOf`: subcategoria → principal). Cada despesa é somada uma única vez.
 */
export function budgetProgress(
  limits: { categoryId: string; limitCents: number }[],
  movements: Movement[],
  month: ISOMonth,
  parentOf: Map<string, string>,
): BudgetRow[] {
  const realized = new Map<string, number>();
  const pending = new Map<string, number>();
  for (const m of movements) {
    if (m.kind !== "EXPENSE" || !m.categoryId) continue;
    if (monthOf(referenceDate(m)) !== month) continue;
    const top = parentOf.get(m.categoryId) ?? m.categoryId;
    const target = m.status === "EFFECTIVE" ? realized : pending;
    target.set(top, (target.get(top) ?? 0) + m.amountCents);
  }
  return limits.map(({ categoryId, limitCents }) => {
    const r = realized.get(categoryId) ?? 0;
    return {
      categoryId,
      limitCents,
      realizedCents: r,
      pendingCents: pending.get(categoryId) ?? 0,
      availableCents: limitCents - r,
      percent: Math.round((r * 100) / limitCents),
      alert: budgetAlert(r, limitCents),
    };
  });
}
