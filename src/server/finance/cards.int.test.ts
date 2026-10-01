import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import type { HouseholdContext } from "@/server/households/context";
import { cardSchema, confirmForecastSchema, invoicePaymentSchema, purchaseSchema } from "@/lib/validation/cards";
import { recurrenceSchema, transactionSchema } from "@/lib/validation/finance";
import { accountsWithBalances, createAccount } from "./accounts";
import { listCategories } from "./categories";
import { createSeries, ensureGenerated, endSeries, listSeries } from "./recurrences";
import { deleteTransaction, duplicateDraft, markEffective, markPending, updateTransaction } from "./transactions";
import * as cards from "./cards";
import { resetDatabase } from "../../../test/db";
import { createHouseholdWith } from "../../../test/factories";

const TODAY = "2026-03-20";

let ctx: HouseholdContext;
let other: HouseholdContext;
let corrente: string;
let va: string;
let cat: Record<string, string>;

beforeEach(async () => {
  await resetDatabase();
  ctx = (await createHouseholdWith("Casal A")).contexts[0];
  other = (await createHouseholdWith("Casal B")).contexts[0];
  corrente = (await createAccount(ctx, { name: "Conta corrente", kind: "CHECKING", openingBalance: 200_000, openingDate: "2026-01-01" })).id;
  va = (await createAccount(ctx, { name: "Vale", kind: "BENEFIT", benefitPurpose: "FOOD", openingBalance: 50_000, openingDate: "2026-01-01" })).id;
  cat = Object.fromEntries((await listCategories(ctx)).map((c) => [c.name, c.id]));
});

const cardInput = (over: Record<string, unknown> = {}) =>
  cardSchema.parse({
    name: "Cartão roxo",
    issuer: "Banco X",
    lastFour: "1234",
    color: "#8a6bb0",
    limit: "5.000,00",
    closingDay: "5",
    dueDay: "15",
    holderMemberId: ctx.memberId,
    paymentAccountId: "",
    ...over,
  });

const purchaseInput = (cardId: string, over: Record<string, unknown> = {}) =>
  purchaseSchema.parse({
    idempotencyKey: randomUUID(),
    cardId,
    description: "Mercado",
    total: "250,00",
    purchaseDate: "2026-03-04",
    categoryId: cat["Alimentação"],
    ...over,
  });

const payInput = (invoiceId: string, over: Record<string, unknown> = {}) =>
  invoicePaymentSchema.parse({
    idempotencyKey: randomUUID(),
    invoiceId,
    accountId: corrente,
    date: "2026-03-15",
    amount: "100,00",
    ...over,
  });

async function newCard(over: Record<string, unknown> = {}) {
  return (await cards.createCard(ctx, cardInput(over))).id;
}

async function buy(cardId: string, over: Record<string, unknown> = {}, today = TODAY) {
  return cards.createPurchase(ctx, purchaseInput(cardId, over), today);
}

async function invoicesOf(cardId: string) {
  return (await cards.getCardDetail(ctx, cardId, null, TODAY)).invoices;
}

