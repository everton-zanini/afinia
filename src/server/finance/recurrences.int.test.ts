import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import type { HouseholdContext } from "@/server/households/context";
import { fromDbDate } from "@/lib/dates";
import { monthTotals } from "@/lib/finance/rules";
import { transactionSchema, type RecurrenceInput } from "@/lib/validation/finance";
import { createAccount, accountsWithBalances } from "./accounts";
import { listCategories } from "./categories";
import { monthBudget, setBudgetLimit } from "./budgets";
import { duplicateDraft, listTransactions, markEffective } from "./transactions";
import {
  createSeries,
  deleteOccurrence,
  endSeries,
  ensureGenerated,
  listSeries,
  previewDeleteFollowing,
  previewEnd,
  updateOccurrence,
} from "./recurrences";
import { resetDatabase } from "../../../test/db";
import { createHouseholdWith } from "../../../test/factories";

let ctx: HouseholdContext;
let corrente: string;
let reserva: string;
let cat: Record<string, string>;

beforeEach(async () => {
  await resetDatabase();
  ctx = (await createHouseholdWith("Casal A")).contexts[0];
  corrente = (await createAccount(ctx, { name: "Corrente", kind: "CHECKING", openingBalance: 1_000_000, openingDate: "2025-01-01" })).id;
  reserva = (await createAccount(ctx, { name: "Reserva", kind: "RESERVE", openingBalance: 0, openingDate: "2025-01-01" })).id;
  cat = Object.fromEntries((await listCategories(ctx)).map((c) => [c.name, c.id]));
});

const tx = (over: Record<string, unknown> = {}) =>
  transactionSchema.parse({
    idempotencyKey: randomUUID(),
    kind: "EXPENSE",
    description: "Aluguel",
    amount: "1.800,00",
    categoryId: cat.Moradia,
    accountId: corrente,
    status: "PENDING",
    dueDate: "2026-04-10",
    ...over,
  });

const rec = (over: Partial<RecurrenceInput> = {}): RecurrenceInput => ({
  frequency: "MONTHLY",
  endMode: "NONE",
  occurrenceCount: null,
  untilDate: null,
  ...over,
});

async function occurrences(seriesId: string) {
  return db.transaction.findMany({ where: { seriesId }, orderBy: { occurrenceIndex: "asc" } });
}
const dates = (rows: { dueDate: Date }[]) => rows.map((r) => fromDbDate(r.dueDate));

describe("modelo e restrições", () => {
  it("unicidade por posição, CHECK e referência cruzada no banco", async () => {
    const { id } = await createSeries(ctx, tx(), rec(), "2026-04-05");
    const first = (await occurrences(id))[0];
    await expect(
      db.transaction.create({
        data: {
          householdId: ctx.householdId, kind: "EXPENSE", status: "PENDING", description: "dup", amountCents: 1,
          categoryId: cat.Moradia, accountId: corrente, dueDate: first.dueDate, createdById: ctx.userId,
          idempotencyKey: randomUUID(), seriesId: id, occurrenceIndex: 0,
        },
      }),
    ).rejects.toMatchObject({ code: "P2002" });
    await expect(db.transaction.update({ where: { id: first.id }, data: { occurrenceIndex: null } })).rejects.toThrow();
    const other = (await createHouseholdWith("Casal B")).contexts[0];
    const otherAcc = (await createAccount(other, { name: "B", kind: "CHECKING", openingBalance: 0, openingDate: "2025-01-01" })).id;
    await expect(
      db.recurringRule.create({ data: { seriesId: id, fromIndex: 5, description: "x", amountCents: 1, categoryId: cat.Moradia, accountId: otherAcc } }),
    ).rejects.toMatchObject({ code: "P2003" });
    await expect(db.recurringSeries.update({ where: { id }, data: { frequency: "WEEKLY" } })).rejects.toThrow();
  });
});

