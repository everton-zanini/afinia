import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { DomainError, NotFoundError } from "@/server/errors";
import type { HouseholdContext } from "@/server/households/context";
import { addDays, fromDbDate, todayISO, toDbDate, type ISODate } from "@/lib/dates";
import type { TransactionFilters, TransactionInput } from "@/lib/validation/finance";
import { positionLabel } from "@/lib/finance/recurrence";
import { isUniqueViolation } from "./common";

export type TransactionDTO = {
  id: string;
  kind: "INCOME" | "EXPENSE" | "TRANSFER" | "CARD_PAYMENT";
  status: "PENDING" | "EFFECTIVE";
  description: string;
  amountCents: number;
  dueDate: ISODate;
  effectiveDate: ISODate | null;
  referenceDate: ISODate;
  notes: string | null;
  category: { id: string; name: string; color: string; icon: string; parentName: string | null; parentId: string | null } | null;
  account: { id: string; name: string };
  toAccount: { id: string; name: string } | null;
  responsible: { memberId: string; name: string } | null;
  createdBy: { id: string; name: string };
  /** Somente pagamento de fatura: a fatura e o cartão pagos. */
  invoice: { id: string; cardId: string; cardName: string } | null;
  createdAt: string;
  updatedAt: string;
  /** Posição na recorrência, quando for uma ocorrência. */
  series: {
    id: string;
    index: number;
    label: string;
    override: boolean;
    frequency: "WEEKLY" | "MONTHLY" | "YEARLY";
  } | null;
};

const detailSelect = {
  id: true,
  kind: true,
  status: true,
  description: true,
  amountCents: true,
  dueDate: true,
  effectiveDate: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  category: { select: { id: true, name: true, color: true, icon: true, parentId: true, parent: { select: { name: true } } } },
  account: { select: { id: true, name: true } },
  toAccount: { select: { id: true, name: true } },
  responsibleMember: { select: { id: true, user: { select: { name: true } } } },
  createdBy: { select: { id: true, name: true } },
  invoice: { select: { id: true, card: { select: { id: true, name: true } } } },
  occurrenceIndex: true,
  seriesOverride: true,
  series: { select: { id: true, frequency: true, endMode: true, occurrenceCount: true } },
} satisfies Prisma.TransactionSelect;

type DetailRow = Prisma.TransactionGetPayload<{ select: typeof detailSelect }>;

function toDTO(t: DetailRow): TransactionDTO {
  const dueDate = fromDbDate(t.dueDate);
  const effectiveDate = t.effectiveDate ? fromDbDate(t.effectiveDate) : null;
  return {
    id: t.id,
    kind: t.kind,
    status: t.status,
    description: t.description,
    amountCents: t.amountCents,
    dueDate,
    effectiveDate,
    referenceDate: t.status === "EFFECTIVE" ? effectiveDate! : dueDate,
    notes: t.notes,
    category: t.category
      ? {
          id: t.category.id,
          name: t.category.name,
          color: t.category.color,
          icon: t.category.icon,
          parentId: t.category.parentId,
          parentName: t.category.parent?.name ?? null,
        }
      : null,
    account: t.account,
    toAccount: t.toAccount,
    responsible: t.responsibleMember ? { memberId: t.responsibleMember.id, name: t.responsibleMember.user.name } : null,
    createdBy: t.createdBy,
    invoice: t.invoice ? { id: t.invoice.id, cardId: t.invoice.card.id, cardName: t.invoice.card.name } : null,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    series:
      t.series && t.occurrenceIndex !== null
        ? {
            id: t.series.id,
            index: t.occurrenceIndex,
            label: positionLabel(t.occurrenceIndex, t.series),
            override: t.seriesOverride,
            frequency: t.series.frequency,
          }
        : null,
  };
}

export const CARD_PAYMENT_LOCKED = "Pagamentos de fatura só podem ser desfeitos na fatura do cartão";

/** Pagamento de fatura nasce e morre na fatura: as operações comuns o recusam. */
async function assertNotCardPayment(ctx: HouseholdContext, id: string) {
  const t = await db.transaction.findFirst({ where: { id, householdId: ctx.householdId }, select: { kind: true } });
  if (!t) throw new NotFoundError();
  if (t.kind === "CARD_PAYMENT") throw new DomainError(CARD_PAYMENT_LOCKED);
}

type Existing = { categoryId: string | null; accountId: string; toAccountId: string | null } | null;

/**
 * Valida referências do lançamento contra o casal da sessão. Contas/categorias arquivadas só são
 * aceitas quando já eram usadas por este mesmo lançamento (edição sem trocar a referência).
 */
