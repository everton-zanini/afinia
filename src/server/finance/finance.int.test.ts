import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import type { HouseholdContext } from "@/server/households/context";
import { FIXTURE_EXPECTED } from "@/lib/finance/fixture";
import { monthTotals } from "@/lib/finance/rules";
import { transactionSchema } from "@/lib/validation/finance";
import { SUGGESTED_CATEGORIES } from "@/lib/category-style";
import { seedSuggestedCategories } from "@/server/households/setup";
import { accountsWithBalances, createAccount, deleteAccount, updateAccount } from "./accounts";
import { createCategory, deleteCategory, listCategories, setCategoryArchived, updateCategory } from "./categories";
import {
  createTransaction,
  deleteTransaction,
  duplicateDraft,
  getTransaction,
  listTransactions,
  markEffective,
  markPending,
  updateTransaction,
} from "./transactions";
import { copyPreviousMonth, monthBudget, setBudgetLimit } from "./budgets";
import { transactionsToCsv } from "./export";
import { resetDatabase } from "../../../test/db";
import { createHouseholdWith } from "../../../test/factories";
import { loadFixture } from "../../../test/finance-fixture";

let ctx: HouseholdContext;
let other: HouseholdContext;

beforeEach(async () => {
  await resetDatabase();
  ({ contexts: [ctx, other] } = await createHouseholdWith("Casal A"));
});

const tx = (over: Record<string, unknown>) =>
  transactionSchema.parse({
    idempotencyKey: randomUUID(),
    kind: "EXPENSE",
    description: "Teste",
    amount: "100,00",
    status: "EFFECTIVE",
    dueDate: "2026-03-10",
    effectiveDate: "2026-03-10",
    ...over,
  });

async function balances() {
  return Object.fromEntries((await accountsWithBalances(ctx)).map((a) => [a.name, a.balanceCents]));
}

describe("categorias", () => {
  it("casal novo recebe as sugestões e a semente é idempotente", async () => {
    const cats = await listCategories(ctx);
    expect(cats).toHaveLength(SUGGESTED_CATEGORIES.length);
    expect(await db.$transaction((t) => seedSuggestedCategories(t, ctx.householdId))).toBe(0);
    expect(await listCategories(ctx)).toHaveLength(SUGGESTED_CATEGORIES.length);
  });

  it("subcategoria herda o tipo, não aceita outro tipo nem dois níveis, e nomes são únicos", async () => {
    const alimentacao = (await listCategories(ctx)).find((c) => c.name === "Alimentação")!;
    const mercado = await createCategory(ctx, { name: "Mercado", kind: "EXPENSE", parentId: alimentacao.id, color: "#0e6b69", icon: "tag" });
    expect(mercado.parentId).toBe(alimentacao.id);
    await expect(createCategory(ctx, { name: "X", kind: "INCOME", parentId: alimentacao.id, color: "#0e6b69", icon: "tag" })).rejects.toThrow("mesmo tipo");
    await expect(createCategory(ctx, { name: "Y", kind: "EXPENSE", parentId: mercado.id, color: "#0e6b69", icon: "tag" })).rejects.toThrow("não podem ter subcategorias");
    await expect(createCategory(ctx, { name: "mercado", kind: "EXPENSE", parentId: alimentacao.id, color: "#0e6b69", icon: "tag" })).rejects.toThrow("Já existe");
    await expect(updateCategory(ctx, alimentacao.id, { name: "Comida", kind: "INCOME", parentId: null, color: "#0e6b69", icon: "tag" })).rejects.toThrow("tipo");
  });

  it("categoria usada não pode ser excluída; arquivar esconde e preserva o histórico", async () => {
    const acc = await createAccount(ctx, { name: "Conta", kind: "CHECKING", openingBalance: 0, openingDate: "2026-01-01" });
    const assinaturas = (await listCategories(ctx)).find((c) => c.name === "Assinaturas")!;
    const t = await createTransaction(ctx, tx({ categoryId: assinaturas.id, accountId: acc.id }));
    await expect(deleteCategory(ctx, assinaturas.id)).rejects.toThrow("Arquive");
    await setCategoryArchived(ctx, assinaturas.id, true);
    expect((await listCategories(ctx)).some((c) => c.id === assinaturas.id)).toBe(false);
    expect((await getTransaction(ctx, t.id)).category?.name).toBe("Assinaturas");
    await expect(createTransaction(ctx, tx({ categoryId: assinaturas.id, accountId: acc.id }))).rejects.toThrow("arquivada");

    const nova = await createCategory(ctx, { name: "Nunca usada", kind: "EXPENSE", parentId: null, color: "#0e6b69", icon: "tag" });
    await deleteCategory(ctx, nova.id);
    expect(await db.category.count({ where: { id: nova.id } })).toBe(0);
  });
});

