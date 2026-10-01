import { describe, expect, it } from "vitest";
import { fixtureAsPure, FIXTURE_EXPECTED } from "./fixture";
import { balanceEvolution, buildInsights, compare, expensesByCategory, monthlySeries, upcoming } from "./reports";
import { budgetProgress } from "./rules";

const { accounts, movements, parentOf } = fixtureAsPure();

describe("despesas por categoria (fixture)", () => {
  it("março agrega subcategorias e ignora transferências e pendências", () => {
    const r = expensesByCategory(movements, "2026-03", parentOf);
    expect(r.totalCents).toBe(FIXTURE_EXPECTED.march.expenseRealized);
    expect(r.slices).toEqual([
      { categoryId: "moradia", amountCents: 180_000, percent: 76 },
      { categoryId: "alimentacao", amountCents: 58_285, percent: 24 },
    ]);
  });

  it("filtro por conta (carteira)", () => {
    const onlyCarteira = movements.filter((m) => m.accountId === "carteira" || m.toAccountId === "carteira");
    expect(expensesByCategory(onlyCarteira, "2026-03", parentOf).slices).toEqual([
      { categoryId: "alimentacao", amountCents: 1_235, percent: 100 },
    ]);
  });

  it("mês sem despesas", () => {
    expect(expensesByCategory(movements, "2026-05", parentOf)).toEqual({ totalCents: 0, slices: [] });
  });
});

describe("série de seis meses", () => {
  it("inclui meses zerados e usa a data de efetivação", () => {
    const s = monthlySeries(movements, "2026-04");
    expect(s.map((p) => p.month)).toEqual(["2025-11", "2025-12", "2026-01", "2026-02", "2026-03", "2026-04"]);
    expect(s[3]).toEqual({ month: "2026-02", incomeCents: 500_000, incomeBenefitCents: 0, expenseCents: 30_000 });
    expect(s[4]).toEqual({ month: "2026-03", incomeCents: 500_000, incomeBenefitCents: 0, expenseCents: 238_285 });
    expect(s[5]).toEqual({ month: "2026-04", incomeCents: 0, incomeBenefitCents: 0, expenseCents: 21_030 });
    expect(s[0]).toEqual({ month: "2025-11", incomeCents: 0, incomeBenefitCents: 0, expenseCents: 0 });
  });
});

describe("evolução do saldo", () => {
  it("parte do saldo ao fim do mês anterior e termina no saldo de 31/03", () => {
    const e = balanceEvolution(accounts, movements, "2026-03");
    expect(e.openingCents).toBe(1_070_000);
    expect(e.points).toHaveLength(31);
    expect(e.closingCents).toBe(1_331_715);
    expect(e.points.find((p) => p.date === "2026-03-05")?.balanceCents).toBe(1_070_000 - 1_235 + 500_000);
  });

  it("abril fecha no saldo total da fixture", () => {
    expect(balanceEvolution(accounts, movements, "2026-04").closingCents).toBe(FIXTURE_EXPECTED.totalBalance);
  });

  it("conta aberta no mês entra com o saldo de abertura na data e transferências mudam só as contas envolvidas", () => {
    const carteira = accounts.filter((a) => a.id === "carteira").map((a) => ({ ...a, openingBalanceCents: 5_000 }));
    const e = balanceEvolution(carteira, movements, "2026-03");
    expect(e.openingCents).toBe(0);
    expect(e.points[0]).toEqual({ date: "2026-03-01", balanceCents: 5_000 });
    expect(e.points[1].balanceCents).toBe(15_000);
    expect(e.closingCents).toBe(15_000 - 1_235);
  });

  it("limita pontos até a data informada", () => {
    expect(balanceEvolution(accounts, movements, "2026-03", "2026-03-10").points).toHaveLength(10);
  });
});

describe("comparação e vencimentos", () => {
  it("sem base não divide por zero", () => {
    expect(compare(100_000, 0)).toEqual({ currentCents: 100_000, previousCents: 0, deltaCents: 100_000, percent: null });
    expect(compare(238_285, 30_000).percent).toBe(694);
    expect(compare(0, 0).percent).toBeNull();
    expect(compare(-500, 1000).percent).toBe(-150);
  });

  it("separa atrasados e próximos 7 dias", () => {
    const p = [
      { dueDate: "2026-03-20", amountCents: 1, kind: "EXPENSE" as const },
      { dueDate: "2026-03-25", amountCents: 2, kind: "EXPENSE" as const },
      { dueDate: "2026-04-10", amountCents: 3, kind: "EXPENSE" as const },
    ];
    const u = upcoming(p, "2026-03-22");
    expect(u.overdue.map((x) => x.amountCents)).toEqual([1]);
    expect(u.next.map((x) => x.amountCents)).toEqual([2]);
  });
});

describe("insights", () => {
  it("frases determinísticas a partir da fixture", () => {
    const byCategory = expensesByCategory(movements, "2026-03", parentOf);
    const rows = budgetProgress([{ categoryId: "alimentacao", limitCents: 50_000 }], movements, "2026-03", parentOf).map((r) => ({ ...r, name: "Alimentação" }));
    const insights = buildInsights({
      categoryNames: new Map([["moradia", "Moradia"], ["alimentacao", "Alimentação"]]),
      byCategory,
      expense: compare(238_285, 30_000),
      budgetRows: rows,
      overdue: [{ dueDate: "2026-03-28", amountCents: 8_000, kind: "EXPENSE" }],
    });
    expect(insights).toEqual([
      "Moradia representa 76% das despesas realizadas do mês.",
      "As despesas realizadas estão 694% acima das do mês anterior.",
      "Alimentação passou do limite em R$ 82,85.",
      "Há 1 despesa atrasada de R$ 80,00.",
    ]);
  });

  it("sem dados, sem frases", () => {
    expect(
      buildInsights({ categoryNames: new Map(), byCategory: { totalCents: 0, slices: [] }, expense: compare(0, 0), budgetRows: [], overdue: [] }),
    ).toEqual([]);
  });
});
