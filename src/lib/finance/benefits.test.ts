import { describe, expect, it } from "vitest";
import { FIXTURE_EXPECTED, fixtureAsPure } from "./fixture";
import { monthlySeries } from "./reports";
import { accountBalances, monthTotals, splitBalances } from "./rules";
import type { Movement } from "./types";

const mv = (over: Partial<Movement>): Movement => ({
  kind: "EXPENSE",
  status: "EFFECTIVE",
  amountCents: 0,
  accountId: "corrente",
  toAccountId: null,
  categoryId: "x",
  dueDate: "2026-04-05",
  effectiveDate: "2026-04-05",
  ...over,
});

describe("saldos com benefícios", () => {
  it("composição: uso geral × benefícios × consolidado", () => {
    const accounts = [
      { id: "corrente", kind: "CHECKING", openingBalanceCents: 200_000, openingDate: "2026-01-01" },
      { id: "dinheiro", kind: "CASH", openingBalanceCents: 15_000, openingDate: "2026-01-01" },
      { id: "va", kind: "BENEFIT", openingBalanceCents: 60_000, openingDate: "2026-01-01" },
      { id: "antiga", kind: "BENEFIT", openingBalanceCents: 99_999, openingDate: "2026-01-01", archived: true },
    ];
    const split = splitBalances(accounts, accountBalances(accounts, []));
    expect(split).toEqual({ generalCents: 215_000, benefitCents: 60_000, totalCents: 275_000, benefits: [{ id: "va", cents: 60_000 }] });
  });

  it("saldo do benefício: crédito − despesa a partir de abertura zero", () => {
    const accounts = [{ id: "va", openingBalanceCents: 0, openingDate: "2026-04-01" }];
    const movements = [
      mv({ kind: "INCOME", accountId: "va", amountCents: 80_000 }),
      mv({ kind: "EXPENSE", accountId: "va", amountCents: 21_540 }),
    ];
    expect(accountBalances(accounts, movements).get("va")).toBe(58_460);
  });
});

describe("créditos de benefício", () => {
  const movements = [
    mv({ kind: "INCOME", accountId: "corrente", amountCents: 500_000 }),
    mv({ kind: "INCOME", accountId: "va", amountCents: 80_000 }),
    mv({ kind: "INCOME", accountId: "va", amountCents: 10_000, status: "PENDING", effectiveDate: null, dueDate: "2026-04-20" }),
    mv({ kind: "EXPENSE", accountId: "va", amountCents: 21_540 }),
  ];

  it("crédito do empregador aparece separado e entra no total e no resultado", () => {
    expect(monthTotals(movements, "2026-04", new Set(["va"]))).toEqual({
      incomeRealized: 580_000,
      expenseRealized: 21_540,
      result: 558_460,
      incomePending: 10_000,
      expensePending: 0,
      incomeCash: 500_000,
      incomeBenefit: 80_000,
      incomeCashPending: 0,
      incomeBenefitPending: 10_000,
      expenseCard: 0,
      expenseCardPending: 0,
      cardPayments: 0,
    });
  });

  it("série mensal separa créditos de benefício", () => {
    const [point] = monthlySeries(movements, "2026-04", 1, new Set(["va"]));
    expect(point).toEqual({ month: "2026-04", incomeCents: 580_000, incomeBenefitCents: 80_000, expenseCents: 21_540 });
  });

  it("sem benefícios, a fixture conhecida continua igual (compatibilidade)", () => {
    const { movements: fx } = fixtureAsPure();
    const t = monthTotals(fx, "2026-03", new Set());
    expect(t).toMatchObject({ ...FIXTURE_EXPECTED.march, incomeCash: FIXTURE_EXPECTED.march.incomeRealized, incomeBenefit: 0 });
    expect(monthTotals(fx, "2026-03")).toEqual(FIXTURE_EXPECTED.march);
  });
});
