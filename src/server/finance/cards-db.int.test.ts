import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import type { HouseholdContext } from "@/server/households/context";
import { createAccount } from "./accounts";
import { listCategories } from "./categories";
import { resetDatabase } from "../../../test/db";
import { createHouseholdWith } from "../../../test/factories";

const day = (s: string) => new Date(`${s}T00:00:00Z`);

let a: HouseholdContext;
let b: HouseholdContext;
let catA: string;
let corrente: string;
let va: string;

async function card(ctx: HouseholdContext, over: Record<string, unknown> = {}) {
  return db.creditCard.create({
    data: { householdId: ctx.householdId, name: "Roxo", color: "#7c3aed", limitCents: 500_000, closingDay: 10, dueDay: 17, holderMemberId: ctx.memberId, ...over },
  });
}
const invoice = (ctx: HouseholdContext, cardId: string, closing = "2026-04-10") =>
  db.cardInvoice.create({ data: { householdId: ctx.householdId, cardId, periodStart: day("2026-03-11"), closingDate: day(closing), dueDate: day("2026-04-17") } });

beforeEach(async () => {
  await resetDatabase();
  a = (await createHouseholdWith("Casal A")).contexts[0];
  b = (await createHouseholdWith("Casal B")).contexts[0];
  catA = (await listCategories(a)).find((c) => c.kind === "EXPENSE")!.id;
  corrente = (await createAccount(a, { name: "Conta corrente", kind: "CHECKING", openingBalance: 200_000, openingDate: "2026-01-01" })).id;
  va = (await createAccount(a, { name: "Vale", kind: "BENEFIT", benefitPurpose: "FOOD", openingBalance: 0, openingDate: "2026-01-01" })).id;
});

describe("banco: cartões e faturas", () => {
  it("valida dias, limite e 4 últimos dígitos", async () => {
    await expect(card(a, { closingDay: 0 })).rejects.toThrow();
    await expect(card(a, { dueDay: 32 })).rejects.toThrow();
    await expect(card(a, { limitCents: 0 })).rejects.toThrow();
    await expect(card(a, { lastFour: "12a4" })).rejects.toThrow();
    await expect(card(a, { lastFour: "1234" })).resolves.toBeTruthy();
  });

  it("recusa titular ou conta de pagamento de outro casal e conta de benefício", async () => {
    await expect(card(a, { holderMemberId: b.memberId })).rejects.toThrow(/Foreign key|afinia_tenant_mismatch/);
    const contaB = await createAccount(b, { name: "B", kind: "CHECKING", openingBalance: 0, openingDate: "2026-01-01" });
    await expect(card(a, { paymentAccountId: contaB.id })).rejects.toThrow(/Foreign key|afinia_tenant_mismatch/);
    await expect(card(a, { paymentAccountId: va })).rejects.toThrow(/afinia_benefit_transfer/);
    await expect(card(a, { paymentAccountId: corrente })).resolves.toBeTruthy();
  });

  it("fatura: cartão do mesmo casal, datas coerentes, únicas por fechamento e imutáveis", async () => {
    const ca = await card(a);
    const cb = await card(b);
    await expect(invoice(b, ca.id)).rejects.toThrow(/Foreign key|afinia_tenant_mismatch/);
    await expect(
      db.cardInvoice.create({ data: { householdId: a.householdId, cardId: ca.id, periodStart: day("2026-03-11"), closingDate: day("2026-04-10"), dueDate: day("2026-04-10") } }),
    ).rejects.toThrow();
    const inv = await invoice(a, ca.id);
    await expect(invoice(a, ca.id)).rejects.toThrow();
    await expect(db.cardInvoice.update({ where: { id: inv.id }, data: { dueDate: day("2026-04-20") } })).rejects.toThrow(/afinia_invoice_immutable/);
    await expect(db.cardInvoice.update({ where: { id: inv.id }, data: { householdId: b.householdId } })).rejects.toThrow();
    expect(cb.id).toBeTruthy();
  });
});

