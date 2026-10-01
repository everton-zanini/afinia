import { describe, expect, it } from "vitest";
import { balanceEvolution, expensesByCategory, monthlySeries } from "./reports";
import { accountBalances, budgetProgress, monthTotals } from "./rules";
import type { Movement } from "./types";

// Três visões: caixa (contas), gastos/orçamento (categoria pelo vencimento) e limite (cards.ts).
const mv = (over: Partial<Movement>): Movement => ({
  kind: "EXPENSE",
  status: "EFFECTIVE",
  amountCents: 0,
  accountId: "corrente",
  toAccountId: null,
  categoryId: "alimentacao",
  dueDate: "2026-04-05",
  effectiveDate: "2026-04-05",
  ...over,
});

const accounts = [{ id: "corrente", openingBalanceCents: 300_000, openingDate: "2026-01-01" }];
const movements: Movement[] = [
  mv({ amountCents: 20_000 }), // despesa comum de abril
  // parcela de cartão em Alimentação, fatura vence em 15/04 (compra feita em março)
  mv({ accountId: "card:roxo", amountCents: 12_000, dueDate: "2026-04-15", effectiveDate: "2026-04-15" }),
  // pagamento integral da fatura em 15/04
  mv({ kind: "CARD_PAYMENT", categoryId: null, amountCents: 12_000, dueDate: "2026-04-15", effectiveDate: "2026-04-15" }),
  // previsão de assinatura no cartão (fatura sugerida vence em 15/05)
  mv({ accountId: "card:roxo", categoryId: "assinaturas", status: "PENDING", effectiveDate: null, dueDate: "2026-05-15", amountCents: 5_590 }),
];

describe("visão de caixa", () => {
  it("compra no cartão não reduz a conta; o pagamento reduz uma única vez", () => {
    expect(accountBalances(accounts, movements).get("corrente")).toBe(300_000 - 20_000 - 12_000);
    const e = balanceEvolution(accounts, movements, "2026-04");
    expect(e.points.find((p) => p.date === "2026-04-14")!.balanceCents).toBe(280_000);
    expect(e.points.find((p) => p.date === "2026-04-15")!.balanceCents).toBe(268_000);
  });
});

describe("visão de gastos", () => {
  it("pagamento não é despesa; gasto do cartão entra pelo vencimento e é identificado", () => {
    expect(monthTotals(movements, "2026-04", new Set())).toMatchObject({
      expenseRealized: 32_000,
      expenseCard: 12_000,
      cardPayments: 12_000,
      result: -32_000,
    });
    expect(monthTotals(movements, "2026-05", new Set())).toMatchObject({ expensePending: 5_590, expenseCardPending: 5_590, expenseRealized: 0 });
  });

  it("categoria soma despesa comum + parcela, sem somar o pagamento", () => {
    const r = expensesByCategory(movements, "2026-04", new Map());
    expect(r.slices).toEqual([{ categoryId: "alimentacao", amountCents: 32_000, percent: 100 }]);
    expect(monthlySeries(movements, "2026-04", 1)[0].expenseCents).toBe(32_000);
  });

  it("orçamento: parcela é realizado, previsão é pendente, pagamento ignorado", () => {
    const limits = [{ categoryId: "alimentacao", limitCents: 50_000 }, { categoryId: "assinaturas", limitCents: 10_000 }];
    const april = budgetProgress(limits, movements, "2026-04", new Map());
    expect(april[0]).toMatchObject({ realizedCents: 32_000, pendingCents: 0 });
    const may = budgetProgress(limits, movements, "2026-05", new Map());
    expect(may[1]).toMatchObject({ realizedCents: 0, pendingCents: 5_590 });
  });
});
