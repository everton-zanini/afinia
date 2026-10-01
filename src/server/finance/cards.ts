import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { DomainError, NotFoundError } from "@/server/errors";
import type { HouseholdContext } from "@/server/households/context";
import { addDays, fromDbDate, isISODate, todayISO, toDbDate, type ISODate } from "@/lib/dates";
import {
  CLOSING_PREFIX,
  cyclesNeededFor,
  invoiceStatus,
  limitView,
  nextCycle,
  splitInstallments,
  type Cycle,
  type InvoiceStatus,
  type LimitView,
} from "@/lib/finance/cards";
import { CARD_MOVEMENT_PREFIX, type Movement } from "@/lib/finance/types";
import type { CardInput, ConfirmForecastInput, InvoicePaymentInput, PurchaseInput } from "@/lib/validation/cards";
import { isUniqueViolation } from "./common";

// Cartões de crédito: cartão → fatura (datas gravadas) → compra → parcela; pagamento é um
// lançamento CARD_PAYMENT. Situação, saldo devedor e limite são sempre derivados na consulta.

type Tx = Prisma.TransactionClient;
type DbClient = Tx | typeof db;

const MAX_PAST_YEARS = 5;

export const INVOICE_PAID_HINT = "Há pagamento registrado na fatura desta compra. Se foi um erro de cadastro, desfaça o pagamento antes.";

// ---------------------------------------------------------------------------
// Cartões
// ---------------------------------------------------------------------------

async function loadCard(ctx: HouseholdContext, cardId: string, client: DbClient = db) {
  const card = await client.creditCard.findFirst({ where: { id: cardId, householdId: ctx.householdId } });
  if (!card) throw new NotFoundError();
  return card;
}

async function validateCardRefs(ctx: HouseholdContext, input: CardInput, keepingAccountId: string | null) {
  if (!ctx.members.some((m) => m.memberId === input.holderMemberId)) throw new NotFoundError();
  if (!input.paymentAccountId) return;
  const account = await db.financialAccount.findFirst({
    where: { id: input.paymentAccountId, householdId: ctx.householdId },
    select: { kind: true, archivedAt: true },
  });
  if (!account) throw new NotFoundError();
  if (account.kind === "BENEFIT") throw new DomainError("Contas de benefício não podem pagar fatura", "paymentAccountId");
  if (account.archivedAt && keepingAccountId !== input.paymentAccountId) {
    throw new DomainError("Esta conta está arquivada", "paymentAccountId");
  }
}

function cardData(input: CardInput) {
  return {
    name: input.name,
    issuer: input.issuer,
    lastFour: input.lastFour,
    color: input.color,
    limitCents: input.limit,
    closingDay: input.closingDay,
    dueDay: input.dueDay,
    holderMemberId: input.holderMemberId,
    paymentAccountId: input.paymentAccountId,
  };
}

export async function createCard(ctx: HouseholdContext, input: CardInput) {
  await validateCardRefs(ctx, input, null);
  const card = await db.creditCard.create({ data: { ...cardData(input), householdId: ctx.householdId }, select: { id: true } });
  return { id: card.id };
}

/** Os dias de fechamento/vencimento só valem para faturas criadas depois da alteração. */
export async function updateCard(ctx: HouseholdContext, cardId: string, input: CardInput) {
  const card = await loadCard(ctx, cardId);
  await validateCardRefs(ctx, input, card.paymentAccountId);
  await db.creditCard.update({ where: { id: card.id, householdId: ctx.householdId }, data: cardData(input) });
}

export async function setCardArchived(ctx: HouseholdContext, cardId: string, archived: boolean) {
  const card = await loadCard(ctx, cardId);
  await db.creditCard.update({
    where: { id: card.id, householdId: ctx.householdId },
    data: { archivedAt: archived ? (card.archivedAt ?? new Date()) : null },
  });
}

// ---------------------------------------------------------------------------
// Faturas: sequência determinística, criada sob lock do cartão
// ---------------------------------------------------------------------------

type CardDaysRow = { id: string; householdId: string; closingDay: number; dueDay: number };
type InvoiceRow = { id: string; cardId: string; periodStart: Date; closingDate: Date; dueDate: Date };

const asCycle = (i: InvoiceRow): Cycle => ({
  periodStart: fromDbDate(i.periodStart),
  closingDate: fromDbDate(i.closingDate),
  dueDate: fromDbDate(i.dueDate),
});

export async function lockCard(tx: Tx, cardId: string) {
  await tx.$queryRaw`SELECT id FROM "credit_card" WHERE id = ${cardId} FOR UPDATE`;
}

async function insertCycles(tx: Tx, card: CardDaysRow, cycles: Cycle[]) {
  await tx.cardInvoice.createMany({
    data: cycles.map((c) => ({
      householdId: card.householdId,
      cardId: card.id,
      periodStart: toDbDate(c.periodStart),
      closingDate: toDbDate(c.closingDate),
      dueDate: toDbDate(c.dueDate),
    })),
    skipDuplicates: true,
  });
}