export async function validateReferences(ctx: HouseholdContext, input: TransactionInput, existing: Existing) {
  const accountIds = [input.accountId, input.toAccountId].filter((v): v is string => !!v);
  const accounts = await db.financialAccount.findMany({
    where: { householdId: ctx.householdId, id: { in: accountIds } },
    select: { id: true, name: true, openingDate: true, archivedAt: true, kind: true },
  });
  const byId = new Map(accounts.map((a) => [a.id, a]));
  for (const accountId of accountIds) {
    const a = byId.get(accountId);
    if (!a) throw new NotFoundError();
    if (input.kind === "TRANSFER" && a.kind === "BENEFIT") {
      throw new DomainError("Contas de benefício não permitem transferência ou saque", "toAccountId");
    }
    const keeping = existing && (existing.accountId === accountId || existing.toAccountId === accountId);
    if (a.archivedAt && !keeping) throw new DomainError(`A conta "${a.name}" está arquivada`, "accountId");
    if (input.effectiveDate && input.effectiveDate < fromDbDate(a.openingDate)) {
      throw new DomainError(
        `A data de pagamento é anterior à abertura da conta "${a.name}" (${fromDbDate(a.openingDate).split("-").reverse().join("/")})`,
        "effectiveDate",
      );
    }
  }

  if (input.categoryId) {
    const c = await db.category.findFirst({
      where: { id: input.categoryId, householdId: ctx.householdId },
      select: { kind: true, archivedAt: true },
    });
    if (!c) throw new NotFoundError();
    if (c.kind !== input.kind) throw new DomainError("A categoria não corresponde ao tipo do lançamento", "categoryId");
    if (c.archivedAt && existing?.categoryId !== input.categoryId) {
      throw new DomainError("Esta categoria está arquivada", "categoryId");
    }
  }

  if (input.responsibleMemberId && !ctx.members.some((m) => m.memberId === input.responsibleMemberId)) {
    throw new NotFoundError();
  }
}

export function dataFrom(input: TransactionInput) {
  return {
    kind: input.kind,
    status: input.status,
    description: input.description,
    amountCents: input.amount,
    categoryId: input.categoryId,
    accountId: input.accountId,
    toAccountId: input.toAccountId,
    dueDate: toDbDate(input.dueDate),
    effectiveDate: input.effectiveDate ? toDbDate(input.effectiveDate) : null,
    responsibleMemberId: input.responsibleMemberId,
    notes: input.notes,
  };
}

export async function getTransaction(ctx: HouseholdContext, id: string) {
  const t = await db.transaction.findFirst({ where: { id, householdId: ctx.householdId }, select: detailSelect });
  if (!t) throw new NotFoundError();
  return toDTO(t);
}

/** Cria o lançamento. Reenvio com a mesma chave de idempotência devolve o lançamento já criado. */
export async function createTransaction(ctx: HouseholdContext, input: TransactionInput) {
  const existing = await db.transaction.findUnique({
    where: { householdId_idempotencyKey: { householdId: ctx.householdId, idempotencyKey: input.idempotencyKey } },
    select: { id: true },
  });
  if (existing) return { id: existing.id, created: false };

  await validateReferences(ctx, input, null);
  try {
    const t = await db.transaction.create({
      data: {
        ...dataFrom(input),
        householdId: ctx.householdId,
        createdById: ctx.userId,
        idempotencyKey: input.idempotencyKey,
      },
      select: { id: true },
    });
    return { id: t.id, created: true };
  } catch (error) {
    if (isUniqueViolation(error, "idempotencyKey")) {
      const again = await db.transaction.findUniqueOrThrow({
        where: { householdId_idempotencyKey: { householdId: ctx.householdId, idempotencyKey: input.idempotencyKey } },
        select: { id: true },
      });
      return { id: again.id, created: false };
    }
    throw error;
  }
}

export async function updateTransaction(ctx: HouseholdContext, id: string, input: TransactionInput) {
  const current = await db.transaction.findFirst({
    where: { id, householdId: ctx.householdId },
    select: { categoryId: true, accountId: true, toAccountId: true, seriesId: true, kind: true },
  });
  if (!current) throw new NotFoundError();
  if (current.kind === "CARD_PAYMENT") throw new DomainError(CARD_PAYMENT_LOCKED);
  // Ocorrências de recorrência são editadas em escopo (recurrences.updateOccurrence).
  if (current.seriesId) throw new DomainError("Escolha se a alteração vale só para este lançamento ou também para os próximos");
  await validateReferences(ctx, input, current);
  await db.transaction.update({ where: { id, householdId: ctx.householdId }, data: dataFrom(input) });
}

export async function deleteTransaction(ctx: HouseholdContext, id: string) {
  // Ocorrências de recorrência são excluídas em escopo (recurrences.deleteOccurrence).
  await assertNotCardPayment(ctx, id);
  const { count } = await db.transaction.deleteMany({ where: { id, householdId: ctx.householdId, seriesId: null } });
  if (count === 0) throw new NotFoundError();
}