describe("contas e saldos", () => {
  it("saldo inicial não é receita; data de abertura limita efetivações", async () => {
    const acc = await createAccount(ctx, { name: "Conta corrente", kind: "CHECKING", openingBalance: 100_000, openingDate: "2026-03-01" });
    const lazer = (await listCategories(ctx)).find((c) => c.name === "Lazer")!;
    expect(await balances()).toEqual({ "Conta corrente": 100_000 });

    await expect(
      createTransaction(ctx, tx({ categoryId: lazer.id, accountId: acc.id, dueDate: "2026-02-28", effectiveDate: "2026-02-28" })),
    ).rejects.toThrow("anterior à abertura");

    await createTransaction(ctx, tx({ categoryId: lazer.id, accountId: acc.id, effectiveDate: "2026-03-05", dueDate: "2026-03-05" }));
    await expect(
      updateAccount(ctx, acc.id, { name: "Conta corrente", kind: "CHECKING", openingBalance: 100_000, openingDate: "2026-03-10" }),
    ).rejects.toThrow("não pode ser posterior");
    await expect(deleteAccount(ctx, acc.id)).rejects.toThrow("Arquive");
  });

  it("pendência não altera saldo realizado, mas aparece na previsão", async () => {
    const acc = await createAccount(ctx, { name: "C", kind: "CHECKING", openingBalance: 10_000, openingDate: "2026-01-01" });
    const cats = await listCategories(ctx);
    const sal = cats.find((c) => c.name === "Salários")!;
    const lazer = cats.find((c) => c.name === "Lazer")!;
    await createTransaction(ctx, tx({ kind: "INCOME", categoryId: sal.id, accountId: acc.id, amount: "50,00" }));
    await createTransaction(ctx, tx({ categoryId: lazer.id, accountId: acc.id, amount: "30,00", status: "PENDING", effectiveDate: "" }));
    const [a] = await accountsWithBalances(ctx);
    expect(a.balanceCents).toBe(15_000);
    expect(a.projectedCents).toBe(12_000);
  });
});