/** Fatura do cartão cujo ciclo contém a data; cria a sequência que faltar (exige o lock do cartão). */
export async function ensureInvoiceFor(tx: Tx, card: CardDaysRow, date: ISODate): Promise<InvoiceRow> {
  const containing = () =>
    tx.cardInvoice.findFirst({ where: { cardId: card.id, periodStart: { lte: toDbDate(date) }, closingDate: { gte: toDbDate(date) } } });
  const found = await containing();
  if (found) return found;

  const [first, last] = await Promise.all([
    tx.cardInvoice.findFirst({ where: { cardId: card.id }, orderBy: { closingDate: "asc" } }),
    tx.cardInvoice.findFirst({ where: { cardId: card.id }, orderBy: { closingDate: "desc" } }),
  ]);
  const cycles = cyclesNeededFor(
    date,
    { first: first ? asCycle(first) : null, last: last ? asCycle(last) : null },
    card,
  );
  await insertCycles(tx, card, cycles);
  const created = await containing();
  if (!created) throw new Error("Não foi possível determinar a fatura do cartão");
  return created;
}

/** As `n` faturas seguintes a `invoice`, criando as que faltarem (exige o lock do cartão). */
export async function ensureInvoicesAfter(tx: Tx, card: CardDaysRow, invoice: InvoiceRow, n: number): Promise<InvoiceRow[]> {
  if (n <= 0) return [];
  const existing = await tx.cardInvoice.findMany({
    where: { cardId: card.id, closingDate: { gt: invoice.closingDate } },
    orderBy: { closingDate: "asc" },
    take: n,
  });
  if (existing.length < n) {
    let prev = asCycle(existing.at(-1) ?? invoice);
    const cycles: Cycle[] = [];
    for (let i = existing.length; i < n; i++) {
      prev = nextCycle(prev, card);
      cycles.push(prev);
    }
    await insertCycles(tx, card, cycles);
    return tx.cardInvoice.findMany({
      where: { cardId: card.id, closingDate: { gt: invoice.closingDate } },
      orderBy: { closingDate: "asc" },
      take: n,
    });
  }
  return existing;
}

type Totals = { totalCents: number; paidCents: number };

async function invoiceTotals(client: DbClient, householdId: string, invoiceIds: string[]): Promise<Map<string, Totals>> {
  const out = new Map<string, Totals>(invoiceIds.map((id) => [id, { totalCents: 0, paidCents: 0 }]));
  if (invoiceIds.length === 0) return out;
  const [installments, payments] = await Promise.all([
    client.cardInstallment.groupBy({ by: ["invoiceId"], where: { householdId, invoiceId: { in: invoiceIds } }, _sum: { amountCents: true } }),
    client.transaction.groupBy({
      by: ["invoiceId"],
      where: { householdId, kind: "CARD_PAYMENT", invoiceId: { in: invoiceIds } },
      _sum: { amountCents: true },
    }),
  ]);
  for (const r of installments) out.get(r.invoiceId)!.totalCents = r._sum.amountCents ?? 0;
  for (const r of payments) out.get(r.invoiceId!)!.paidCents = r._sum.amountCents ?? 0;
  return out;
}

/** Fatura sugerida para a data: a do ciclo que a contém ou a próxima se aquela já estiver quitada. */
async function suggestInvoice(tx: Tx, card: CardDaysRow, date: ISODate): Promise<InvoiceRow> {
  let invoice = await ensureInvoiceFor(tx, card, date);
  for (let i = 0; i < 60; i++) {
    const totals = (await invoiceTotals(tx, card.householdId, [invoice.id])).get(invoice.id)!;
    if (!(totals.totalCents > 0 && totals.paidCents >= totals.totalCents)) return invoice;
    [invoice] = await ensureInvoicesAfter(tx, card, invoice, 1);
  }
  return invoice;
}

export type InvoiceSummary = {
  id: string;
  cardId: string;
  periodStart: ISODate;
  closingDate: ISODate;
  dueDate: ISODate;
  status: InvoiceStatus;
};

function toInvoiceSummary(i: InvoiceRow, t: Totals, today: ISODate): InvoiceSummary {
  const c = asCycle(i);
  return { id: i.id, cardId: i.cardId, ...c, status: invoiceStatus(c, t.totalCents, t.paidCents, today) };
}

// ---------------------------------------------------------------------------
// Consulta: cartões, limite e faturas
// ---------------------------------------------------------------------------

export type CardSummary = {
  id: string;
  name: string;
  issuer: string | null;
  lastFour: string | null;
  color: string;
  limitCents: number;
  closingDay: number;
  dueDay: number;
  holder: { memberId: string; name: string } | null;
  paymentAccount: { id: string; name: string } | null;
  archived: boolean;
  limit: LimitView;
  /** Fatura cujo ciclo contém hoje (pode não existir ainda). */
  currentInvoice: InvoiceSummary | null;
  /** Fatura com saldo devedor de vencimento mais próximo (inclui atrasadas). */
  nextDue: InvoiceSummary | null;
};

