import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import type { HouseholdContext } from "@/server/households/context";
import { transactionSchema } from "@/lib/validation/finance";
import {
  accountsWithBalances,
  deleteAccount,
  getAccount,
  setAccountArchived,
  updateAccount,
} from "./accounts";
import { createCategory, deleteCategory, getCategory, listCategories, setCategoryArchived, updateCategory } from "./categories";
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

// Dois casais com a mesma fixture: nenhuma operação de A pode ler, alterar, excluir,
// agregar ou exportar dados de B, nem referenciar registros de B.

let a: HouseholdContext;
let b: HouseholdContext;
let bData: Awaited<ReturnType<typeof loadFixture>>;
let aData: Awaited<ReturnType<typeof loadFixture>>;

beforeEach(async () => {
  await resetDatabase();
  a = (await createHouseholdWith("Casal A")).contexts[0];
  b = (await createHouseholdWith("Casal B")).contexts[0];
  aData = await loadFixture(a);
  bData = await loadFixture(b);
});

const NOT_FOUND = "Registro não encontrado";

describe("isolamento entre casais", () => {
  it("leituras por id de outro casal respondem como inexistente", async () => {
    await expect(getTransaction(a, bData.transactions[0])).rejects.toThrow(NOT_FOUND);
    await expect(getTransaction(a, "id-que-nao-existe")).rejects.toThrow(NOT_FOUND);
    await expect(getAccount(a, bData.accounts.corrente)).rejects.toThrow(NOT_FOUND);
    await expect(getCategory(a, bData.categories.lazer)).rejects.toThrow(NOT_FOUND);
    await expect(duplicateDraft(a, bData.transactions[0])).rejects.toThrow(NOT_FOUND);
  });

  it("alterações e exclusões em registros de outro casal são recusadas sem efeito", async () => {
    const bTx = bData.transactions[5];
    const before = await db.transaction.findUniqueOrThrow({ where: { id: bTx } });
    const input = transactionSchema.parse({
      idempotencyKey: randomUUID(),
      kind: "EXPENSE",
      description: "Invasão",
      amount: "1,00",
      categoryId: aData.categories.lazer,
      accountId: aData.accounts.corrente,
      status: "PENDING",
      dueDate: "2026-03-01",
    });
    await expect(updateTransaction(a, bTx, input)).rejects.toThrow(NOT_FOUND);
    await expect(deleteTransaction(a, bTx)).rejects.toThrow(NOT_FOUND);
    await expect(markPending(a, bTx)).rejects.toThrow(NOT_FOUND);
    await expect(markEffective(a, bTx)).rejects.toThrow(NOT_FOUND);
    expect(await db.transaction.findUniqueOrThrow({ where: { id: bTx } })).toEqual(before);

    const cat = { name: "X", kind: "EXPENSE" as const, parentId: null, color: "#0e6b69" as const, icon: "tag" as const };
    await expect(updateCategory(a, bData.categories.lazer, cat)).rejects.toThrow(NOT_FOUND);
    await expect(setCategoryArchived(a, bData.categories.lazer, true)).rejects.toThrow(NOT_FOUND);
    await expect(deleteCategory(a, bData.categories.lazer)).rejects.toThrow(NOT_FOUND);

    const acc = { name: "X", kind: "CASH" as const, openingBalance: 0, openingDate: "2026-01-01" };
    await expect(updateAccount(a, bData.accounts.corrente, acc)).rejects.toThrow(NOT_FOUND);
    await expect(setAccountArchived(a, bData.accounts.corrente, true)).rejects.toThrow(NOT_FOUND);
    await expect(deleteAccount(a, bData.accounts.carteira)).rejects.toThrow(NOT_FOUND);

    await expect(setBudgetLimit(a, "2026-03", bData.categories.lazer, 100)).rejects.toThrow(NOT_FOUND);
    expect(await db.category.findUniqueOrThrow({ where: { id: bData.categories.lazer } })).toMatchObject({ archivedAt: null });
  });

  it("referências a conta, categoria, categoria-pai ou membro de outro casal são recusadas", async () => {
    const base = {
      idempotencyKey: randomUUID(),
      kind: "EXPENSE",
      description: "Cruzado",
      amount: "10,00",
      status: "PENDING",
      dueDate: "2026-03-01",
    };
    const withBAccount = transactionSchema.parse({ ...base, categoryId: aData.categories.lazer, accountId: bData.accounts.corrente });
    const withBCategory = transactionSchema.parse({ ...base, categoryId: bData.categories.lazer, accountId: aData.accounts.corrente });
    const transferToB = transactionSchema.parse({ ...base, kind: "TRANSFER", accountId: aData.accounts.corrente, toAccountId: bData.accounts.reserva });
    const withBMember = transactionSchema.parse({ ...base, categoryId: aData.categories.lazer, accountId: aData.accounts.corrente, responsibleMemberId: b.memberId });
    for (const input of [withBAccount, withBCategory, transferToB, withBMember]) {
      await expect(createTransaction(a, input)).rejects.toThrow(NOT_FOUND);
    }
    await expect(
      createCategory(a, { name: "Sub", kind: "EXPENSE", parentId: bData.categories.alimentacao, color: "#0e6b69", icon: "tag" }),
    ).rejects.toThrow(NOT_FOUND);
    expect(await db.transaction.count({ where: { householdId: a.householdId, description: "Cruzado" } })).toBe(0);
  });

  it("o banco também recusa referências cruzadas mesmo sem passar pelo serviço", async () => {
    await expect(
      db.transaction.create({
        data: {
          householdId: a.householdId,
          kind: "EXPENSE",
          status: "PENDING",
          description: "Bypass",
          amountCents: 100,
          categoryId: aData.categories.lazer,
          accountId: bData.accounts.corrente,
          dueDate: new Date("2026-03-01T00:00:00Z"),
          createdById: a.userId,
          idempotencyKey: randomUUID(),
        },
      }),
    ).rejects.toMatchObject({ code: "P2003" });
    await expect(
      db.budget.create({ data: { householdId: a.householdId, month: "2026-03", categoryId: bData.categories.moradia, limitCents: 100 } }),
    ).rejects.toMatchObject({ code: "P2003" });
    await expect(
      db.transaction.update({ where: { id: aData.transactions[0] }, data: { householdId: b.householdId } }),
    ).rejects.toThrow();
  });

  it("listagens, agregações, orçamento e exportação contêm só dados do próprio casal", async () => {
    const list = await listTransactions(a, {});
    expect(list).toHaveLength(aData.transactions.length);
    expect(list.every((t) => aData.transactions.includes(t.id))).toBe(true);

    // Filtros com ids de B não trazem nada de B.
    expect(await listTransactions(a, { accountId: bData.accounts.corrente })).toHaveLength(0);
    expect(await listTransactions(a, { categoryId: bData.categories.alimentacao })).toHaveLength(0);

    const accounts = await accountsWithBalances(a, { includeArchived: true });
    expect(accounts.map((x) => x.id).sort()).toEqual(Object.values(aData.accounts).sort());

    expect((await listCategories(a, { includeArchived: true })).every((c) => !Object.values(bData.categories).includes(c.id))).toBe(true);

    // Excluir tudo de B não altera nada em A.
    const budgetBefore = await monthBudget(a, "2026-03");
    await db.transaction.deleteMany({ where: { householdId: b.householdId } });
    expect(await monthBudget(a, "2026-03")).toEqual(budgetBefore);

    const csv = transactionsToCsv(list);
    expect(csv.split("\r\n").filter(Boolean)).toHaveLength(aData.transactions.length + 1);
    expect(await copyPreviousMonth(a, "2026-04")).toBe(3);
    expect(await db.budget.count({ where: { householdId: b.householdId, month: "2026-04" } })).toBe(0);
  });
});