describe("3.1 cartões", () => {
  it("valida os 4 últimos dígitos e os dias", () => {
    expect(cardSchema.safeParse({ ...cardInput(), lastFour: "1234 5678 9012 3456", limit: "5.000,00", closingDay: "5", dueDay: "15", color: "#8a6bb0", name: "x", holderMemberId: "a" }).error?.issues[0].message).toBe(
      "Informe somente os 4 últimos dígitos",
    );
    expect(() => cardInput({ closingDay: "0" })).toThrow();
    expect(() => cardInput({ dueDay: "32" })).toThrow();
    expect(() => cardInput({ limit: "0" })).toThrow();
  });

  it("cria, lista com dados e titular; recusa benefício como conta de pagamento e titular de outro casal", async () => {
    const id = await newCard({ paymentAccountId: corrente });
    const [c] = await cards.listCards(ctx, TODAY);
    expect(c).toMatchObject({ id, name: "Cartão roxo", lastFour: "1234", limitCents: 500_000, closingDay: 5, dueDay: 15, archived: false });
    expect(c.holder?.memberId).toBe(ctx.memberId);
    expect(c.paymentAccount?.id).toBe(corrente);
    await expect(cards.createCard(ctx, cardInput({ paymentAccountId: va }))).rejects.toThrow("Contas de benefício não podem pagar fatura");
    await expect(cards.createCard(ctx, cardInput({ holderMemberId: other.memberId }))).rejects.toThrow();
  });

  it("o parceiro vê e usa o cartão; outro casal não o enxerga", async () => {
    const partner = (await createHouseholdWith("Casal C")).contexts;
    const id = await newCard();
    expect(await cards.listCards(other, TODAY)).toHaveLength(0);
    await expect(cards.getCardSummary(other, id, TODAY)).rejects.toThrow("Registro não encontrado");
    expect(partner).toHaveLength(2);
  });

  it("mudar os dias vale só para faturas novas; arquivar bloqueia compra mas permite pagar", async () => {
    const id = await newCard();
    const first = await buy(id, { purchaseDate: "2026-03-04" });
    const before = await invoicesOf(id);
    await cards.updateCard(ctx, id, cardInput({ closingDay: "10", dueDay: "20" }));
    expect(await invoicesOf(id)).toEqual(before);
    await buy(id, { purchaseDate: "2026-03-06" });
    const after = await invoicesOf(id);
    // a fatura seguinte continua a sequência gravada: começa no dia seguinte ao fechamento anterior
    expect(after.map((i) => [i.periodStart, i.closingDate, i.dueDate])).toEqual([
      ["2026-02-06", "2026-03-05", "2026-03-15"],
      ["2026-03-06", "2026-04-10", "2026-04-20"],
    ]);
    await cards.setCardArchived(ctx, id, true);
    await expect(buy(id)).rejects.toThrow("Este cartão está arquivado");
    const inv = (await invoicesOf(id))[0];
    await expect(cards.payInvoice(ctx, payInput(inv.id), TODAY)).resolves.toMatchObject({ created: true });
    expect(first.created).toBe(true);
  });
});

describe("3.2 faturas", () => {
  it("compra antes, no dia e depois do fechamento; vencimento no mês seguinte; meses curtos", async () => {
    const id = await newCard();
    await buy(id, { purchaseDate: "2026-03-04" });
    await buy(id, { purchaseDate: "2026-03-05" });
    await buy(id, { purchaseDate: "2026-03-06" });
    const inv = await invoicesOf(id);
    expect(inv.map((i) => [i.periodStart, i.closingDate, i.dueDate, i.status.totalCents])).toEqual([
      ["2026-02-06", "2026-03-05", "2026-03-15", 50_000],
      ["2026-03-06", "2026-04-05", "2026-04-15", 25_000],
    ]);

    const c2 = await newCard({ name: "Dia 25", closingDay: "25", dueDay: "5" });
    await buy(c2, { purchaseDate: "2026-03-20" });
    expect((await invoicesOf(c2))[0]).toMatchObject({ closingDate: "2026-03-25", dueDate: "2026-04-05" });

    const c3 = await newCard({ name: "Dia 31", closingDay: "31", dueDay: "10" });
    await buy(c3, { purchaseDate: "2026-02-15" });
    await buy(c3, { purchaseDate: "2026-03-15" });
    expect((await invoicesOf(c3)).map((i) => [i.periodStart, i.closingDate, i.dueDate])).toEqual([
      ["2026-02-01", "2026-02-28", "2026-03-10"],
      ["2026-03-01", "2026-03-31", "2026-04-10"],
    ]);
  });

  it("cria faturas anteriores quando a compra é anterior à primeira gravada", async () => {
    const id = await newCard();
    await buy(id, { purchaseDate: "2026-03-10" });
    await buy(id, { purchaseDate: "2026-01-20" });
    expect((await invoicesOf(id)).map((i) => i.closingDate)).toEqual(["2026-02-05", "2026-03-05", "2026-04-05"]);
  });

  it("compras simultâneas na mesma data não duplicam faturas", async () => {
    const id = await newCard();
    await Promise.all(Array.from({ length: 6 }, () => buy(id, { purchaseDate: "2026-03-10" })));
    const inv = await invoicesOf(id);
    expect(inv).toHaveLength(1);
    expect(inv[0].status.totalCents).toBe(6 * 25_000);
  });

  it("situação: aberta/fechada, parcial, quitada, atrasada e vazia", async () => {
    const id = await newCard();
    await buy(id, { purchaseDate: "2026-03-04", total: "500,00" });
    const [inv] = await invoicesOf(id);
    const status = async (today: string) => (await cards.getCardDetail(ctx, id, inv.id, today)).invoice!.status;
    expect(await status("2026-03-10")).toMatchObject({ cycle: "closed", payment: "open", overdue: false, remainingCents: 50_000 });
    await cards.payInvoice(ctx, payInput(inv.id, { amount: "200,00" }), "2026-03-15");
    expect(await status("2026-03-20")).toMatchObject({ payment: "partial", overdue: true, remainingCents: 30_000 });
    await cards.payInvoice(ctx, payInput(inv.id, { amount: "300,00" }), "2026-03-16");
    expect(await status("2026-03-20")).toMatchObject({ payment: "paid", overdue: false, remainingCents: 0 });
  });
});