export async function listCards(ctx: HouseholdContext, today: ISODate = todayISO()): Promise<CardSummary[]> {
  const [cards, invoices] = await Promise.all([
    db.creditCard.findMany({ where: { householdId: ctx.householdId }, orderBy: [{ archivedAt: { sort: "asc", nulls: "first" } }, { name: "asc" }], include: { paymentAccount: { select: { id: true, name: true } } } }),
    db.cardInvoice.findMany({ where: { householdId: ctx.householdId }, orderBy: { closingDate: "asc" } }),
  ]);
  const totals = await invoiceTotals(db, ctx.householdId, invoices.map((i) => i.id));
  return cards.map((card) => {
    const mine = invoices.filter((i) => i.cardId === card.id).map((i) => toInvoiceSummary(i, totals.get(i.id)!, today));
    const installments = mine.reduce((s, i) => s + i.status.totalCents, 0);
    const payments = mine.reduce((s, i) => s + i.status.paidCents, 0);
    const holder = ctx.members.find((m) => m.memberId === card.holderMemberId);
    return {
      id: card.id,
      name: card.name,
      issuer: card.issuer,
      lastFour: card.lastFour,
      color: card.color,
      limitCents: card.limitCents,
      closingDay: card.closingDay,
      dueDay: card.dueDay,
      holder: holder ? { memberId: holder.memberId, name: holder.name } : null,
      paymentAccount: card.paymentAccount,
      archived: !!card.archivedAt,
      limit: limitView(card.limitCents, installments, payments),
      currentInvoice: mine.find((i) => i.periodStart <= today && today <= i.closingDate) ?? null,
      nextDue: mine.find((i) => i.status.remainingCents > 0) ?? null,
    };
  });
}

export async function getCardSummary(ctx: HouseholdContext, cardId: string, today: ISODate = todayISO()) {
  await loadCard(ctx, cardId);
  const card = (await listCards(ctx, today)).find((c) => c.id === cardId);
  if (!card) throw new NotFoundError();
  return card;
}

export type InstallmentLine = {
  id: string;
  purchaseId: string;
  description: string;
  index: number;
  count: number;
  amountCents: number;
  purchaseDate: ISODate;
  category: { id: string; name: string; color: string };
  responsible: string | null;
};

export type ForecastLine = {
  id: string;
  description: string;
  amountCents: number;
  expectedDate: ISODate;
  category: { id: string; name: string; color: string };
};

export type PaymentLine = {
  id: string;
  amountCents: number;
  date: ISODate;
  account: { id: string; name: string };
  createdBy: string;
};

export type CardDetail = {
  card: CardSummary;
  invoices: InvoiceSummary[];
  invoice: (InvoiceSummary & {
    installments: InstallmentLine[];
    forecasts: ForecastLine[];
    payments: PaymentLine[];
    byCategory: { categoryId: string; name: string; color: string; amountCents: number }[];
    hasPayments: boolean;
    previousId: string | null;
    nextId: string | null;
  }) | null;
  /** Compromissos das faturas que ainda vencem (a partir de hoje) com parcelas confirmadas. */
  upcoming: { invoiceId: string; dueDate: ISODate; totalCents: number; remainingCents: number }[];
};

/** Detalhe do cartão com a fatura escolhida (padrão: a do ciclo atual ou a mais próxima). */
export async function getCardDetail(ctx: HouseholdContext, cardId: string, invoiceId: string | null, today: ISODate = todayISO()): Promise<CardDetail> {
  const card = await getCardSummary(ctx, cardId, today);
  const rows = await db.cardInvoice.findMany({ where: { cardId, householdId: ctx.householdId }, orderBy: { closingDate: "asc" } });
  const totals = await invoiceTotals(db, ctx.householdId, rows.map((i) => i.id));
  const invoices = rows.map((i) => toInvoiceSummary(i, totals.get(i.id)!, today));
  const selected =
    invoices.find((i) => i.id === invoiceId) ??
    card.currentInvoice ??
    invoices.find((i) => i.status.remainingCents > 0) ??
    invoices.at(-1) ??
    null;
  const upcoming = invoices
    .filter((i) => i.dueDate >= today && i.status.totalCents > 0)
    .map((i) => ({ invoiceId: i.id, dueDate: i.dueDate, totalCents: i.status.totalCents, remainingCents: i.status.remainingCents }));
  if (!selected) return { card, invoices, invoice: null, upcoming };

  const [installments, forecasts, payments] = await Promise.all([
    db.cardInstallment.findMany({
      where: { householdId: ctx.householdId, invoiceId: selected.id },
      orderBy: [{ purchase: { purchaseDate: "desc" } }, { index: "asc" }],
      include: { purchase: { include: { category: { select: { id: true, name: true, color: true } } } } },
    }),
    db.cardPurchase.findMany({
      where: { householdId: ctx.householdId, invoiceId: selected.id, status: "FORECAST" },
      orderBy: { purchaseDate: "asc" },
      include: { category: { select: { id: true, name: true, color: true } } },
    }),
    db.transaction.findMany({
      where: { householdId: ctx.householdId, kind: "CARD_PAYMENT", invoiceId: selected.id },
      orderBy: [{ effectiveDate: "desc" }, { createdAt: "desc" }],
      include: { account: { select: { id: true, name: true } }, createdBy: { select: { name: true } } },
    }),
  ]);
  const lines: InstallmentLine[] = installments.map((i) => ({
    id: i.id,
    purchaseId: i.purchaseId,
    description: i.purchase.description,
    index: i.index,
    count: i.purchase.installmentCount,
    amountCents: i.amountCents,
    purchaseDate: fromDbDate(i.purchase.purchaseDate),
    category: i.purchase.category,
    responsible: ctx.members.find((m) => m.memberId === i.purchase.responsibleMemberId)?.name ?? null,
  }));
  const byCat = new Map<string, { categoryId: string; name: string; color: string; amountCents: number }>();
  for (const l of lines) {
    const cur = byCat.get(l.category.id) ?? { categoryId: l.category.id, name: l.category.name, color: l.category.color, amountCents: 0 };
    cur.amountCents += l.amountCents;
    byCat.set(l.category.id, cur);
  }
  const pos = invoices.findIndex((i) => i.id === selected.id);
  return {
    card,
    invoices,
    invoice: {
      ...selected,
      installments: lines,
      forecasts: forecasts.map((f) => ({
        id: f.id,
        description: f.description,
        amountCents: f.totalCents,
        expectedDate: fromDbDate(f.purchaseDate),
        category: f.category,
      })),
      payments: payments.map((p) => ({
        id: p.id,
        amountCents: p.amountCents,
        date: fromDbDate(p.effectiveDate!),
        account: p.account,
        createdBy: p.createdBy.name,
      })),
      byCategory: [...byCat.values()].sort((a, b) => b.amountCents - a.amountCents),
      hasPayments: payments.length > 0,
      previousId: invoices[pos - 1]?.id ?? null,
      nextId: invoices[pos + 1]?.id ?? null,
    },
    upcoming,
  };
}