describe("criação e janela", () => {
  it("aluguel sem término criado em 05/04/2026 gera até 10/03/2027", async () => {
    const { id } = await createSeries(ctx, tx(), rec(), "2026-04-05");
    const rows = await occurrences(id);
    expect(rows).toHaveLength(12);
    expect(dates(rows).at(0)).toBe("2026-04-10");
    expect(dates(rows).at(-1)).toBe("2027-03-10");
    expect(rows.every((r) => r.status === "PENDING" && r.amountCents === 180_000)).toBe(true);
  });

  it("após N ocorrências: curso de 10 meses", async () => {
    const { id } = await createSeries(ctx, tx({ description: "Curso de inglês", amount: "450,00", dueDate: "2026-05-05", categoryId: cat["Educação"] }), rec({ endMode: "COUNT", occurrenceCount: 10 }), "2026-05-01");
    const rows = await occurrences(id);
    expect(rows).toHaveLength(10);
    expect(dates(rows).at(-1)).toBe("2027-02-05");
  });

  it("série finita que ultrapassa a janela", async () => {
    const { id } = await createSeries(ctx, tx({ dueDate: "2026-05-10" }), rec({ endMode: "COUNT", occurrenceCount: 24 }), "2026-05-01");
    expect(await occurrences(id)).toHaveLength(12);
    const [view] = await listSeries(ctx);
    expect(view.summary).toMatchObject({ programming: "active", pendingCount: 12, toGenerate: 12 });
  });

  it("até uma data, inclusive (semanal)", async () => {
    const { id } = await createSeries(ctx, tx({ kind: "INCOME", categoryId: cat["Trabalhos extras"], dueDate: "2026-06-01" }), rec({ frequency: "WEEKLY", endMode: "UNTIL", untilDate: "2026-06-29" }), "2026-05-20");
    expect(dates(await occurrences(id))).toEqual(["2026-06-01", "2026-06-08", "2026-06-15", "2026-06-22", "2026-06-29"]);
  });

  it("primeira efetivada exige data real não futura e o resto fica pendente", async () => {
    await expect(
      createSeries(ctx, tx({ status: "EFFECTIVE", effectiveDate: "2026-04-13" }), rec({ endMode: "COUNT", occurrenceCount: 3 }), "2026-04-12"),
    ).rejects.toThrow("não pode ser futura");
    const { id } = await createSeries(ctx, tx({ status: "EFFECTIVE", effectiveDate: "2026-04-11" }), rec({ endMode: "COUNT", occurrenceCount: 3 }), "2026-04-12");
    const rows = await occurrences(id);
    expect(rows.map((r) => r.status)).toEqual(["EFFECTIVE", "PENDING", "PENDING"]);
    expect(fromDbDate(rows[0].effectiveDate!)).toBe("2026-04-11");
    expect(fromDbDate(rows[0].dueDate)).toBe("2026-04-10");
  });

  it("criação idempotente (duplo toque)", async () => {
    const input = tx();
    const [a, b] = await Promise.all([createSeries(ctx, input, rec(), "2026-04-05"), createSeries(ctx, input, rec(), "2026-04-05")]);
    expect(a.id).toBe(b.id);
    expect(await db.recurringSeries.count()).toBe(1);
    expect(await occurrences(a.id)).toHaveLength(12);
  });

  it("valida término", async () => {
    await expect(createSeries(ctx, tx(), rec({ endMode: "COUNT", occurrenceCount: 1 }), "2026-04-05")).rejects.toThrow("2 a 600");
    await expect(createSeries(ctx, tx(), rec({ endMode: "UNTIL", untilDate: "2026-04-10" }), "2026-04-05")).rejects.toThrow("posterior");
  });
});

describe("expansão da janela", () => {
  it("avança sem alterar existentes", async () => {
    const { id } = await createSeries(ctx, tx(), rec(), "2026-04-05");
    const april = (await occurrences(id))[0];
    await markEffective(ctx, april.id, "2026-04-10");
    await db.transaction.update({ where: { id: april.id }, data: { amountCents: 175_000 } });
    await ensureGenerated(ctx, "2026-04-15");
    const rows = await occurrences(id);
    expect(dates(rows).at(-1)).toBe("2027-04-10");
    expect(rows[0]).toMatchObject({ status: "EFFECTIVE", amountCents: 175_000 });
  });

  it("retorno após meses sem acesso gera intermediárias vencidas", async () => {
    const { id } = await createSeries(ctx, tx({ dueDate: "2026-01-05" }), rec(), "2026-01-05");
    expect(dates(await occurrences(id)).at(-1)).toBe("2027-01-05");
    await ensureGenerated(ctx, "2026-09-20");
    const rows = await occurrences(id);
    expect(rows).toHaveLength(21);
    expect(dates(rows).at(-1)).toBe("2027-09-05");
    expect(new Set(rows.map((r) => r.occurrenceIndex)).size).toBe(rows.length);
  });

  it("geração concorrente não duplica", async () => {
    const { id } = await createSeries(ctx, tx({ frequency: "WEEKLY", dueDate: "2026-01-05" }), rec({ frequency: "WEEKLY" }), "2026-01-05");
    await Promise.all([ensureGenerated(ctx, "2027-06-01"), ensureGenerated(ctx, "2027-06-01"), ensureGenerated(ctx, "2027-06-01")]);
    const rows = await occurrences(id);
    expect(new Set(rows.map((r) => r.occurrenceIndex)).size).toBe(rows.length);
    expect(dates(rows).at(-1)! <= "2028-06-01").toBe(true);
  });

  it("ocorrência com data alterada não é duplicada", async () => {
    const { id } = await createSeries(ctx, tx(), rec(), "2026-04-05");
    const may = (await occurrences(id))[1];
    await updateOccurrence(ctx, may.id, tx({ dueDate: "2026-06-15" }), "only");
    await ensureGenerated(ctx, "2026-08-01");
    const rows = await occurrences(id);
    expect(rows.filter((r) => r.occurrenceIndex === 1)).toHaveLength(1);
    expect(rows.filter((r) => fromDbDate(r.dueDate) === "2026-06-10")).toHaveLength(1);
    expect(rows.find((r) => r.occurrenceIndex === 1)).toMatchObject({ seriesOverride: true });
  });
});

