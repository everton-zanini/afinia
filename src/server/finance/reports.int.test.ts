import { beforeEach, describe, expect, it } from "vitest";
import type { HouseholdContext } from "@/server/households/context";
import { FIXTURE_EXPECTED } from "@/lib/finance/fixture";
import { dashboard, reports } from "./reports";
import { resetDatabase } from "../../../test/db";
import { createHouseholdWith } from "../../../test/factories";
import { loadFixture } from "../../../test/finance-fixture";

let a: HouseholdContext;
let b: HouseholdContext;
let aData: Awaited<ReturnType<typeof loadFixture>>;

beforeEach(async () => {
  await resetDatabase();
  a = (await createHouseholdWith("Casal A")).contexts[0];
  b = (await createHouseholdWith("Casal B")).contexts[0];
  aData = await loadFixture(a);
  await loadFixture(b);
});

describe("relatórios reconciliados com a fixture persistida", () => {
  it("dashboard de março", async () => {
    const d = await dashboard(a, "2026-03", "2026-03-26");
    expect(d.totalBalanceCents).toBe(FIXTURE_EXPECTED.totalBalance);
    expect(d.current).toMatchObject({ ...FIXTURE_EXPECTED.march, incomeCash: 500_000, incomeBenefit: 0 });
    expect(d.generalBalanceCents).toBe(FIXTURE_EXPECTED.totalBalance);
    expect(d.benefitBalanceCents).toBe(0);
    expect(d.comparison.income).toMatchObject({ deltaCents: 0, percent: 0 });
    expect(d.comparison.expense).toMatchObject({ deltaCents: 238_285 - 30_000 });
    expect(d.overdue.map((t) => t.description)).toEqual(["Freela"]);
    expect(d.next.map((t) => t.description)).toEqual(["Cinema"]);
    expect(d.insights[0]).toBe("Moradia representa 76% das despesas realizadas do mês.");
  });

  it("relatórios de março: categorias, série e saldo", async () => {
    const r = await reports(a, { month: "2026-03", today: "2026-09-30" });
    expect(r.byCategory.totalCents).toBe(238_285);
    expect(r.byCategory.slices.map((s) => [s.name, s.amountCents, s.percent])).toEqual([
      ["Moradia", 180_000, 76],
      ["Alimentação", 58_285, 24],
    ]);
    expect(r.series.at(-1)).toEqual({ month: "2026-03", incomeCents: 500_000, incomeBenefitCents: 0, expenseCents: 238_285 });
    expect(r.evolution.openingCents).toBe(1_070_000);
    expect(r.evolution.closingCents).toBe(1_331_715);
  });

  it("filtro por conta", async () => {
    const r = await reports(a, { month: "2026-03", accountId: aData.accounts.carteira, today: "2026-09-30" });
    expect(r.byCategory.slices.map((s) => [s.name, s.amountCents])).toEqual([["Alimentação", 1_235]]);
    expect(r.evolution.closingCents).toBe(FIXTURE_EXPECTED.balances.carteira);
  });

  it("conta de outro casal no filtro é ignorada (não vaza nem soma dados)", async () => {
    const onlyA = await reports(a, { month: "2026-03", today: "2026-09-30" });
    const forged = await reports(a, { month: "2026-03", accountId: "conta-de-outro-casal", today: "2026-09-30" });
    expect(forged).toEqual(onlyA);
    // O casal B tem a mesma fixture: se vazasse, os totais dobrariam.
    expect(onlyA.byCategory.totalCents).toBe(238_285);
    expect((await dashboard(b, "2026-03", "2026-03-26")).totalBalanceCents).toBe(FIXTURE_EXPECTED.totalBalance);
  });
});