/** Faturas não quitadas do cartão para escolher a fatura inicial/destino (inclui as já criadas). */
export async function selectableInvoices(ctx: HouseholdContext, cardId: string, today: ISODate = todayISO()) {
  await loadCard(ctx, cardId);
  const rows = await db.cardInvoice.findMany({ where: { cardId, householdId: ctx.householdId }, orderBy: { closingDate: "asc" } });
  const totals = await invoiceTotals(db, ctx.householdId, rows.map((i) => i.id));
  return rows
    .map((i) => toInvoiceSummary(i, totals.get(i.id)!, today))
    .filter((i) => i.status.payment !== "paid" && i.closingDate >= addDays(today, -400));
}

/** Fatura que seria sugerida para a data (sem criá-la): usada pela prévia da interface. */
export async function previewSuggestedInvoice(ctx: HouseholdContext, cardId: string, date: ISODate) {
  const card = await loadCard(ctx, cardId);
  return db.$transaction(async (tx) => {
    await lockCard(tx, card.id);
    const inv = await suggestInvoice(tx, card, date);
    return { id: inv.id, ...asCycle(inv) };
  });
}

// ---------------------------------------------------------------------------
// Compras
// ---------------------------------------------------------------------------

function assertPurchaseDate(date: ISODate, today: ISODate) {
  if (date > today) throw new DomainError("A data da compra não pode ser futura", "purchaseDate");
  if (date < addDays(today, -365 * MAX_PAST_YEARS)) throw new DomainError("A data da compra é anterior a 5 anos", "purchaseDate");
}

async function validatePurchaseRefs(ctx: HouseholdContext, input: PurchaseInput, keeping: { categoryId: string } | null) {
  const category = await db.category.findFirst({
    where: { id: input.categoryId, householdId: ctx.householdId },
    select: { kind: true, archivedAt: true },
  });
  if (!category) throw new NotFoundError();
  if (category.kind !== "EXPENSE") throw new DomainError("Escolha uma categoria de despesa", "categoryId");
  if (category.archivedAt && keeping?.categoryId !== input.categoryId) throw new DomainError("Esta categoria está arquivada", "categoryId");
  if (input.responsibleMemberId && !ctx.members.some((m) => m.memberId === input.responsibleMemberId)) throw new NotFoundError();
}

function planInstallments(input: PurchaseInput) {
  const parts = splitInstallments(input.total, input.installmentCount);
  if (!parts) throw new DomainError("O valor não permite essa quantidade de parcelas", "installmentCount");
  return parts;
}

/** Fatura inicial escolhida (mesmo cartão, não quitada) ou a sugerida pela data. */
async function startInvoice(tx: Tx, card: CardDaysRow, input: Pick<PurchaseInput, "invoiceId" | "purchaseDate">) {
  if (!input.invoiceId) return suggestInvoice(tx, card, input.purchaseDate);
  let chosen: InvoiceRow | null;
  if (input.invoiceId.startsWith(CLOSING_PREFIX)) {
    // Fatura ainda não criada (ex.: a seguinte): identificada pela data de fechamento do ciclo.
    const closing = input.invoiceId.slice(CLOSING_PREFIX.length);
    if (!isISODate(closing)) throw new NotFoundError();
    chosen = await ensureInvoiceFor(tx, card, closing);
  } else {
    chosen = await tx.cardInvoice.findFirst({ where: { id: input.invoiceId, cardId: card.id, householdId: card.householdId } });
  }
  if (!chosen) throw new NotFoundError();
  const totals = (await invoiceTotals(tx, card.householdId, [chosen.id])).get(chosen.id)!;
  if (totals.totalCents > 0 && totals.paidCents >= totals.totalCents) {
    throw new DomainError("Esta fatura já está quitada. Escolha outra fatura.", "invoiceId");
  }
  return chosen;
}

