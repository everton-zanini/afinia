import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import type { HouseholdContext } from "@/server/households/context";
import { cardSchema, confirmForecastSchema, invoicePaymentSchema, purchaseSchema } from "@/lib/validation/cards";
import { recurrenceSchema, transactionSchema } from "@/lib/validation/finance";
import { createAccount } from "./accounts";
import { listCategories } from "./categories";
import { createSeries } from "./recurrences";
import { dashboard, reports } from "./reports";
import { monthBudget } from "./budgets";
import * as cards from "./cards";
import { resetDatabase } from "../../../test/db";
import { createHouseholdWith } from "../../../test/factories";

const TODAY = "2026-04-20";
const NOT_FOUND = "Registro não encontrado";

let a: HouseholdContext;
let b: HouseholdContext;
let catA: Record<string, string>;
let catB: Record<string, string>;
let contaA: string;
let contaB: string;
let cardA: string;
let cardB: string;
let ids: { invoice: string; purchase: string; installment: string; payment: string; forecast: string };

const newCard = async (ctx: HouseholdContext) =>
  (await cards.createCard(ctx, cardSchema.parse({ name: "Roxo", color: "#8a6bb0", limit: "5.000,00", closingDay: "5", dueDay: "15", holderMemberId: ctx.memberId }))).id;

beforeEach(async () => {
  await resetDatabase();
  a = (await createHouseholdWith("Casal A")).contexts[0];
  b = (await createHouseholdWith("Casal B")).contexts[0];
  catA = Object.fromEntries((await listCategories(a)).map((c) => [c.name, c.id]));
  catB = Object.fromEntries((await listCategories(b)).map((c) => [c.name, c.id]));
  contaA = (await createAccount(a, { name: "Corrente A", kind: "CHECKING", openingBalance: 100_000, openingDate: "2026-01-01" })).id;
  contaB = (await createAccount(b, { name: "Corrente B", kind: "CHECKING", openingBalance: 100_000, openingDate: "2026-01-01" })).id;
  cardA = await newCard(a);
  cardB = await newCard(b);

  const purchase = await cards.createPurchase(
    a,
    purchaseSchema.parse({ idempotencyKey: randomUUID(), cardId: cardA, description: "Compra A", total: "300,00", purchaseDate: "2026-03-10", categoryId: catA["Lazer"], installmentCount: "3" }),
    TODAY,
  );
  const detail = await cards.getPurchase(a, purchase.id, TODAY);
  const payment = await cards.payInvoice(
    a,
    invoicePaymentSchema.parse({ idempotencyKey: randomUUID(), invoiceId: detail.installments[0].invoice.id, accountId: contaA, date: "2026-04-15", amount: "50,00" }),
    TODAY,
  );
  const series = await createSeries(
    a,
    transactionSchema.parse({ idempotencyKey: randomUUID(), kind: "EXPENSE", description: "Streaming", amount: "55,90", categoryId: catA["Assinaturas"], accountId: "card", status: "PENDING", dueDate: "2026-05-10" }),
    recurrenceSchema.parse({ frequency: "MONTHLY", endMode: "NONE", cardId: cardA }),
    TODAY,
  );
  const forecast = await db.cardPurchase.findFirstOrThrow({ where: { seriesId: series.id, occurrenceIndex: 0 } });
  ids = { invoice: detail.installments[0].invoice.id, purchase: purchase.id, installment: detail.installments[1].id, payment: payment.id, forecast: forecast.id };
});

