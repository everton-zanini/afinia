import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import type { HouseholdContext } from "@/server/households/context";
import { cardSchema, invoicePaymentSchema, purchaseSchema } from "@/lib/validation/cards";
import { recurrenceSchema, transactionSchema } from "@/lib/validation/finance";
import { createAccount, accountsWithBalances } from "./accounts";
import { listCategories } from "./categories";
import { createTransaction } from "./transactions";
import { setBudgetLimit, monthBudget } from "./budgets";
import { createSeries } from "./recurrences";
import { dashboard, reports } from "./reports";
import * as cards from "./cards";
import { resetDatabase } from "../../../test/db";
import { createHouseholdWith } from "../../../test/factories";

// Cenário do resumo de abril (spec do Início): despesa comum, parcela de cartão em fatura que vence
// em abril, pagamento da fatura, R$ 800 ainda devidos em faturas futuras e previsão de assinatura.
const TODAY = "2026-04-20";

let ctx: HouseholdContext;
let corrente: string;
let cat: Record<string, string>;
let cardId: string;

beforeEach(async () => {
  await resetDatabase();
  ctx = (await createHouseholdWith("Casal A")).contexts[0];
  corrente = (await createAccount(ctx, { name: "Conta corrente", kind: "CHECKING", openingBalance: 440_000, openingDate: "2026-01-01" })).id;
  cat = Object.fromEntries((await listCategories(ctx)).map((c) => [c.name, c.id]));

  cardId = (
    await cards.createCard(
      ctx,
      cardSchema.parse({ name: "Cartão roxo", color: "#8a6bb0", limit: "5.000,00", closingDay: "5", dueDay: "15", holderMemberId: ctx.memberId }),
    )
  ).id;

  await createTransaction(
    ctx,
    transactionSchema.parse({
      idempotencyKey: randomUUID(), kind: "EXPENSE", description: "Aluguel", amount: "1.000,00", categoryId: cat["Moradia"],
      accountId: corrente, status: "EFFECTIVE", dueDate: "2026-04-05", effectiveDate: "2026-04-05",
    }),
  );
  // R$ 1.200,00 em 3 parcelas de R$ 400,00 (faturas que vencem em abril, maio e junho)
  await cards.createPurchase(
    ctx,
    purchaseSchema.parse({
      idempotencyKey: randomUUID(), cardId, description: "Tênis", total: "1.200,00", purchaseDate: "2026-03-10",
      categoryId: cat["Lazer"], installmentCount: "3",
    }),
    TODAY,
  );
  const aprilInvoice = (await cards.getCardDetail(ctx, cardId, null, TODAY)).invoices[0];
  await cards.payInvoice(
    ctx,
    invoicePaymentSchema.parse({ idempotencyKey: randomUUID(), invoiceId: aprilInvoice.id, accountId: corrente, date: "2026-04-15", amount: "400,00" }),
    TODAY,
  );
});

describe("reconciliação das três visões", () => {
  it("Início de abril: gastos com cartão identificados, pagamento fora dos gastos, dívida e saldo", async () => {
    const d = await dashboard(ctx, "2026-04", TODAY);
    expect(d.current).toMatchObject({ expenseRealized: 140_000, expenseCard: 40_000, cardPayments: 40_000 });
    expect(d.cardDebtCents).toBe(80_000);
    expect(d.generalBalanceCents).toBe(300_000);
    expect(d.totalBalanceCents).toBe(300_000);
    expect(d.cards[0]).toMatchObject({ name: "Cartão roxo", committedCents: 80_000 });
    expect(d.cards[0].nextDue?.dueDate).toBe("2026-05-15");
    const moradiaESuas = d.topCategories.map((c) => [c.name, c.amountCents]);
    expect(moradiaESuas).toEqual([["Moradia", 100_000], ["Lazer", 40_000]]);
  });

  it("saldo da conta: compra não reduz, pagamento reduz uma vez", async () => {
    const acc = (await accountsWithBalances(ctx)).find((a) => a.id === corrente)!;
    expect(acc.balanceCents).toBe(440_000 - 100_000 - 40_000);
  });

  it("limite: comprometido = parcelas − pagamentos, disponível = limite − comprometido", async () => {
    const c = await cards.getCardSummary(ctx, cardId, TODAY);
    expect(c.limit).toMatchObject({ committedCents: 80_000, availableCents: 420_000, over: false });
  });

  it("orçamento: parcela distribui o consumo por mês de vencimento e o pagamento não soma", async () => {
    await setBudgetLimit(ctx, "2026-04", cat["Lazer"], 100_000);
    await setBudgetLimit(ctx, "2026-05", cat["Lazer"], 100_000);
    const april = await monthBudget(ctx, "2026-04");
    const may = await monthBudget(ctx, "2026-05");
    expect(april.rows.find((r) => r.categoryId === cat["Lazer"])).toMatchObject({ realizedCents: 40_000, pendingCents: 0 });
    expect(may.rows.find((r) => r.categoryId === cat["Lazer"])).toMatchObject({ realizedCents: 40_000, pendingCents: 0 });
  });

  it("previsão de assinatura no cartão: pendente no orçamento do mês da fatura sugerida, sem limite", async () => {
    await createSeries(
      ctx,
      transactionSchema.parse({
        idempotencyKey: randomUUID(), kind: "EXPENSE", description: "Streaming", amount: "55,90", categoryId: cat["Assinaturas"],
        accountId: "card", status: "PENDING", dueDate: "2026-05-10",
      }),
      recurrenceSchema.parse({ frequency: "MONTHLY", endMode: "NONE", cardId }),
      TODAY,
    );
    await setBudgetLimit(ctx, "2026-05", cat["Assinaturas"], 10_000);
    const may = await monthBudget(ctx, "2026-05");
    // 10/05 cai na fatura que fecha em 05/06 e vence em 15/06; a de maio (fecha 05/05) não a contém.
    expect(may.rows.find((r) => r.categoryId === cat["Assinaturas"])).toMatchObject({ realizedCents: 0, pendingCents: 0 });
    const june = await monthBudget(ctx, "2026-06");
    expect(june.withoutLimit.find((r) => r.id === cat["Assinaturas"])).toMatchObject({ pendingCents: 5_590 });
    expect((await cards.getCardSummary(ctx, cardId, TODAY)).limit.committedCents).toBe(80_000);
    expect((await dashboard(ctx, "2026-04", TODAY)).cardDebtCents).toBe(80_000);
  });

  it("relatórios: categorias incluem a parcela sem o pagamento; evolução do saldo só cai no pagamento", async () => {
    const r = await reports(ctx, { month: "2026-04", today: "2026-04-30" });
    expect(r.byCategory.totalCents).toBe(140_000);
    expect(r.byCategory.slices.map((s) => [s.name, s.amountCents])).toEqual([["Moradia", 100_000], ["Lazer", 40_000]]);
    const at = (date: string) => r.evolution.points.find((p) => p.date === date)!.balanceCents;
    expect(at("2026-04-14")).toBe(340_000);
    expect(at("2026-04-15")).toBe(300_000);
    // Com filtro por conta, o gasto do cartão não é atribuído à conta.
    const byAccount = await reports(ctx, { month: "2026-04", accountId: corrente, today: "2026-04-30" });
    expect(byAccount.byCategory.totalCents).toBe(100_000);
  });
});