async function writeInstallments(tx: Tx, card: CardDaysRow, purchaseId: string, parts: number[], first: InvoiceRow) {
  const invoices = [first, ...(await ensureInvoicesAfter(tx, card, first, parts.length - 1))];
  await tx.cardInstallment.createMany({
    data: parts.map((amountCents, i) => ({
      householdId: card.householdId,
      purchaseId,
      invoiceId: invoices[i].id,
      index: i + 1,
      amountCents,
    })),
  });
}

async function overLimit(client: DbClient, ctx: HouseholdContext, cardId: string, limitCents: number) {
  const invoices = await client.cardInvoice.findMany({ where: { cardId, householdId: ctx.householdId }, select: { id: true } });
  const totals = await invoiceTotals(client, ctx.householdId, invoices.map((i) => i.id));
  let installments = 0;
  let payments = 0;
  for (const t of totals.values()) {
    installments += t.totalCents;
    payments += t.paidCents;
  }
  return limitView(limitCents, installments, payments).over;
}

/**
 * Registra a compra e todas as parcelas numa transação. Reenvio com a mesma chave devolve a
 * compra existente. Não movimenta nenhuma conta. O estouro de limite apenas avisa.
 */
export async function createPurchase(ctx: HouseholdContext, input: PurchaseInput, today: ISODate = todayISO()) {
  const again = async () => {
    const p = await db.cardPurchase.findUnique({
      where: { householdId_idempotencyKey: { householdId: ctx.householdId, idempotencyKey: input.idempotencyKey } },
      select: { id: true },
    });
    return p ? { id: p.id, created: false, overLimit: false } : null;
  };
  const existing = await again();
  if (existing) return existing;

  const card = await loadCard(ctx, input.cardId);
  if (card.archivedAt) throw new DomainError("Este cartão está arquivado e não aceita novas compras");
  assertPurchaseDate(input.purchaseDate, today);
  await validatePurchaseRefs(ctx, input, null);
  const parts = planInstallments(input);

  try {
    const id = await db.$transaction(async (tx) => {
      await lockCard(tx, card.id);
      const first = await startInvoice(tx, card, input);
      const purchase = await tx.cardPurchase.create({
        data: {
          householdId: ctx.householdId,
          cardId: card.id,
          status: "CONFIRMED",
          description: input.description,
          totalCents: input.total,
          purchaseDate: toDbDate(input.purchaseDate),
          categoryId: input.categoryId,
          responsibleMemberId: input.responsibleMemberId,
          notes: input.notes,
          installmentCount: parts.length,
          invoiceId: first.id,
          createdById: ctx.userId,
          idempotencyKey: input.idempotencyKey,
        },
        select: { id: true },
      });
      await writeInstallments(tx, card, purchase.id, parts, first);
      return purchase.id;
    });
    return { id, created: true, overLimit: await overLimit(db, ctx, card.id, card.limitCents) };
  } catch (error) {
    if (isUniqueViolation(error, "idempotencyKey")) return (await again())!;
    throw error;
  }
}

export type PurchaseDetail = {
  id: string;
  cardId: string;
  cardName: string;
  cardArchived: boolean;
  description: string;
  totalCents: number;
  purchaseDate: ISODate;
  categoryId: string;
  responsibleMemberId: string | null;
  notes: string | null;
  installmentCount: number;
  startInvoiceId: string;
  createdBy: string;
  /** Alguma parcela está em fatura com pagamento: só descrição, categoria, responsável e observação mudam. */
  locked: boolean;
  seriesId: string | null;
  installments: { id: string; index: number; amountCents: number; invoice: InvoiceSummary; hasPayments: boolean }[];
};

export async function getPurchase(ctx: HouseholdContext, id: string, today: ISODate = todayISO()): Promise<PurchaseDetail> {
  const p = await db.cardPurchase.findFirst({
    where: { id, householdId: ctx.householdId, status: "CONFIRMED" },
    include: {
      card: { select: { name: true, archivedAt: true } },
      createdBy: { select: { name: true } },
      installments: { orderBy: { index: "asc" }, include: { invoice: true } },
    },
  });
  if (!p) throw new NotFoundError();
  const invoiceIds = [...new Set(p.installments.map((i) => i.invoiceId))];
  const totals = await invoiceTotals(db, ctx.householdId, invoiceIds);
  return {
    id: p.id,
    cardId: p.cardId,
    cardName: p.card.name,
    cardArchived: !!p.card.archivedAt,
    description: p.description,
    totalCents: p.totalCents,
    purchaseDate: fromDbDate(p.purchaseDate),
    categoryId: p.categoryId,
    responsibleMemberId: p.responsibleMemberId,
    notes: p.notes,
    installmentCount: p.installmentCount,
    startInvoiceId: p.installments[0]?.invoiceId ?? p.invoiceId,
    createdBy: p.createdBy.name,
    locked: invoiceIds.some((i) => totals.get(i)!.paidCents > 0),
    seriesId: p.seriesId,
    installments: p.installments.map((i) => ({
      id: i.id,
      index: i.index,
      amountCents: i.amountCents,
      invoice: toInvoiceSummary(i.invoice, totals.get(i.invoiceId)!, today),
      hasPayments: totals.get(i.invoiceId)!.paidCents > 0,
    })),
  };
}

