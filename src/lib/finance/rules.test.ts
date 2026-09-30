import { describe, expect, it } from "vitest";
import { FIXTURE_BUDGETS_2026_03, FIXTURE_EXPECTED, fixtureAsPure } from "./fixture";
import { accountBalances, budgetAlert, budgetProgress, monthTotals, referenceDate, totalBalance } from "./rules";
import type { Movement } from "./types";

const { accounts, movements, parentOf } = fixtureAsPure();

describe("saldos (fixture)", () => {
  it("saldo realizado por conta e total", () => {
    const b = accountBalances(accounts, movements);
    expect(Object.fromEntries(b)).toEqual(FIXTURE_EXPECTED.balances);
    expect(totalBalance(accounts, movements)).toBe(FIXTURE_EXPECTED.totalBalance);
  });

  it("saldo em uma data considera abertura e efetivações até ela", () => {
    expect(totalBalance(accounts, movements, "2026-02-28")).toBe(FIXTURE_EXPECTED.totalBalanceAt_2026_02_28);
  });

  it("pendências não alteram o saldo", () => {
    const pending: Movement = {
      kind: "EXPENSE", status: "PENDING", amountCents: 99_999, accountId: "corrente",
      toAccountId: null, categoryId: "lazer", dueDate: "2026-03-01", effectiveDate: null,
    };
    expect(totalBalance(accounts, [...movements, pending])).toBe(FIXTURE_EXPECTED.totalBalance);
  });
});

describe("totais do mês (fixture)", () => {
  it.each([
    ["2026-02", FIXTURE_EXPECTED.february],
    ["2026-03", FIXTURE_EXPECTED.march],
    ["2026-04", FIXTURE_EXPECTED.april],
  ])("%s", (month, expected) => {
    expect(monthTotals(movements, month)).toEqual(expected);
  });

  it("transferências não entram em receitas ou despesas e saldo inicial não é receita", () => {
    const onlyTransfers = movements.filter((m) => m.kind === "TRANSFER");
    expect(monthTotals(onlyTransfers, "2026-03")).toEqual({
      incomeRealized: 0, expenseRealized: 0, result: 0, incomePending: 0, expensePending: 0,
    });
    expect(monthTotals([], "2026-01").incomeRealized).toBe(0);
  });

  it("realizado pela data de efetivação, pendente pela data prevista", () => {
    expect(referenceDate({ status: "EFFECTIVE", dueDate: "2026-03-31", effectiveDate: "2026-04-02" })).toBe("2026-04-02");
    expect(referenceDate({ status: "PENDING", dueDate: "2026-03-31", effectiveDate: null })).toBe("2026-03-31");
  });
});

describe("orçamento (fixture)", () => {
  it("agrega subcategorias na principal sem dupla contagem e calcula alertas", () => {
    const rows = budgetProgress(
      FIXTURE_BUDGETS_2026_03.map((b) => ({ categoryId: b.category, limitCents: b.limitCents })),
      movements,
      "2026-03",
      parentOf,
    );
    const byId = Object.fromEntries(
      rows.map((r) => [r.categoryId, { realizedCents: r.realizedCents, pendingCents: r.pendingCents, availableCents: r.availableCents, percent: r.percent, alert: r.alert }]),
    );
    expect(byId).toEqual(FIXTURE_EXPECTED.budgetMarch);
  });

  it("limiares de alerta", () => {
    expect(budgetAlert(79_99, 100_00)).toBe("ok");
    expect(budgetAlert(80_00, 100_00)).toBe("near");
    expect(budgetAlert(100_00, 100_00)).toBe("near");
    expect(budgetAlert(100_01, 100_00)).toBe("over");
  });
});
