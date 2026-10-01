import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import type { HouseholdContext } from "@/server/households/context";
import { accountSchema, transactionSchema } from "@/lib/validation/finance";
import { accountsWithBalances, createAccount, updateAccount } from "./accounts";
import { listCategories } from "./categories";
import { createTransaction } from "./transactions";
import { createSeries, ensureGenerated } from "./recurrences";
import { dashboard, reports } from "./reports";
import { resetDatabase } from "../../../test/db";
import { createHouseholdWith } from "../../../test/factories";

let ctx: HouseholdContext;
let corrente: string;
let dinheiro: string;
let va: string;
let cat: Record<string, string>;

beforeEach(async () => {
  await resetDatabase();
  ctx = (await createHouseholdWith("Casal A")).contexts[0];
  corrente = (await createAccount(ctx, { name: "Conta corrente", kind: "CHECKING", openingBalance: 200_000, openingDate: "2026-01-01" })).id;
  dinheiro = (await createAccount(ctx, { name: "Carteira", kind: "CASH", openingBalance: 15_000, openingDate: "2026-01-01" })).id;
  va = (await createAccount(ctx, { name: "Meu vale-alimentação", kind: "BENEFIT", benefitPurpose: "FOOD", openingBalance: 0, openingDate: "2026-01-01" })).id;
  cat = Object.fromEntries((await listCategories(ctx)).map((c) => [c.name, c.id]));
});

const tx = (over: Record<string, unknown>) =>
  transactionSchema.parse({
    idempotencyKey: randomUUID(),
    kind: "EXPENSE",
    description: "Teste",
    amount: "10,00",
    categoryId: cat["Alimentação"],
    accountId: corrente,
    status: "EFFECTIVE",
    dueDate: "2026-04-05",
    effectiveDate: "2026-04-05",
    ...over,
  });

describe("cadastro de benefício", () => {
  it("valida finalidade e saldo não negativo; demais tipos ficam sem finalidade", () => {
    const base = { name: "Vale-refeição da esposa", openingBalance: "320,00", openingDate: "2026-01-01" };
    expect(accountSchema.safeParse({ ...base, kind: "BENEFIT" }).error?.issues[0].message).toBe("Escolha a finalidade do benefício");
    expect(accountSchema.safeParse({ ...base, kind: "BENEFIT", benefitPurpose: "MEAL", openingBalance: "-10,00" }).error?.issues[0].message).toBe(
      "O saldo de um benefício não pode ser negativo",
    );
    expect(accountSchema.parse({ ...base, kind: "CHECKING", benefitPurpose: "MEAL" }).benefitPurpose).toBeNull();
    expect(accountSchema.parse({ ...base, kind: "BENEFIT", benefitPurpose: "MEAL" })).toMatchObject({ benefitPurpose: "MEAL", openingBalance: 32_000 });
  });

  it("o banco recusa benefício sem finalidade ou com saldo negativo", async () => {
    await expect(
      db.financialAccount.create({ data: { householdId: ctx.householdId, name: "X", kind: "BENEFIT", openingBalanceCents: 0, openingDate: new Date("2026-01-01T00:00:00Z") } }),
    ).rejects.toThrow();
    await expect(
      db.financialAccount.create({ data: { householdId: ctx.householdId, name: "X", kind: "BENEFIT", benefitPurpose: "FOOD", openingBalanceCents: -1, openingDate: new Date("2026-01-01T00:00:00Z") } }),
    ).rejects.toThrow();
  });

  it("contas existentes continuam válidas, sem finalidade", async () => {
    const accounts = await accountsWithBalances(ctx);
    expect(accounts.filter((a) => a.kind !== "BENEFIT").every((a) => a.benefitPurpose === null)).toBe(true);
    await updateAccount(ctx, corrente, { name: "Conta corrente", kind: "CHECKING", openingBalance: 200_000, openingDate: "2026-01-01" });
  });
});