describe("lançamentos", () => {
  let accA: string;
  let accB: string;
  let lazer: string;
  let salarios: string;

  beforeEach(async () => {
    accA = (await createAccount(ctx, { name: "Corrente", kind: "CHECKING", openingBalance: 100_000, openingDate: "2026-01-01" })).id;
    accB = (await createAccount(ctx, { name: "Reserva", kind: "RESERVE", openingBalance: 0, openingDate: "2026-01-01" })).id;
    const cats = await listCategories(ctx);
    lazer = cats.find((c) => c.name === "Lazer")!.id;
    salarios = cats.find((c) => c.name === "Salários")!.id;
  });

  it("recusa categoria de outro tipo e registra autoria da sessão", async () => {
    await expect(createTransaction(ctx, tx({ categoryId: salarios, accountId: accA }))).rejects.toThrow("não corresponde");
    const t = await createTransaction(ctx, tx({ categoryId: lazer, accountId: accA }));
    const got = await getTransaction(ctx, t.id);
    expect(got.createdBy.id).toBe(ctx.userId);
    expect(got.responsible).toBeNull();
  });

  it("responsável deve ser membro do casal e é distinto do autor", async () => {
    const t = await createTransaction(ctx, tx({ categoryId: lazer, accountId: accA, responsibleMemberId: other.memberId }));
    const got = await getTransaction(ctx, t.id);
    expect(got.createdBy.id).toBe(ctx.userId);
    expect(got.responsible?.memberId).toBe(other.memberId);
    await expect(createTransaction(ctx, tx({ categoryId: lazer, accountId: accA, responsibleMemberId: "membro-inexistente" }))).rejects.toThrow("não encontrado");
  });

  it("idempotência: mesma chave não duplica", async () => {
    const input = tx({ categoryId: lazer, accountId: accA });
    const [a, b] = await Promise.all([createTransaction(ctx, input), createTransaction(ctx, input)]);
    const c = await createTransaction(ctx, input);
    expect(new Set([a.id, b.id, c.id]).size).toBe(1);
    expect(await db.transaction.count()).toBe(1);
  });

  it("transferência altera as duas contas, não entra nos totais e exclusão restaura saldos", async () => {
    const t = await createTransaction(ctx, tx({ kind: "TRANSFER", accountId: accA, toAccountId: accB, amount: "500,00" }));
    expect(await balances()).toEqual({ Corrente: 50_000, Reserva: 50_000 });
    const all = await listTransactions(ctx, {});
    expect(monthTotals(all.map((x) => ({ ...x, accountId: x.account.id, toAccountId: x.toAccount?.id ?? null, categoryId: null })), "2026-03")).toMatchObject({ incomeRealized: 0, expenseRealized: 0 });
    await deleteTransaction(ctx, t.id);
    expect(await balances()).toEqual({ Corrente: 100_000, Reserva: 0 });
    expect(() => tx({ kind: "TRANSFER", accountId: accA, toAccountId: accA })).toThrow("Escolha contas diferentes");
  });

  it("edição atualiza saldos; marcar pago/pendente; duplicar gera rascunho pendente de hoje", async () => {
    const t = await createTransaction(ctx, tx({ categoryId: lazer, accountId: accA, amount: "100,00" }));
    expect((await balances()).Corrente).toBe(90_000);
    await updateTransaction(ctx, t.id, tx({ categoryId: lazer, accountId: accA, amount: "150,00" }));
    expect((await balances()).Corrente).toBe(85_000);

    await markPending(ctx, t.id);
    expect((await balances()).Corrente).toBe(100_000);
    await markEffective(ctx, t.id, "2026-04-09");
    const got = await getTransaction(ctx, t.id);
    expect(got.status).toBe("EFFECTIVE");
    expect(got.effectiveDate).toBe("2026-04-09");
    expect((await balances()).Corrente).toBe(85_000);

    const draft = await duplicateDraft(ctx, t.id);
    expect(draft).toMatchObject({ status: "PENDING", amountCents: 15_000, categoryId: lazer, accountId: accA });
  });

  it("filtros por período (data de referência), busca, categoria com subcategorias, conta e situação", async () => {
    const mercado = (await createCategory(ctx, { name: "Mercado", kind: "EXPENSE", parentId: (await listCategories(ctx)).find((c) => c.name === "Alimentação")!.id, color: "#0e6b69", icon: "tag" })).id;
    const alimentacao = (await listCategories(ctx)).find((c) => c.name === "Alimentação")!.id;
    await createTransaction(ctx, tx({ description: "Feira", categoryId: mercado, accountId: accA, dueDate: "2026-03-31", effectiveDate: "2026-04-02" }));
    await createTransaction(ctx, tx({ description: "Pizza", categoryId: alimentacao, accountId: accA, dueDate: "2026-03-15", effectiveDate: "2026-03-15" }));
    await createTransaction(ctx, tx({ description: "Show", categoryId: lazer, accountId: accA, status: "PENDING", effectiveDate: "", dueDate: "2026-03-20" }));
    await createTransaction(ctx, tx({ kind: "TRANSFER", description: "Guardar", accountId: accA, toAccountId: accB, dueDate: "2026-03-05", effectiveDate: "2026-03-05" }));

    const march = await listTransactions(ctx, { from: "2026-03-01", to: "2026-03-31" });
    expect(march.map((t) => t.description).sort()).toEqual(["Guardar", "Pizza", "Show"]);
    expect((await listTransactions(ctx, { categoryId: alimentacao })).map((t) => t.description).sort()).toEqual(["Feira", "Pizza"]);
    expect((await listTransactions(ctx, { q: "piz" })).map((t) => t.description)).toEqual(["Pizza"]);
    expect((await listTransactions(ctx, { accountId: accB })).map((t) => t.description)).toEqual(["Guardar"]);
    expect((await listTransactions(ctx, { status: "PENDING" })).map((t) => t.description)).toEqual(["Show"]);
  });

  it("CSV neutraliza fórmulas e usa formato brasileiro", async () => {
    await createTransaction(ctx, tx({ description: "=HYPERLINK(\"x\")", categoryId: lazer, accountId: accA, amount: "1.234,56" }));
    const csv = transactionsToCsv(await listTransactions(ctx, {}));
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
    expect(csv).toContain(";1234,56;");
    expect(csv).toContain("10/03/2026");
  });
});