describe("edição em escopo", () => {
  it("reajuste preserva exceções, efetivadas e vale para posições geradas depois", async () => {
    const { id } = await createSeries(ctx, tx(), rec(), "2026-04-05");
    let rows = await occurrences(id);
    await markEffective(ctx, rows[0].id, "2026-04-10");
    await updateOccurrence(ctx, rows[2].id, tx({ amount: "1.700,00", dueDate: "2026-06-10" }), "only");
    await updateOccurrence(ctx, rows[1].id, tx({ amount: "1.950,00", dueDate: "2026-05-10" }), "following");
    await ensureGenerated(ctx, "2026-06-01");
    rows = await occurrences(id);
    const amount = (i: number) => rows.find((r) => r.occurrenceIndex === i)!.amountCents;
    expect(amount(0)).toBe(180_000);
    expect(amount(1)).toBe(195_000);
    expect(amount(2)).toBe(170_000);
    expect(amount(3)).toBe(195_000);
    expect(amount(12)).toBe(195_000);
  });

  it("efetivada só aceita 'só este'; data só muda com 'só este'; tipo é imutável", async () => {
    const { id } = await createSeries(ctx, tx(), rec(), "2026-04-05");
    const rows = await occurrences(id);
    await markEffective(ctx, rows[0].id, "2026-04-10");
    await expect(updateOccurrence(ctx, rows[0].id, tx({ amount: "1,00" }), "following")).rejects.toThrow("Só este");
    await expect(updateOccurrence(ctx, rows[1].id, tx({ dueDate: "2026-05-20" }), "following")).rejects.toThrow("data");
    await expect(updateOccurrence(ctx, rows[1].id, tx({ kind: "INCOME", categoryId: cat["Salários"], dueDate: "2026-05-10" }), "only")).rejects.toThrow("tipo");
  });
});

describe("exclusão e encerramento", () => {
  it("ocorrência excluída não reaparece", async () => {
    const { id } = await createSeries(ctx, tx(), rec(), "2026-04-05");
    const july = (await occurrences(id)).find((r) => r.occurrenceIndex === 3)!;
    await deleteOccurrence(ctx, july.id, "only");
    await ensureGenerated(ctx, "2026-12-01");
    const rows = await occurrences(id);
    expect(rows.some((r) => r.occurrenceIndex === 3)).toBe(false);
    expect(rows.some((r) => r.occurrenceIndex === 4)).toBe(true);
  });

  it("excluir este e os próximos remove pendentes (inclusive personalizadas) e preserva efetivadas", async () => {
    const { id } = await createSeries(ctx, tx({ dueDate: "2026-01-10" }), rec(), "2026-03-15");
    let rows = await occurrences(id);
    for (const r of rows.slice(0, 3)) await markEffective(ctx, r.id, fromDbDate(r.dueDate));
    await updateOccurrence(ctx, rows[4].id, tx({ amount: "10,00", dueDate: "2026-05-10" }), "only");
    expect(await previewDeleteFollowing(ctx, rows[3].id)).toEqual({ count: rows.length - 3, totalCents: (rows.length - 5) * 180_000 + 180_000 + 1_000 });
    await deleteOccurrence(ctx, rows[3].id, "following");
    await ensureGenerated(ctx, "2027-06-01");
    rows = await occurrences(id);
    expect(rows.map((r) => r.occurrenceIndex)).toEqual([0, 1, 2]);
    expect(rows.every((r) => r.status === "EFFECTIVE")).toBe(true);
    const [view] = await listSeries(ctx);
    expect(view.summary.programming).toBe("ended");
  });

  it("encerrar preserva pendências vencidas", async () => {
    const { id } = await createSeries(ctx, tx(), rec(), "2026-04-05");
    expect((await previewEnd(ctx, id, "2026-05-20")).count).toBe(10);
    await endSeries(ctx, id, "2026-05-20");
    await ensureGenerated(ctx, "2027-01-01");
    const rows = await occurrences(id);
    expect(dates(rows)).toEqual(["2026-04-10", "2026-05-10"]);
    expect(rows.every((r) => r.status === "PENDING")).toBe(true);
  });

  it("série encerrada com pagamentos pendentes e restantes considerando exclusão", async () => {
    const { id } = await createSeries(ctx, tx({ dueDate: "2026-01-10" }), rec({ endMode: "COUNT", occurrenceCount: 10 }), "2026-01-05");
    const rows = await occurrences(id);
    for (const r of rows.slice(0, 4)) await markEffective(ctx, r.id, fromDbDate(r.dueDate));
    await deleteOccurrence(ctx, rows[4].id, "only");
    await deleteOccurrence(ctx, rows[6].id, "following");
    const [view] = await listSeries(ctx);
    expect(view.summary).toEqual({ programming: "ended", pendingCount: 1, pendingCents: 180_000, toGenerate: 0 });
  });
});