describe("banco: compras e parcelas", () => {
  const purchase = (ctx: HouseholdContext, cardId: string, invoiceId: string, over: Record<string, unknown> = {}) =>
    db.cardPurchase.create({
      data: {
        householdId: ctx.householdId, cardId, invoiceId, status: "CONFIRMED", description: "Compra", totalCents: 10_000,
        purchaseDate: day("2026-04-01"), categoryId: catA, createdById: ctx.userId, idempotencyKey: crypto.randomUUID(), ...over,
      },
    });

  it("recusa fatura de outro cartão, categoria de outro casal e parcela em fatura de outro cartão", async () => {
    const c1 = await card(a);
    const c2 = await card(a, { name: "Azul" });
    const i1 = await invoice(a, c1.id);
    const i2 = await invoice(a, c2.id);
    await expect(purchase(a, c1.id, i2.id)).rejects.toThrow(/afinia_card_mismatch/);
    const catB = (await listCategories(b))[0].id;
    await expect(purchase(a, c1.id, i1.id, { categoryId: catB })).rejects.toThrow(/Foreign key|afinia_tenant_mismatch/);
    const p = await purchase(a, c1.id, i1.id);
    await expect(
      db.cardInstallment.create({ data: { householdId: a.householdId, purchaseId: p.id, invoiceId: i2.id, index: 1, amountCents: 10_000 } }),
    ).rejects.toThrow(/afinia_card_mismatch/);
    await expect(
      db.cardInstallment.create({ data: { householdId: a.householdId, purchaseId: p.id, invoiceId: i1.id, index: 1, amountCents: 0 } }),
    ).rejects.toThrow();
    await expect(
      db.cardInstallment.create({ data: { householdId: a.householdId, purchaseId: p.id, invoiceId: i1.id, index: 1, amountCents: 10_000 } }),
    ).resolves.toBeTruthy();
    await expect(
      db.cardInstallment.create({ data: { householdId: a.householdId, purchaseId: p.id, invoiceId: i1.id, index: 1, amountCents: 10_000 } }),
    ).rejects.toThrow();
  });

  it("valida total, número de parcelas e previsão de parcela única", async () => {
    const c = await card(a);
    const i = await invoice(a, c.id);
    await expect(purchase(a, c.id, i.id, { totalCents: 0 })).rejects.toThrow();
    await expect(purchase(a, c.id, i.id, { installmentCount: 49 })).rejects.toThrow();
    await expect(purchase(a, c.id, i.id, { status: "FORECAST", installmentCount: 2 })).rejects.toThrow();
    await expect(purchase(a, c.id, i.id, { installmentCount: 24 })).resolves.toBeTruthy();
  });
});

describe("banco: pagamento de fatura", () => {
  const payment = (over: Record<string, unknown>) =>
    db.transaction.create({
      data: {
        householdId: a.householdId, kind: "CARD_PAYMENT", description: "Pagamento de fatura", amountCents: 5_000, status: "EFFECTIVE",
        dueDate: day("2026-04-17"), effectiveDate: day("2026-04-17"), accountId: corrente, createdById: a.userId, idempotencyKey: crypto.randomUUID(), ...over,
      },
    });

  it("exige fatura do casal, sem categoria, efetivado; recusa conta de benefício", async () => {
    const inv = await invoice(a, (await card(a)).id);
    await expect(payment({ invoiceId: inv.id })).resolves.toBeTruthy();
    await expect(payment({})).rejects.toThrow();
    await expect(payment({ invoiceId: inv.id, categoryId: catA })).rejects.toThrow();
    await expect(payment({ invoiceId: inv.id, status: "PENDING", effectiveDate: null })).rejects.toThrow();
    await expect(payment({ invoiceId: inv.id, accountId: va })).rejects.toThrow(/afinia_benefit_transfer/);
    const invB = await invoice(b, (await card(b)).id);
    await expect(payment({ invoiceId: invB.id })).rejects.toThrow(/Foreign key|afinia_tenant_mismatch/);
  });

  it("lançamentos comuns não podem ter fatura", async () => {
    const inv = await invoice(a, (await card(a)).id);
    await expect(
      payment({ kind: "EXPENSE", categoryId: catA, invoiceId: inv.id }),
    ).rejects.toThrow();
  });

  it("conta que paga fatura não pode virar benefício", async () => {
    const inv = await invoice(a, (await card(a)).id);
    await payment({ invoiceId: inv.id });
    await expect(db.financialAccount.update({ where: { id: corrente }, data: { kind: "BENEFIT", benefitPurpose: "FOOD" } })).rejects.toThrow(/afinia_benefit_transfer/);
  });
});

describe("banco: recorrência com cartão", () => {
  const series = (over: Record<string, unknown>) =>
    db.recurringSeries.create({
      data: { householdId: a.householdId, kind: "EXPENSE", frequency: "MONTHLY", startDate: day("2026-04-05"), endMode: "NONE", createdById: a.userId, idempotencyKey: crypto.randomUUID(), ...over },
    });
  const rule = (seriesId: string, accountId: string | null) =>
    db.recurringRule.create({ data: { seriesId, fromIndex: 0, description: "Streaming", amountCents: 3_990, categoryId: catA, accountId } });

  it("série com cartão exige regra sem conta; sem cartão exige conta; cartão imutável e só despesa", async () => {
    const c = await card(a);
    const s = await series({ cardId: c.id });
    await expect(rule(s.id, corrente)).rejects.toThrow(/afinia_rule_card_mismatch/);
    await expect(rule(s.id, null)).resolves.toBeTruthy();
    const plain = await series({});
    await expect(rule(plain.id, null)).rejects.toThrow(/afinia_rule_card_mismatch/);
    await expect(rule(plain.id, corrente)).resolves.toBeTruthy();
    await expect(db.recurringSeries.update({ where: { id: s.id }, data: { cardId: null } })).rejects.toThrow(/afinia_series_immutable/);
    await expect(series({ kind: "INCOME", cardId: c.id })).rejects.toThrow();
    await expect(series({ cardId: (await card(b)).id })).rejects.toThrow(/Foreign key|afinia_tenant_mismatch/);
  });
});