describe("isolamento entre casais", () => {
  it("ids de outro casal são tratados como inexistentes em todas as operações", async () => {
    await expect(cards.getCardSummary(b, cardA, TODAY)).rejects.toThrow(NOT_FOUND);
    await expect(cards.getCardDetail(b, cardA, null, TODAY)).rejects.toThrow(NOT_FOUND);
    await expect(cards.selectableInvoices(b, cardA, TODAY)).rejects.toThrow(NOT_FOUND);
    await expect(cards.setCardArchived(b, cardA, true)).rejects.toThrow(NOT_FOUND);
    await expect(
      cards.updateCard(b, cardA, cardSchema.parse({ name: "X", color: "#8a6bb0", limit: "1,00", closingDay: "1", dueDay: "2", holderMemberId: b.memberId })),
    ).rejects.toThrow(NOT_FOUND);
    await expect(cards.getPurchase(b, ids.purchase, TODAY)).rejects.toThrow(NOT_FOUND);
    await expect(cards.deletePurchase(b, ids.purchase, TODAY)).rejects.toThrow(NOT_FOUND);
    await expect(cards.moveInstallment(b, ids.installment, ids.invoice)).rejects.toThrow(NOT_FOUND);
    await expect(cards.undoPayment(b, ids.payment)).rejects.toThrow(NOT_FOUND);
    await expect(cards.getForecast(b, ids.forecast, TODAY)).rejects.toThrow(NOT_FOUND);
    await expect(cards.skipForecast(b, ids.forecast, "only")).rejects.toThrow(NOT_FOUND);
    await expect(cards.confirmForecast(b, ids.forecast, confirmForecastSchema.parse({ date: "2026-04-10", amount: "1,00" }), TODAY)).rejects.toThrow(NOT_FOUND);
    await expect(
      cards.payInvoice(b, invoicePaymentSchema.parse({ idempotencyKey: randomUUID(), invoiceId: ids.invoice, accountId: contaB, date: "2026-04-16", amount: "10,00" }), TODAY),
    ).rejects.toThrow(NOT_FOUND);
    // nada mudou
    expect(await db.transaction.count({ where: { kind: "CARD_PAYMENT" } })).toBe(1);
    expect(await db.cardPurchase.count({ where: { id: ids.purchase } })).toBe(1);
  });

  it("não mistura referências: cartão, fatura, conta e categoria de outro casal", async () => {
    const input = (over: Record<string, unknown>) =>
      purchaseSchema.parse({ idempotencyKey: randomUUID(), cardId: cardB, description: "x", total: "10,00", purchaseDate: "2026-04-01", categoryId: catB["Lazer"], ...over });
    await expect(cards.createPurchase(b, input({ cardId: cardA }), TODAY)).rejects.toThrow(NOT_FOUND);
    await expect(cards.createPurchase(b, input({ categoryId: catA["Lazer"] }), TODAY)).rejects.toThrow(NOT_FOUND);
    await expect(cards.createPurchase(b, input({ invoiceId: ids.invoice }), TODAY)).rejects.toThrow(NOT_FOUND);
    const mine = await cards.createPurchase(b, input({}), TODAY);
    const invB = (await cards.getPurchase(b, mine.id, TODAY)).installments[0].invoice.id;
    await expect(
      cards.payInvoice(b, invoicePaymentSchema.parse({ idempotencyKey: randomUUID(), invoiceId: invB, accountId: contaA, date: "2026-04-16", amount: "1,00" }), TODAY),
    ).rejects.toThrow(NOT_FOUND);
    await expect(cards.moveInstallment(b, (await cards.getPurchase(b, mine.id, TODAY)).installments[0].id, ids.invoice)).rejects.toThrow(NOT_FOUND);
    await expect(
      createSeries(
        b,
        transactionSchema.parse({ idempotencyKey: randomUUID(), kind: "EXPENSE", description: "x", amount: "1,00", categoryId: catB["Assinaturas"], accountId: "card", status: "PENDING", dueDate: "2026-05-10" }),
        recurrenceSchema.parse({ frequency: "MONTHLY", endMode: "NONE", cardId: cardA }),
        TODAY,
      ),
    ).rejects.toThrow(NOT_FOUND);
    await expect(
      cards.createCard(b, cardSchema.parse({ name: "X", color: "#8a6bb0", limit: "1,00", closingDay: "1", dueDay: "2", holderMemberId: a.memberId })),
    ).rejects.toThrow(NOT_FOUND);
    await expect(
      cards.createCard(b, cardSchema.parse({ name: "X", color: "#8a6bb0", limit: "1,00", closingDay: "1", dueDay: "2", holderMemberId: b.memberId, paymentAccountId: contaA })),
    ).rejects.toThrow(NOT_FOUND);
  });

  it("agregações enxergam somente o casal da sessão", async () => {
    expect((await cards.listCards(b, TODAY)).map((c) => c.id)).toEqual([cardB]);
    expect((await cards.listCards(a, TODAY)).map((c) => c.id)).toEqual([cardA]);
    expect(await cards.cardMovements(b)).toEqual([]);
    expect((await cards.cardMovements(a)).length).toBeGreaterThan(0);
    const dB = await dashboard(b, "2026-04", TODAY);
    expect(dB.cardDebtCents).toBe(0);
    expect(dB.current).toMatchObject({ expenseRealized: 0, expenseCard: 0, cardPayments: 0 });
    expect(dB.generalBalanceCents).toBe(100_000);
    const dA = await dashboard(a, "2026-04", TODAY);
    expect(dA.cardDebtCents).toBe(25_000);
    expect(dA.generalBalanceCents).toBe(95_000);
    expect((await reports(b, { month: "2026-04", today: TODAY })).byCategory.totalCents).toBe(0);
    expect((await monthBudget(b, "2026-04")).totals.realizedCents).toBe(0);
  });

  it("contas de benefício seguem fora do pagamento de fatura e do saldo de uso geral", async () => {
    const va = (await createAccount(a, { name: "Vale", kind: "BENEFIT", benefitPurpose: "FOOD", openingBalance: 60_000, openingDate: "2026-01-01" })).id;
    await expect(
      cards.payInvoice(a, invoicePaymentSchema.parse({ idempotencyKey: randomUUID(), invoiceId: ids.invoice, accountId: va, date: "2026-04-16", amount: "10,00" }), TODAY),
    ).rejects.toThrow("Contas de benefício não podem pagar fatura");
    const d = await dashboard(a, "2026-04", TODAY);
    expect(d).toMatchObject({ generalBalanceCents: 95_000, benefitBalanceCents: 60_000, totalBalanceCents: 155_000 });
  });
});