describe("isolamento", () => {
  it("séries e ocorrências de outro casal são inacessíveis; vínculo forjado é ignorado", async () => {
    const { id } = await createSeries(ctx, tx(), rec(), "2026-04-05");
    const occ = (await occurrences(id))[1];
    const other = (await createHouseholdWith("Casal B")).contexts[0];
    const otherAcc = (await createAccount(other, { name: "B", kind: "CHECKING", openingBalance: 0, openingDate: "2025-01-01" })).id;
    const otherCat = (await listCategories(other)).find((c) => c.name === "Moradia")!.id;
    const otherInput = tx({ accountId: otherAcc, categoryId: otherCat, dueDate: "2026-05-10" });

    await expect(updateOccurrence(other, occ.id, otherInput, "only")).rejects.toThrow("Registro não encontrado");
    await expect(deleteOccurrence(other, occ.id, "only")).rejects.toThrow("Registro não encontrado");
    await expect(previewDeleteFollowing(other, occ.id)).rejects.toThrow("Registro não encontrado");
    await expect(endSeries(other, id)).rejects.toThrow("Registro não encontrado");
    await expect(previewEnd(other, id)).rejects.toThrow("Registro não encontrado");
    expect(await listSeries(other)).toEqual([]);
    expect(await listTransactions(other, { seriesId: id })).toEqual([]);
    await expect(createSeries(ctx, tx({ accountId: otherAcc }), rec(), "2026-04-05")).rejects.toThrow("Registro não encontrado");
    expect(await occurrences(id)).toHaveLength(12);

    const forged = transactionSchema.parse({
      idempotencyKey: randomUUID(), kind: "EXPENSE", description: "Forjado", amount: "1,00", categoryId: cat.Moradia,
      accountId: corrente, status: "PENDING", dueDate: "2026-04-10", seriesId: id, occurrenceIndex: 99, seriesOverride: true,
    });
    const { createTransaction } = await import("./transactions");
    const created = await createTransaction(ctx, forged);
    expect(await db.transaction.findUniqueOrThrow({ where: { id: created.id } })).toMatchObject({ seriesId: null, occurrenceIndex: null, seriesOverride: false });
  });
});

describe("efeitos financeiros", () => {
  it("orçamento e previsões incluem ocorrências; transferência recorrente não altera receitas/despesas", async () => {
    await createSeries(ctx, tx({ description: "Streaming", amount: "55,90", categoryId: cat.Assinaturas, dueDate: "2026-04-18" }), rec(), "2026-04-05");
    await setBudgetLimit(ctx, "2026-05", cat.Assinaturas, 10_000);
    const may = await monthBudget(ctx, "2026-05");
    expect(may.rows[0]).toMatchObject({ pendingCents: 5_590, realizedCents: 0 });

    const { id } = await createSeries(ctx, tx({ kind: "TRANSFER", description: "Reserva", amount: "500,00", categoryId: "", toAccountId: reserva, dueDate: "2026-04-20" }), rec(), "2026-04-05");
    const first = (await occurrences(id))[0];
    await markEffective(ctx, first.id, "2026-04-20");
    const all = await listTransactions(ctx, {});
    const totals = monthTotals(all.map((t) => ({ ...t, accountId: t.account.id, toAccountId: t.toAccount?.id ?? null, categoryId: t.category?.id ?? null })), "2026-04");
    expect(totals).toMatchObject({ incomeRealized: 0, expenseRealized: 0 });
    const balances = Object.fromEntries((await accountsWithBalances(ctx)).map((a) => [a.name, a.balanceCents]));
    expect(balances).toEqual({ Corrente: 950_000, Reserva: 50_000 });
  });

  it("duplicar uma ocorrência gera lançamento avulso e a lista mostra a posição", async () => {
    const { id } = await createSeries(ctx, tx({ dueDate: "2026-05-05" }), rec({ endMode: "COUNT", occurrenceCount: 12 }), "2026-05-01");
    const third = (await occurrences(id))[2];
    const draft = await duplicateDraft(ctx, third.id);
    expect(draft).not.toHaveProperty("seriesId");
    const listed = (await listTransactions(ctx, { seriesId: id })).find((t) => t.id === third.id)!;
    expect(listed.series).toMatchObject({ label: "Ocorrência 3 de 12", index: 2 });
  });
});