describe("orçamento", () => {
  it("limite só em categoria principal de despesa; cópia do mês anterior não sobrescreve", async () => {
    const cats = await listCategories(ctx);
    const moradia = cats.find((c) => c.name === "Moradia")!.id;
    const lazerId = cats.find((c) => c.name === "Lazer")!.id;
    const salarios = cats.find((c) => c.name === "Salários")!.id;
    const sub = (await createCategory(ctx, { name: "Condomínio", kind: "EXPENSE", parentId: moradia, color: "#0e6b69", icon: "tag" })).id;

    await expect(setBudgetLimit(ctx, "2026-03", sub, 1000)).rejects.toThrow("principais");
    await expect(setBudgetLimit(ctx, "2026-03", salarios, 1000)).rejects.toThrow("principais");

    await setBudgetLimit(ctx, "2026-03", moradia, 200_000);
    await setBudgetLimit(ctx, "2026-03", lazerId, 10_000);
    await setBudgetLimit(ctx, "2026-04", lazerId, 30_000);
    expect(await copyPreviousMonth(ctx, "2026-04")).toBe(1);
    const april = await monthBudget(ctx, "2026-04");
    expect(Object.fromEntries(april.rows.map((r) => [r.name, r.limitCents]))).toEqual({ Lazer: 30_000, Moradia: 200_000 });
  });
});

describe("reconciliação com a fixture conhecida", () => {
  it("saldos, totais e orçamento persistidos batem com os valores calculados à mão", async () => {
    const { accounts } = await loadFixture(ctx);
    const withBalances = await accountsWithBalances(ctx);
    const byId = Object.fromEntries(withBalances.map((a) => [a.id, a.balanceCents]));
    expect(byId[accounts.corrente]).toBe(FIXTURE_EXPECTED.balances.corrente);
    expect(byId[accounts.reserva]).toBe(FIXTURE_EXPECTED.balances.reserva);
    expect(byId[accounts.carteira]).toBe(FIXTURE_EXPECTED.balances.carteira);
    expect(withBalances.reduce((s, a) => s + a.balanceCents, 0)).toBe(FIXTURE_EXPECTED.totalBalance);

    const budget = await monthBudget(ctx, "2026-03");
    const rows = Object.fromEntries(budget.rows.map((r) => [r.name, r]));
    expect(rows["Alimentação"]).toMatchObject(FIXTURE_EXPECTED.budgetMarch.alimentacao);
    expect(rows["Moradia"]).toMatchObject(FIXTURE_EXPECTED.budgetMarch.moradia);
    expect(rows["Lazer"]).toMatchObject(FIXTURE_EXPECTED.budgetMarch.lazer);
  });
});