export async function markEffective(ctx: HouseholdContext, id: string, effectiveDate: ISODate = todayISO()) {
  await assertNotCardPayment(ctx, id);
  const t = await db.transaction.findFirst({
    where: { id, householdId: ctx.householdId },
    select: { accountId: true, toAccountId: true },
  });
  if (!t) throw new NotFoundError();
  const accounts = await db.financialAccount.findMany({
    where: { householdId: ctx.householdId, id: { in: [t.accountId, t.toAccountId].filter((v): v is string => !!v) } },
    select: { name: true, openingDate: true },
  });
  for (const a of accounts) {
    if (effectiveDate < fromDbDate(a.openingDate)) {
      throw new DomainError(`A data de pagamento é anterior à abertura da conta "${a.name}"`, "effectiveDate");
    }
  }
  await db.transaction.update({
    where: { id, householdId: ctx.householdId },
    data: { status: "EFFECTIVE", effectiveDate: toDbDate(effectiveDate) },
  });
}

export async function markPending(ctx: HouseholdContext, id: string) {
  await assertNotCardPayment(ctx, id);
  const { count } = await db.transaction.updateMany({
    where: { id, householdId: ctx.householdId },
    data: { status: "PENDING", effectiveDate: null },
  });
  if (count === 0) throw new NotFoundError();
}

/** Dados para duplicar: mesmo conteúdo, hoje como data, situação pendente. */
export async function duplicateDraft(ctx: HouseholdContext, id: string) {
  const t = await getTransaction(ctx, id);
  if (t.kind === "CARD_PAYMENT") throw new DomainError(CARD_PAYMENT_LOCKED);
  return {
    kind: t.kind,
    description: t.description,
    amountCents: t.amountCents,
    categoryId: t.category?.id ?? null,
    accountId: t.account.id,
    toAccountId: t.toAccount?.id ?? null,
    responsibleMemberId: t.responsible?.memberId ?? null,
    notes: t.notes,
    dueDate: todayISO(),
    status: "PENDING" as const,
  };
}

/**
 * Filtro por período usa a data de referência: efetivação para efetivados, prevista para
 * pendentes. Categoria inclui subcategorias; conta inclui origem e destino.
 */
export async function buildWhere(ctx: HouseholdContext, f: TransactionFilters): Promise<Prisma.TransactionWhereInput> {
  const and: Prisma.TransactionWhereInput[] = [{ householdId: ctx.householdId }];
  if (f.from || f.to) {
    const range = { ...(f.from ? { gte: toDbDate(f.from) } : {}), ...(f.to ? { lte: toDbDate(f.to) } : {}) };
    and.push({
      OR: [
        { status: "EFFECTIVE", effectiveDate: range },
        { status: "PENDING", dueDate: range },
      ],
    });
  }
  if (f.q) and.push({ description: { contains: f.q, mode: "insensitive" } });
  if (f.status) and.push({ status: f.status });
  if (f.kind) and.push({ kind: f.kind });
  if (f.accountId) and.push({ OR: [{ accountId: f.accountId }, { toAccountId: f.accountId }] });
  if (f.memberId) and.push({ responsibleMemberId: f.memberId });
  if (f.seriesId) and.push({ seriesId: f.seriesId });
  if (f.categoryId) {
    const children = await db.category.findMany({
      where: { householdId: ctx.householdId, parentId: f.categoryId },
      select: { id: true },
    });
    and.push({ categoryId: { in: [f.categoryId, ...children.map((c) => c.id)] } });
  }
  return { AND: and };
}

export const LIST_LIMIT = 500;

export async function listTransactions(ctx: HouseholdContext, f: TransactionFilters, opts: { limit?: number } = {}) {
  const where = await buildWhere(ctx, f);
  const rows = await db.transaction.findMany({
    where,
    select: detailSelect,
    orderBy: [{ createdAt: "desc" }],
    take: opts.limit ?? LIST_LIMIT,
  });
  // Ordena pela data de referência (mais recente primeiro), depois pela criação.
  return rows
    .map(toDTO)
    .sort((a, b) => (a.referenceDate === b.referenceDate ? b.createdAt.localeCompare(a.createdAt) : b.referenceDate.localeCompare(a.referenceDate)));
}

/** Categorias e contas mais usadas nos últimos 90 dias (sugestões do formulário). */
export async function mostUsed(ctx: HouseholdContext) {
  const since = toDbDate(addDays(todayISO(), -90));
  const [categories, accounts] = await Promise.all([
    db.transaction.groupBy({
      by: ["categoryId"],
      where: { householdId: ctx.householdId, dueDate: { gte: since }, categoryId: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { categoryId: "desc" } },
      take: 8,
    }),
    db.transaction.groupBy({
      by: ["accountId"],
      where: { householdId: ctx.householdId, dueDate: { gte: since } },
      _count: { _all: true },
      orderBy: { _count: { accountId: "desc" } },
      take: 3,
    }),
  ]);
  return {
    categoryIds: categories.map((c) => c.categoryId!).filter(Boolean),
    accountIds: accounts.map((a) => a.accountId),
  };
}