describe("3.3 compras", () => {
  it("não movimenta contas e é idempotente", async () => {
    const id = await newCard();
    const input = purchaseInput(id);
    const a = await cards.createPurchase(ctx, input, TODAY);
    const b = await cards.createPurchase(ctx, input, TODAY);
    expect(b).toMatchObject({ id: a.id, created: false });
    expect(await db.cardPurchase.count()).toBe(1);
    const corr = (await accountsWithBalances(ctx)).find((x) => x.id === corrente)!;
    expect(corr.balanceCents).toBe(200_000);
  });

  it("parcelas exatas: 100,00 em 3 e 2.400,00 em 24 faturas consecutivas", async () => {
    const id = await newCard();
    const p = await buy(id, { total: "100,00", installmentCount: "3" });
    const d = await cards.getPurchase(ctx, p.id, TODAY);
    expect(d.installments.map((i) => i.amountCents)).toEqual([3334, 3333, 3333]);
    const p24 = await buy(id, { total: "2.400,00", installmentCount: "24", description: "Sofá" });
    const d24 = await cards.getPurchase(ctx, p24.id, TODAY);
    expect(d24.installments).toHaveLength(24);
    expect(new Set(d24.installments.map((i) => i.amountCents))).toEqual(new Set([10_000]));
    expect(new Set(d24.installments.map((i) => i.invoice.id)).size).toBe(24);
    await expect(buy(id, { total: "0,02", installmentCount: "3" })).rejects.toThrow("O valor não permite essa quantidade de parcelas");
  });

  it("escolha de fatura; recusa fatura quitada e de outro cartão; estouro de limite apenas avisa", async () => {
    const id = await newCard({ limit: "300,00" });
    const first = await buy(id, { purchaseDate: "2026-03-05" });
    expect(first.overLimit).toBe(false);
    const [inv1] = await invoicesOf(id);
    await buy(id, { purchaseDate: "2026-03-06", total: "1,00" });
    const next = (await invoicesOf(id))[1].id;
    const chosen = await buy(id, { purchaseDate: "2026-03-05", invoiceId: next, total: "100,00" });
    expect(chosen.overLimit).toBe(true);
    expect((await cards.getPurchase(ctx, chosen.id, TODAY)).installments[0].invoice.id).toBe(next);
    await cards.payInvoice(ctx, payInput(inv1.id, { amount: "250,00" }), TODAY);
    await expect(buy(id, { invoiceId: inv1.id })).rejects.toThrow("Esta fatura já está quitada");
    const c2 = await newCard({ name: "Outro" });
    await buy(c2);
    await expect(buy(id, { invoiceId: (await invoicesOf(c2))[0].id })).rejects.toThrow();
  });

  it("sugere a fatura seguinte quando a do ciclo já está quitada", async () => {
    const id = await newCard();
    await buy(id, { purchaseDate: "2026-03-04", total: "100,00" });
    const [inv1] = await invoicesOf(id);
    await cards.payInvoice(ctx, payInput(inv1.id, { amount: "100,00" }), TODAY);
    const p = await buy(id, { purchaseDate: "2026-03-04" });
    const d = await cards.getPurchase(ctx, p.id, TODAY);
    expect(d.installments[0].invoice.closingDate).toBe("2026-04-05");
  });

  it("edita recalculando parcelas, remaneja parcela e exclui sem pagamentos", async () => {
    const id = await newCard();
    const p = await buy(id, { total: "300,00", installmentCount: "3" });
    const edit = (over: Record<string, unknown>) => purchaseInput(id, { total: "300,00", installmentCount: "3", ...over });
    await cards.updatePurchase(ctx, p.id, edit({ total: "400,00", installmentCount: "4" }), TODAY);
    const d = await cards.getPurchase(ctx, p.id, TODAY);
    expect(d.installments.map((i) => i.amountCents)).toEqual([10_000, 10_000, 10_000, 10_000]);
    expect(await db.cardInstallment.count()).toBe(4);

    const second = d.installments[1];
    const third = d.installments[2];
    await cards.moveInstallment(ctx, second.id, third.invoice.id);
    const moved = await cards.getPurchase(ctx, p.id, TODAY);
    expect(moved.installments[1].invoice.id).toBe(third.invoice.id);

    await cards.deletePurchase(ctx, p.id, TODAY);
    expect(await db.cardPurchase.count()).toBe(0);
    expect(await db.cardInstallment.count()).toBe(0);
  });

  it("após pagamento: só descrição, categoria, responsável e observação; desfazer libera", async () => {
    const id = await newCard();
    const p = await buy(id, { total: "300,00", installmentCount: "3" });
    const [inv1] = await invoicesOf(id);
    const pay = await cards.payInvoice(ctx, payInput(inv1.id, { amount: "50,00" }), TODAY);
    const same = (over: Record<string, unknown>) => purchaseInput(id, { total: "300,00", installmentCount: "3", ...over });
    const hint = "Há pagamento registrado na fatura desta compra. Se foi um erro de cadastro, desfaça o pagamento antes.";
    await expect(cards.updatePurchase(ctx, p.id, same({ total: "400,00" }), TODAY)).rejects.toThrow(hint);
    await expect(cards.deletePurchase(ctx, p.id, TODAY)).rejects.toThrow(hint);
    const d = await cards.getPurchase(ctx, p.id, TODAY);
    expect(d.locked).toBe(true);
    await expect(cards.moveInstallment(ctx, d.installments[1].id, d.installments[0].invoice.id)).rejects.toThrow();
    await cards.updatePurchase(ctx, p.id, same({ categoryId: cat["Lazer"], description: "Outro nome", notes: "ok" }), TODAY);
    const after = await cards.getPurchase(ctx, p.id, TODAY);
    expect(after).toMatchObject({ categoryId: cat["Lazer"], description: "Outro nome", totalCents: 30_000 });
    await cards.undoPayment(ctx, pay.id);
    await cards.deletePurchase(ctx, p.id, TODAY);
    expect(await db.cardPurchase.count()).toBe(0);
  });
});