describe("transferências", () => {
  it("serviço e banco recusam transferência com benefício; despesa de qualquer categoria é aceita", async () => {
    await expect(createTransaction(ctx, tx({ kind: "TRANSFER", categoryId: "", accountId: va, toAccountId: corrente }))).rejects.toThrow(
      "Contas de benefício não permitem transferência ou saque",
    );
    await expect(createTransaction(ctx, tx({ kind: "TRANSFER", categoryId: "", accountId: corrente, toAccountId: va }))).rejects.toThrow("benefício");
    await expect(
      db.transaction.create({
        data: {
          householdId: ctx.householdId, kind: "TRANSFER", status: "PENDING", description: "bypass", amountCents: 100,
          accountId: corrente, toAccountId: va, dueDate: new Date("2026-04-05T00:00:00Z"), createdById: ctx.userId, idempotencyKey: randomUUID(),
        },
      }),
    ).rejects.toThrow(/benefit_transfer/);
    // Categoria independente da conta: combustível pago com o vale-alimentação.
    await createTransaction(ctx, tx({ accountId: va, categoryId: cat.Transporte, status: "PENDING", effectiveDate: "" }));
  });

  it("conta com transferências não vira benefício", async () => {
    await createTransaction(ctx, tx({ kind: "TRANSFER", categoryId: "", accountId: corrente, toAccountId: dinheiro }));
    await expect(
      updateAccount(ctx, dinheiro, { name: "Carteira", kind: "BENEFIT", benefitPurpose: "OTHER", openingBalance: 15_000, openingDate: "2026-01-01" }),
    ).rejects.toThrow("Contas com transferências não podem virar benefício");
  });
});

describe("saldos e indicadores", () => {
  it("disponível para uso geral exclui benefícios; créditos do empregador aparecem separados", async () => {
    await createTransaction(ctx, tx({ kind: "INCOME", categoryId: cat["Salários"], amount: "5.000,00", accountId: corrente }));
    await createTransaction(ctx, tx({ kind: "INCOME", categoryId: cat["Outras receitas"], amount: "800,00", accountId: va, description: "Crédito VA" }));
    await createTransaction(ctx, tx({ amount: "215,40", accountId: va, description: "Mercado no VA" }));

    const balances = Object.fromEntries((await accountsWithBalances(ctx)).map((a) => [a.name, a.balanceCents]));
    expect(balances["Meu vale-alimentação"]).toBe(58_460);

    const d = await dashboard(ctx, "2026-04", "2026-04-10");
    expect(d.generalBalanceCents).toBe(200_000 + 15_000 + 500_000);
    expect(d.benefitBalanceCents).toBe(58_460);
    expect(d.totalBalanceCents).toBe(d.generalBalanceCents + d.benefitBalanceCents);
    expect(d.benefits).toEqual([{ id: va, cents: 58_460, name: "Meu vale-alimentação", purpose: "FOOD" }]);
    expect(d.current).toMatchObject({ incomeRealized: 580_000, incomeCash: 500_000, incomeBenefit: 80_000, expenseRealized: 21_540 });

    const r = await reports(ctx, { month: "2026-04", today: "2026-04-10" });
    expect(r.series.at(-1)).toEqual({ month: "2026-04", incomeCents: 580_000, incomeBenefitCents: 80_000, expenseCents: 21_540 });
  });
});

describe("recorrências com benefício", () => {
  it("receita recorrente no benefício é aceita; transferência recorrente com benefício é recusada", async () => {
    const rec = { frequency: "MONTHLY" as const, endMode: "NONE" as const, occurrenceCount: null, untilDate: null };
    const { id } = await createSeries(ctx, tx({ kind: "INCOME", categoryId: cat["Outras receitas"], amount: "800,00", accountId: va, status: "PENDING", effectiveDate: "", dueDate: "2026-05-01" }), rec, "2026-04-10");
    await ensureGenerated(ctx, "2026-04-10");
    // 01/05/2026 a 01/04/2027 (horizonte 10/04/2027): 12 ocorrências.
    expect(await db.transaction.count({ where: { seriesId: id, accountId: va } })).toBe(12);
    await expect(
      createSeries(ctx, tx({ kind: "TRANSFER", categoryId: "", accountId: corrente, toAccountId: va, status: "PENDING", effectiveDate: "" }), rec, "2026-04-10"),
    ).rejects.toThrow("benefício");
  });
});