/** Edita a compra. Com pagamentos associados só descrição, categoria, responsável e observação mudam. */
export async function updatePurchase(ctx: HouseholdContext, id: string, input: PurchaseInput, today: ISODate = todayISO()) {
  const current = await getPurchase(ctx, id, today);
  await validatePurchaseRefs(ctx, input, { categoryId: current.categoryId });
  const textual = { description: input.description, categoryId: input.categoryId, responsibleMemberId: input.responsibleMemberId, notes: input.notes };

  if (current.locked) {
    const sameInvoice = !input.invoiceId || input.invoiceId === current.startInvoiceId;
    if (input.total !== current.totalCents || input.installmentCount !== current.installmentCount || input.purchaseDate !== current.purchaseDate || !sameInvoice) {
      throw new DomainError(INVOICE_PAID_HINT);
    }
    await db.cardPurchase.update({ where: { id, householdId: ctx.householdId }, data: textual });
    return;
  }

  if (current.cardArchived && (input.total !== current.totalCents || input.installmentCount !== current.installmentCount || input.purchaseDate !== current.purchaseDate)) {
    throw new DomainError("Este cartão está arquivado e não aceita novas parcelas");
  }
  assertPurchaseDate(input.purchaseDate, today);
  const parts = planInstallments(input);
  const card = await loadCard(ctx, current.cardId);
  await db.$transaction(async (tx) => {
    await lockCard(tx, card.id);
    // Revalida sob o lock: um pagamento concorrente passa a bloquear a alteração.
    const paid = await tx.transaction.count({
      where: { householdId: ctx.householdId, kind: "CARD_PAYMENT", invoiceId: { in: current.installments.map((i) => i.invoice.id) } },
    });
    if (paid > 0) throw new DomainError(INVOICE_PAID_HINT);
    const first = await startInvoice(tx, card, input);
    await tx.cardInstallment.deleteMany({ where: { purchaseId: id, householdId: ctx.householdId } });
    await tx.cardPurchase.update({
      where: { id, householdId: ctx.householdId },
      data: { ...textual, totalCents: input.total, purchaseDate: toDbDate(input.purchaseDate), installmentCount: parts.length, invoiceId: first.id },
    });
    await writeInstallments(tx, card, id, parts, first);
  });
}

export async function deletePurchase(ctx: HouseholdContext, id: string, today: ISODate = todayISO()) {
  const current = await getPurchase(ctx, id, today);
  await db.$transaction(async (tx) => {
    await lockCard(tx, current.cardId);
    const paid = await tx.transaction.count({
      where: { householdId: ctx.householdId, kind: "CARD_PAYMENT", invoiceId: { in: current.installments.map((i) => i.invoice.id) } },
    });
    if (paid > 0) throw new DomainError(INVOICE_PAID_HINT);
    await tx.cardPurchase.delete({ where: { id, householdId: ctx.householdId } });
  });
}

/** Move uma parcela para outra fatura não quitada do mesmo cartão (origem e destino sem pagamentos). */
export async function moveInstallment(ctx: HouseholdContext, installmentId: string, targetInvoiceId: string) {
  const inst = await db.cardInstallment.findFirst({
    where: { id: installmentId, householdId: ctx.householdId },
    include: { purchase: { select: { cardId: true } } },
  });
  if (!inst) throw new NotFoundError();
  const target = await db.cardInvoice.findFirst({ where: { id: targetInvoiceId, householdId: ctx.householdId } });
  if (!target) throw new NotFoundError();
  if (target.cardId !== inst.purchase.cardId) throw new DomainError("A fatura precisa ser do mesmo cartão da compra", "invoiceId");
  if (target.id === inst.invoiceId) return;
  await db.$transaction(async (tx) => {
    await lockCard(tx, inst.purchase.cardId);
    const totals = await invoiceTotals(tx, ctx.householdId, [inst.invoiceId, target.id]);
    if (totals.get(inst.invoiceId)!.paidCents > 0 || totals.get(target.id)!.paidCents > 0) {
      throw new DomainError("Não é possível remanejar parcelas de ou para faturas com pagamento. Se foi um erro de cadastro, desfaça o pagamento antes.");
    }
    await tx.cardInstallment.update({ where: { id: inst.id, householdId: ctx.householdId }, data: { invoiceId: target.id } });
  });
}

// ---------------------------------------------------------------------------
// Pagamento de fatura
// ---------------------------------------------------------------------------