describe("3.4 pagamentos", () => {
  it("parcial e total reduzem a conta; excedente é recusado; benefício não paga", async () => {
    const id = await newCard();
    await buy(id, { total: "500,00" });
    const [inv] = await invoicesOf(id);
    await cards.payInvoice(ctx, payInput(inv.id, { amount: "200,00" }), TODAY);
    await cards.payInvoice(ctx, payInput(inv.id, { amount: "300,00" }), TODAY);
    expect((await accountsWithBalances(ctx)).find((a) => a.id === corrente)!.balanceCents).toBe(150_000);
    await expect(cards.payInvoice(ctx, payInput(inv.id, { amount: "0,01" }), TODAY)).rejects.toThrow("Esta fatura não tem saldo devedor");

    const c2 = await newCard({ name: "B" });
    await buy(c2, { total: "300,00" });
    const inv2 = (await invoicesOf(c2))[0];
    await expect(cards.payInvoice(ctx, payInput(inv2.id, { amount: "300,01" }), TODAY)).rejects.toThrow("O valor excede o saldo devedor da fatura (R$ 300,00)");
    await expect(cards.payInvoice(ctx, payInput(inv2.id, { accountId: va }), TODAY)).rejects.toThrow("Contas de benefício não podem pagar fatura");
    await expect(cards.payInvoice(ctx, payInput(inv2.id, { date: "2026-03-21" }), TODAY)).rejects.toThrow("não pode ser futura");
    await expect(cards.payInvoice(ctx, payInput(inv2.id, { date: "2025-12-31" }), TODAY)).rejects.toThrow("anterior à abertura");
  });

  it("reenvio devolve o mesmo pagamento e pagamentos simultâneos nunca excedem o total", async () => {
    const id = await newCard();
    await buy(id, { total: "300,00" });
    const [inv] = await invoicesOf(id);
    const one = payInput(inv.id, { amount: "100,00" });
    const [a, b] = [await cards.payInvoice(ctx, one, TODAY), await cards.payInvoice(ctx, one, TODAY)];
    expect(b).toMatchObject({ id: a.id, created: false });
    const results = await Promise.allSettled(Array.from({ length: 5 }, () => cards.payInvoice(ctx, payInput(inv.id, { amount: "100,00" }), TODAY)));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(2);
    const paid = await db.transaction.aggregate({ where: { invoiceId: inv.id }, _sum: { amountCents: true } });
    expect(paid._sum.amountCents).toBe(30_000);
  });

  it("desfazer restaura conta e saldo devedor; operações comuns recusam o pagamento", async () => {
    const id = await newCard();
    await buy(id, { total: "300,00" });
    const [inv] = await invoicesOf(id);
    const pay = await cards.payInvoice(ctx, payInput(inv.id, { amount: "200,00" }), TODAY);
    expect((await cards.getCardDetail(ctx, id, inv.id, TODAY)).invoice!.status.payment).toBe("partial");

    const input = transactionSchema.parse({
      idempotencyKey: randomUUID(), kind: "EXPENSE", description: "x", amount: "1,00", categoryId: cat["Lazer"],
      accountId: corrente, status: "EFFECTIVE", dueDate: "2026-03-15", effectiveDate: "2026-03-15",
    });
    await expect(updateTransaction(ctx, pay.id, input)).rejects.toThrow("Pagamentos de fatura só podem ser desfeitos");
    await expect(deleteTransaction(ctx, pay.id)).rejects.toThrow("Pagamentos de fatura só podem ser desfeitos");
    await expect(markPending(ctx, pay.id)).rejects.toThrow("Pagamentos de fatura só podem ser desfeitos");
    await expect(markEffective(ctx, pay.id)).rejects.toThrow("Pagamentos de fatura só podem ser desfeitos");
    await expect(duplicateDraft(ctx, pay.id)).rejects.toThrow("Pagamentos de fatura só podem ser desfeitos");
    expect(await db.transaction.count({ where: { kind: "CARD_PAYMENT" } })).toBe(1);

    await cards.undoPayment(ctx, pay.id);
    expect((await cards.getCardDetail(ctx, id, inv.id, TODAY)).invoice!.status).toMatchObject({ payment: "open", remainingCents: 30_000 });
    expect((await accountsWithBalances(ctx)).find((a) => a.id === corrente)!.balanceCents).toBe(200_000);
  });
});