const brl = (cents: number) => `R$ ${(cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Registra o pagamento (parcial ou total, até o saldo devedor). Atômico: o lock da fatura
 * serializa pagamentos simultâneos e a chave de idempotência evita duplicidade no reenvio.
 */
export async function payInvoice(ctx: HouseholdContext, input: InvoicePaymentInput, today: ISODate = todayISO()) {
  const existing = async () => {
    const t = await db.transaction.findUnique({
      where: { householdId_idempotencyKey: { householdId: ctx.householdId, idempotencyKey: input.idempotencyKey } },
      select: { id: true },
    });
    return t ? { id: t.id, created: false } : null;
  };
  const done = await existing();
  if (done) return done;

  const invoice = await db.cardInvoice.findFirst({ where: { id: input.invoiceId, householdId: ctx.householdId }, include: { card: { select: { name: true } } } });
  if (!invoice) throw new NotFoundError();
  const account = await db.financialAccount.findFirst({
    where: { id: input.accountId, householdId: ctx.householdId },
    select: { kind: true, archivedAt: true, openingDate: true, name: true },
  });
  if (!account) throw new NotFoundError();
  if (account.kind === "BENEFIT") throw new DomainError("Contas de benefício não podem pagar fatura", "accountId");
  if (account.archivedAt) throw new DomainError(`A conta "${account.name}" está arquivada`, "accountId");
  if (input.date > today) throw new DomainError("A data de pagamento não pode ser futura", "date");
  if (input.date < fromDbDate(account.openingDate)) {
    throw new DomainError(`A data de pagamento é anterior à abertura da conta "${account.name}"`, "date");
  }

  try {
    const id = await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "card_invoice" WHERE id = ${invoice.id} FOR UPDATE`;
      const t = (await invoiceTotals(tx, ctx.householdId, [invoice.id])).get(invoice.id)!;
      const remaining = t.totalCents - t.paidCents;
      if (remaining <= 0) throw new DomainError("Esta fatura não tem saldo devedor", "amount");
      if (input.amount > remaining) throw new DomainError(`O valor excede o saldo devedor da fatura (${brl(remaining)})`, "amount");
      const created = await tx.transaction.create({
        data: {
          householdId: ctx.householdId,
          kind: "CARD_PAYMENT",
          status: "EFFECTIVE",
          description: `Pagamento de fatura · ${invoice.card.name}`,
          amountCents: input.amount,
          accountId: input.accountId,
          invoiceId: invoice.id,
          dueDate: toDbDate(input.date),
          effectiveDate: toDbDate(input.date),
          createdById: ctx.userId,
          idempotencyKey: input.idempotencyKey,
        },
        select: { id: true },
      });
      return created.id;
    });
    return { id, created: true };
  } catch (error) {
    if (isUniqueViolation(error, "idempotencyKey")) return (await existing())!;
    throw error;
  }
}