describe("3.5 recorrências no cartão", () => {
  const seriesInput = (over: Record<string, unknown> = {}) =>
    transactionSchema.parse({
      idempotencyKey: randomUUID(), kind: "EXPENSE", description: "Streaming", amount: "55,90", categoryId: cat["Assinaturas"],
      accountId: "card", status: "PENDING", dueDate: "2026-04-10", ...over,
    });
  const rec = (cardId: string | null) => recurrenceSchema.parse({ frequency: "MONTHLY", endMode: "NONE", cardId: cardId ?? "" });

  it("gera 12 previsões sem afetar limite nem contas; receita e conta arquivada são recusadas", async () => {
    const id = await newCard();
    const { id: seriesId } = await createSeries(ctx, seriesInput(), rec(id), "2026-04-01");
    const forecasts = await db.cardPurchase.findMany({ where: { seriesId }, orderBy: { occurrenceIndex: "asc" } });
    expect(forecasts).toHaveLength(12);
    expect(forecasts.every((f) => f.status === "FORECAST")).toBe(true);
    expect(forecasts[0].purchaseDate.toISOString().slice(0, 10)).toBe("2026-04-10");
    expect(forecasts[11].purchaseDate.toISOString().slice(0, 10)).toBe("2027-03-10");
    expect(await db.cardInstallment.count()).toBe(0);
    expect((await cards.getCardSummary(ctx, id, TODAY)).limit.committedCents).toBe(0);
    expect(await db.transaction.count({ where: { seriesId } })).toBe(0);
    await expect(createSeries(ctx, seriesInput({ kind: "INCOME", categoryId: cat["Salários"] }), rec(id), "2026-04-01")).rejects.toThrow();
    await ensureGenerated(ctx, "2026-04-01");
    expect(await db.cardPurchase.count({ where: { seriesId } })).toBe(12);
  });

  it("confirma uma única vez (idempotente), cria uma parcela e nenhuma despesa comum", async () => {
    const id = await newCard();
    const { id: seriesId } = await createSeries(ctx, seriesInput(), rec(id), "2026-04-01");
    const first = await db.cardPurchase.findFirstOrThrow({ where: { seriesId, occurrenceIndex: 0 } });
    const input = confirmForecastSchema.parse({ date: "2026-04-10", amount: "59,90", invoiceId: "" });
    const [a, b] = await Promise.all([
      cards.confirmForecast(ctx, first.id, input, "2026-04-12"),
      cards.confirmForecast(ctx, first.id, input, "2026-04-12"),
    ]);
    expect([a.created, b.created].sort()).toEqual([false, true]);
    const p = await db.cardPurchase.findUniqueOrThrow({ where: { id: first.id }, include: { installments: true } });
    expect(p).toMatchObject({ status: "CONFIRMED", totalCents: 5990, seriesId, occurrenceIndex: 0 });
    expect(p.installments).toHaveLength(1);
    expect(await db.transaction.count()).toBe(0);
    expect((await cards.getCardSummary(ctx, id, "2026-04-12")).limit.committedCents).toBe(5990);
    await expect(cards.confirmForecast(ctx, first.id, confirmForecastSchema.parse({ date: "2026-04-13", amount: "1,00" }), "2026-04-12")).resolves.toMatchObject({ created: false });
  });

  it("pular só esta / esta e as próximas / encerrar preservam as confirmadas; arquivar interrompe a geração", async () => {
    const id = await newCard();
    const { id: seriesId } = await createSeries(ctx, seriesInput(), rec(id), "2026-04-01");
    const at = (i: number) => db.cardPurchase.findFirstOrThrow({ where: { seriesId, occurrenceIndex: i } });
    await cards.confirmForecast(ctx, (await at(0)).id, confirmForecastSchema.parse({ date: "2026-04-10", amount: "55,90" }), "2026-04-12");
    await cards.skipForecast(ctx, (await at(1)).id, "only");
    expect(await db.cardPurchase.count({ where: { seriesId, occurrenceIndex: 1 } })).toBe(0);
    await cards.skipForecast(ctx, (await at(5)).id, "following");
    expect((await db.cardPurchase.findMany({ where: { seriesId }, select: { occurrenceIndex: true } })).map((p) => p.occurrenceIndex).sort((x, y) => x! - y!)).toEqual([0, 2, 3, 4]);
    await endSeries(ctx, seriesId, "2026-07-01");
    expect(await db.cardPurchase.count({ where: { seriesId, status: "FORECAST" } })).toBe(1);
    expect(await db.cardPurchase.count({ where: { seriesId, status: "CONFIRMED" } })).toBe(1);
    expect((await listSeries(ctx))[0]).toMatchObject({ cardName: "Cartão roxo", accountName: "Cartão roxo" });
  });

  it("cartão arquivado: não confirma e não gera novas previsões", async () => {
    const id = await newCard();
    const { id: seriesId } = await createSeries(ctx, seriesInput({ dueDate: "2026-04-10" }), recurrenceSchema.parse({ frequency: "MONTHLY", endMode: "COUNT", occurrenceCount: "24", cardId: id }), "2026-04-01");
    expect(await db.cardPurchase.count({ where: { seriesId } })).toBe(12);
    await cards.setCardArchived(ctx, id, true);
    await ensureGenerated(ctx, "2027-01-01");
    expect(await db.cardPurchase.count({ where: { seriesId } })).toBe(12);
    const f = await db.cardPurchase.findFirstOrThrow({ where: { seriesId } });
    await expect(cards.confirmForecast(ctx, f.id, confirmForecastSchema.parse({ date: "2026-04-10", amount: "55,90" }), "2026-04-12")).rejects.toThrow("arquivado");
    await cards.setCardArchived(ctx, id, false);
    await ensureGenerated(ctx, "2027-01-01");
    expect(await db.cardPurchase.count({ where: { seriesId } })).toBeGreaterThan(12);
  });
});