/** Desfaz um pagamento: apaga o lançamento; saldos e saldo devedor são derivados e voltam ao anterior. */
export async function undoPayment(ctx: HouseholdContext, transactionId: string) {
  const payment = await db.transaction.findFirst({
    where: { id: transactionId, householdId: ctx.householdId, kind: "CARD_PAYMENT" },
    select: { id: true, invoiceId: true },
  });
  if (!payment?.invoiceId) throw new NotFoundError();
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "card_invoice" WHERE id = ${payment.invoiceId} FOR UPDATE`;
    await tx.transaction.deleteMany({ where: { id: payment.id, householdId: ctx.householdId, kind: "CARD_PAYMENT" } });
  });
}

// ---------------------------------------------------------------------------
// Integração com as regras puras (orçamento, relatórios, Início)
// ---------------------------------------------------------------------------

/**
 * Gastos de cartão como movimentos para as regras puras: parcelas confirmadas são despesas
 * efetivadas no vencimento da fatura; previsões são pendentes no vencimento da fatura sugerida.
 * O accountId "card:<id>" não é uma conta, então nada disso afeta saldo de conta.
 */
export async function cardMovements(ctx: HouseholdContext, opts: { from?: ISODate; to?: ISODate } = {}): Promise<Movement[]> {
  const due = {
    ...(opts.from ? { gte: toDbDate(opts.from) } : {}),
    ...(opts.to ? { lte: toDbDate(opts.to) } : {}),
  };
  const byDue = Object.keys(due).length ? { dueDate: due } : {};
  const [installments, forecasts] = await Promise.all([
    db.cardInstallment.findMany({
      where: { householdId: ctx.householdId, invoice: byDue },
      select: { id: true, amountCents: true, invoice: { select: { cardId: true, dueDate: true } }, purchase: { select: { categoryId: true } } },
    }),
    db.cardPurchase.findMany({
      where: { householdId: ctx.householdId, status: "FORECAST", invoice: byDue },
      select: { id: true, totalCents: true, categoryId: true, cardId: true, invoice: { select: { dueDate: true } } },
    }),
  ]);
  return [
    ...installments.map<Movement>((i) => ({
      id: i.id,
      kind: "EXPENSE",
      status: "EFFECTIVE",
      amountCents: i.amountCents,
      accountId: `${CARD_MOVEMENT_PREFIX}${i.invoice.cardId}`,
      toAccountId: null,
      categoryId: i.purchase.categoryId,
      dueDate: fromDbDate(i.invoice.dueDate),
      effectiveDate: fromDbDate(i.invoice.dueDate),
    })),
    ...forecasts.map<Movement>((f) => ({
      id: f.id,
      kind: "EXPENSE",
      status: "PENDING",
      amountCents: f.totalCents,
      accountId: `${CARD_MOVEMENT_PREFIX}${f.cardId}`,
      toAccountId: null,
      categoryId: f.categoryId,
      dueDate: fromDbDate(f.invoice.dueDate),
      effectiveDate: null,
    })),
  ];
}

/** Dívidas de cartão: soma dos saldos devedores das faturas com compras confirmadas. */
export async function cardDebt(ctx: HouseholdContext, today: ISODate = todayISO()) {
  const cards = await listCards(ctx, today);
  return {
    debtCents: cards.reduce((s, c) => s + Math.max(0, c.limit.committedCents), 0),
    cards,
  };
}

// ---------------------------------------------------------------------------
// Previsões de cobrança recorrente no cartão
// ---------------------------------------------------------------------------

async function loadForecastOrPurchase(ctx: HouseholdContext, purchaseId: string) {
  const p = await db.cardPurchase.findFirst({
    where: { id: purchaseId, householdId: ctx.householdId, seriesId: { not: null } },
    select: { id: true, cardId: true, status: true, seriesId: true, occurrenceIndex: true },
  });
  if (!p) throw new NotFoundError();
  return p;
}

/**
 * Confirma a previsão uma única vez: vira compra à vista, mantendo o vínculo com a série.
 * Confirmar de novo devolve a mesma compra (o UPDATE só vale enquanto a linha é FORECAST).
 */
export async function confirmForecast(ctx: HouseholdContext, purchaseId: string, input: ConfirmForecastInput, today: ISODate = todayISO()) {
  const p = await loadForecastOrPurchase(ctx, purchaseId);
  if (p.status === "CONFIRMED") return { id: p.id, created: false };
  const card = await loadCard(ctx, p.cardId);
  if (card.archivedAt) throw new DomainError("Este cartão está arquivado e não aceita novas compras");
  if (input.date > today) throw new DomainError("A data da compra não pode ser futura", "date");
  assertPurchaseDate(input.date, today);

  return db.$transaction(async (tx) => {
    await lockCard(tx, card.id);
    const current = await tx.cardPurchase.findUniqueOrThrow({ where: { id: p.id }, select: { status: true, categoryId: true } });
    if (current.status === "CONFIRMED") return { id: p.id, created: false };
    const first = await startInvoice(tx, card, { invoiceId: input.invoiceId, purchaseDate: input.date });
    const { count } = await tx.cardPurchase.updateMany({
      where: { id: p.id, householdId: ctx.householdId, status: "FORECAST" },
      data: {
        status: "CONFIRMED",
        totalCents: input.amount,
        purchaseDate: toDbDate(input.date),
        invoiceId: first.id,
        installmentCount: 1,
        seriesOverride: true,
      },
    });
    if (count === 0) return { id: p.id, created: false };
    await tx.cardInstallment.create({
      data: { householdId: ctx.householdId, purchaseId: p.id, invoiceId: first.id, index: 1, amountCents: input.amount },
    });
    return { id: p.id, created: true };
  });
}

/**
 * Pula uma previsão. "only": remove só esta e registra exceção (a posição não volta).
 * "following": encerra a série antes da posição e remove as previsões seguintes; confirmadas ficam.
 */
export async function skipForecast(ctx: HouseholdContext, purchaseId: string, scope: "only" | "following") {
  const p = await loadForecastOrPurchase(ctx, purchaseId);
  if (p.status !== "FORECAST") throw new DomainError("Esta cobrança já foi confirmada");
  const seriesId = p.seriesId!;
  const index = p.occurrenceIndex!;
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "recurring_series" WHERE id = ${seriesId} FOR UPDATE`;
    if (scope === "only") {
      await tx.recurringException.upsert({
        where: { seriesId_occurrenceIndex: { seriesId, occurrenceIndex: index } },
        create: { seriesId, occurrenceIndex: index },
        update: {},
      });
      await tx.cardPurchase.deleteMany({ where: { id: p.id, householdId: ctx.householdId, status: "FORECAST" } });
      return;
    }
    const s = await tx.recurringSeries.findUniqueOrThrow({ where: { id: seriesId }, select: { stopBeforeIndex: true } });
    await tx.recurringSeries.update({
      where: { id: seriesId },
      data: { stopBeforeIndex: s.stopBeforeIndex === null ? index : Math.min(s.stopBeforeIndex, index) },
    });
    await tx.cardPurchase.deleteMany({
      where: { householdId: ctx.householdId, seriesId, status: "FORECAST", occurrenceIndex: { gte: index } },
    });
  });
}

export async function getForecast(ctx: HouseholdContext, purchaseId: string, today: ISODate = todayISO()) {
  const p = await db.cardPurchase.findFirst({
    where: { id: purchaseId, householdId: ctx.householdId, status: "FORECAST" },
    include: { card: { select: { id: true, name: true, archivedAt: true } }, category: { select: { name: true } } },
  });
  if (!p) throw new NotFoundError();
  return {
    id: p.id,
    cardId: p.cardId,
    cardName: p.card.name,
    cardArchived: !!p.card.archivedAt,
    description: p.description,
    amountCents: p.totalCents,
    expectedDate: fromDbDate(p.purchaseDate),
    categoryName: p.category.name,
    suggestedInvoiceId: p.invoiceId,
    // A data de confirmação sugerida nunca é futura.
    confirmDate: fromDbDate(p.purchaseDate) > today ? today : fromDbDate(p.purchaseDate),
  };
}
