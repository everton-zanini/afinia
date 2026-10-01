import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { DomainError, NotFoundError } from "@/server/errors";
import type { HouseholdContext } from "@/server/households/context";
import { fromDbDate, todayISO, toDbDate, type ISODate } from "@/lib/dates";
import {
  horizon,
  lastLogicalIndex,
  positionsToGenerate,
  ruleFor,
  scheduledDate,
  summarize,
  validateEnd,
  type Schedule,
} from "@/lib/finance/recurrence";
import type { RecurrenceInput, TransactionInput } from "@/lib/validation/finance";
import { isUniqueViolation } from "./common";
import { dataFrom, validateReferences } from "./transactions";

// Recorrências: definição (série + regras por posição + exceções) separada dos lançamentos.
// A geração materializa posições ausentes como lançamentos PENDENTES e nunca altera existentes.

const BATCH = 200;

type Tx = Prisma.TransactionClient;

type SeriesRow = {
  id: string;
  householdId: string;
  kind: "INCOME" | "EXPENSE" | "TRANSFER";
  frequency: "WEEKLY" | "MONTHLY" | "YEARLY";
  startDate: Date;
  endMode: "COUNT" | "UNTIL" | "NONE";
  occurrenceCount: number | null;
  untilDate: Date | null;
  stopBeforeIndex: number | null;
  stoppedOn: Date | null;
  generatedThroughIndex: number;
  createdById: string;
};

export function scheduleOf(s: Pick<SeriesRow, "startDate" | "frequency" | "endMode" | "occurrenceCount" | "untilDate" | "stopBeforeIndex" | "stoppedOn">): Schedule {
  return {
    startDate: fromDbDate(s.startDate),
    frequency: s.frequency,
    endMode: s.endMode,
    occurrenceCount: s.occurrenceCount,
    untilDate: s.untilDate ? fromDbDate(s.untilDate) : null,
    stopBeforeIndex: s.stopBeforeIndex,
    stoppedOn: s.stoppedOn ? fromDbDate(s.stoppedOn) : null,
  };
}

function ruleData(input: TransactionInput) {
  return {
    description: input.description,
    amountCents: input.amount,
    categoryId: input.categoryId,
    accountId: input.accountId,
    toAccountId: input.toAccountId,
    responsibleMemberId: input.responsibleMemberId,
    notes: input.notes,
  };
}

function occurrenceKey(seriesId: string, index: number) {
  return `series:${seriesId}:${index}`;
}

/**
 * Gera, em lotes, as posições ausentes de uma série até o horizonte. O lock da série evita
 * trabalho duplicado; a unicidade (seriesId, occurrenceIndex) + skipDuplicates garante que
 * nenhuma posição seja criada duas vezes, mesmo sem o lock.
 */
async function generateSeries(seriesId: string, horizonDate: ISODate) {
  for (;;) {
    const done = await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "recurring_series" WHERE id = ${seriesId} FOR UPDATE`;
      const s = await tx.recurringSeries.findUniqueOrThrow({
        where: { id: seriesId },
        include: { rules: true, exceptions: { select: { occurrenceIndex: true } } },
      });
      const schedule = scheduleOf(s);
      const positions = positionsToGenerate(schedule, horizonDate, s.generatedThroughIndex + 1).slice(0, BATCH);
      if (positions.length === 0) return true;
      const skip = new Set(s.exceptions.map((e) => e.occurrenceIndex));
      const data = positions
        .filter((i) => !skip.has(i))
        .map((i) => {
          const r = ruleFor(s.rules, i);
          return {
            householdId: s.householdId,
            kind: s.kind,
            status: "PENDING" as const,
            description: r.description,
            amountCents: r.amountCents,
            categoryId: r.categoryId,
            accountId: r.accountId,
            toAccountId: r.toAccountId,
            responsibleMemberId: r.responsibleMemberId,
            notes: r.notes,
            dueDate: toDbDate(scheduledDate(schedule.startDate, schedule.frequency, i)),
            effectiveDate: null,
            createdById: s.createdById,
            idempotencyKey: occurrenceKey(s.id, i),
            seriesId: s.id,
            occurrenceIndex: i,
          };
        });
      if (data.length) await tx.transaction.createMany({ data, skipDuplicates: true });
      await tx.recurringSeries.update({
        where: { id: s.id },
        data: { generatedThroughIndex: positions.at(-1)! },
      });
      return positions.length < BATCH;
    });
    if (done) return;
  }
}

/** Materializa a janela de 12 meses de todas as séries do casal. Barato quando nada falta. */
export async function ensureGenerated(ctx: HouseholdContext, today: ISODate = todayISO()) {
  const limit = horizon(today);
  const series = await db.recurringSeries.findMany({
    where: { householdId: ctx.householdId },
    select: {
      id: true, startDate: true, frequency: true, endMode: true, occurrenceCount: true,
      untilDate: true, stopBeforeIndex: true, stoppedOn: true, generatedThroughIndex: true,
    },
  });
  for (const s of series) {
    const schedule = scheduleOf(s);
    const next = s.generatedThroughIndex + 1;
    if (next > lastLogicalIndex(schedule)) continue;
    if (scheduledDate(schedule.startDate, schedule.frequency, next) > limit) continue;
    await generateSeries(s.id, limit);
  }
}

/**
 * Cria a série e gera a janela. Se a primeira ocorrência já foi efetivada, exige data real
 * de efetivação (não futura, ≥ abertura das contas); as demais nascem pendentes.
 */
export async function createSeries(
  ctx: HouseholdContext,
  input: TransactionInput,
  rec: RecurrenceInput,
  today: ISODate = todayISO(),
) {
  const existing = await db.recurringSeries.findUnique({
    where: { householdId_idempotencyKey: { householdId: ctx.householdId, idempotencyKey: input.idempotencyKey } },
    select: { id: true },
  });
  if (existing) return { id: existing.id, created: false };

  const endError = validateEnd({ startDate: input.dueDate, endMode: rec.endMode, occurrenceCount: rec.occurrenceCount, untilDate: rec.untilDate });
  if (endError) throw new DomainError(endError, rec.endMode === "COUNT" ? "occurrenceCount" : "untilDate");
  if (input.status === "EFFECTIVE" && input.effectiveDate! > today) {
    throw new DomainError("A data de pagamento não pode ser futura", "effectiveDate");
  }
  await validateReferences(ctx, input, null);

  let id: string;
  try {
    id = await createSeriesRows(ctx, input, rec);
  } catch (error) {
    if (!isUniqueViolation(error, "idempotencyKey")) throw error;
    const again = await db.recurringSeries.findUniqueOrThrow({
      where: { householdId_idempotencyKey: { householdId: ctx.householdId, idempotencyKey: input.idempotencyKey } },
      select: { id: true },
    });
    return { id: again.id, created: false };
  }
  await generateSeries(id, horizon(today));
  return { id, created: true };
}

async function createSeriesRows(ctx: HouseholdContext, input: TransactionInput, rec: RecurrenceInput) {
  return db.$transaction(async (tx) => {
    const s = await tx.recurringSeries.create({
      data: {
        householdId: ctx.householdId,
        kind: input.kind,
        frequency: rec.frequency,
        startDate: toDbDate(input.dueDate),
        endMode: rec.endMode,
        occurrenceCount: rec.occurrenceCount,
        untilDate: rec.untilDate ? toDbDate(rec.untilDate) : null,
        createdById: ctx.userId,
        idempotencyKey: input.idempotencyKey,
        rules: { create: { fromIndex: 0, ...ruleData(input) } },
      },
      select: { id: true },
    });
    if (input.status === "EFFECTIVE") {
      await tx.transaction.create({
        data: {
          ...dataFrom(input),
          householdId: ctx.householdId,
          createdById: ctx.userId,
          idempotencyKey: occurrenceKey(s.id, 0),
          seriesId: s.id,
          occurrenceIndex: 0,
        },
      });
    }
    return s.id;
  });
}

async function loadOccurrence(ctx: HouseholdContext, transactionId: string) {
  const t = await db.transaction.findFirst({
    where: { id: transactionId, householdId: ctx.householdId },
    select: {
      id: true, kind: true, status: true, dueDate: true, seriesId: true, occurrenceIndex: true,
      categoryId: true, accountId: true, toAccountId: true,
    },
  });
  if (!t) throw new NotFoundError();
  return t;
}

export type EditScope = "only" | "following";

/**
 * Edita uma ocorrência. "only": ajusta só ela (inclusive data) e a marca como personalizada.
 * "following": nova regra a partir da posição; atualiza a selecionada e as pendentes seguintes
 * não personalizadas. Efetivadas e personalizadas são preservadas; datas não mudam.
 */
export async function updateOccurrence(ctx: HouseholdContext, transactionId: string, input: TransactionInput, scope: EditScope) {
  const t = await loadOccurrence(ctx, transactionId);
  if (!t.seriesId || t.occurrenceIndex === null) throw new DomainError("Este lançamento não pertence a uma recorrência");
  if (input.kind !== t.kind) {
    throw new DomainError("O tipo de uma recorrência não pode ser alterado. Encerre esta recorrência e crie outra.", "kind");
  }
  await validateReferences(ctx, input, t);

  if (scope === "only") {
    await db.transaction.update({
      where: { id: t.id, householdId: ctx.householdId },
      data: { ...dataFrom(input), seriesOverride: true },
    });
    return;
  }

  if (t.status !== "PENDING") {
    throw new DomainError("Ocorrências efetivadas só podem ser editadas com “Só este lançamento”");
  }
  if (input.dueDate !== fromDbDate(t.dueDate)) {
    throw new DomainError("Para mudar a data, use “Só este lançamento”", "dueDate");
  }
  const seriesId = t.seriesId;
  const index = t.occurrenceIndex;
  const rule = ruleData(input);
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "recurring_series" WHERE id = ${seriesId} FOR UPDATE`;
    await tx.recurringRule.upsert({
      where: { seriesId_fromIndex: { seriesId, fromIndex: index } },
      create: { seriesId, fromIndex: index, ...rule },
      update: rule,
    });
    await tx.transaction.update({ where: { id: t.id, householdId: ctx.householdId }, data: dataFrom(input) });
    await tx.transaction.updateMany({
      where: { householdId: ctx.householdId, seriesId, occurrenceIndex: { gt: index }, status: "PENDING", seriesOverride: false },
      data: rule,
    });
  });
}

/** Prévia do que "Excluir este e os próximos" remove (pendentes a partir da posição). */
export async function previewDeleteFollowing(ctx: HouseholdContext, transactionId: string) {
  const t = await loadOccurrence(ctx, transactionId);
  if (!t.seriesId || t.occurrenceIndex === null) throw new DomainError("Este lançamento não pertence a uma recorrência");
  const agg = await db.transaction.aggregate({
    where: { householdId: ctx.householdId, seriesId: t.seriesId, occurrenceIndex: { gte: t.occurrenceIndex }, status: "PENDING" },
    _count: { _all: true },
    _sum: { amountCents: true },
  });
  return { count: agg._count._all, totalCents: agg._sum.amountCents ?? 0 };
}

/**
 * Exclui uma ocorrência. "only": apaga e registra exceção (a posição não volta).
 * "following": encerra a programação antes da posição e apaga as pendentes a partir dela,
 * inclusive personalizadas. Efetivadas são preservadas.
 */
export async function deleteOccurrence(ctx: HouseholdContext, transactionId: string, scope: EditScope) {
  const t = await loadOccurrence(ctx, transactionId);
  if (!t.seriesId || t.occurrenceIndex === null) throw new DomainError("Este lançamento não pertence a uma recorrência");
  const seriesId = t.seriesId;
  const index = t.occurrenceIndex;
  await db.$transaction(async (tx: Tx) => {
    await tx.$queryRaw`SELECT id FROM "recurring_series" WHERE id = ${seriesId} FOR UPDATE`;
    if (scope === "only") {
      await tx.recurringException.upsert({
        where: { seriesId_occurrenceIndex: { seriesId, occurrenceIndex: index } },
        create: { seriesId, occurrenceIndex: index },
        update: {},
      });
      await tx.transaction.delete({ where: { id: t.id, householdId: ctx.householdId } });
      return;
    }
    const s = await tx.recurringSeries.findUniqueOrThrow({ where: { id: seriesId }, select: { stopBeforeIndex: true } });
    await tx.recurringSeries.update({
      where: { id: seriesId },
      data: { stopBeforeIndex: s.stopBeforeIndex === null ? index : Math.min(s.stopBeforeIndex, index) },
    });
    await tx.transaction.deleteMany({
      where: { householdId: ctx.householdId, seriesId, occurrenceIndex: { gte: index }, status: "PENDING" },
    });
  });
}

async function loadSeries(ctx: HouseholdContext, seriesId: string) {
  const s = await db.recurringSeries.findFirst({ where: { id: seriesId, householdId: ctx.householdId } });
  if (!s) throw new NotFoundError();
  return s;
}

/** Prévia do encerramento: pendentes com data prevista ≥ data de encerramento. */
export async function previewEnd(ctx: HouseholdContext, seriesId: string, on: ISODate = todayISO()) {
  await loadSeries(ctx, seriesId);
  const agg = await db.transaction.aggregate({
    where: { householdId: ctx.householdId, seriesId, status: "PENDING", dueDate: { gte: toDbDate(on) } },
    _count: { _all: true },
    _sum: { amountCents: true },
  });
  return { count: agg._count._all, totalCents: agg._sum.amountCents ?? 0 };
}

/** Encerra a programação em `on`: remove pendentes com data ≥ `on`; preserva anteriores e efetivadas. */
export async function endSeries(ctx: HouseholdContext, seriesId: string, on: ISODate = todayISO()) {
  const s = await loadSeries(ctx, seriesId);
  const stoppedOn = s.stoppedOn && fromDbDate(s.stoppedOn) < on ? s.stoppedOn : toDbDate(on);
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "recurring_series" WHERE id = ${seriesId} FOR UPDATE`;
    await tx.recurringSeries.update({ where: { id: seriesId }, data: { stoppedOn } });
    await tx.transaction.deleteMany({
      where: { householdId: ctx.householdId, seriesId, status: "PENDING", dueDate: { gte: toDbDate(on) } },
    });
  });
}

export type SeriesView = {
  id: string;
  kind: SeriesRow["kind"];
  frequency: SeriesRow["frequency"];
  endMode: SeriesRow["endMode"];
  occurrenceCount: number | null;
  untilDate: ISODate | null;
  startDate: ISODate;
  description: string;
  amountCents: number;
  accountName: string;
  toAccountName: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  categoryIcon: string | null;
  nextPendingDate: ISODate | null;
  usesArchived: boolean;
  summary: ReturnType<typeof summarize>;
};

/** Recorrências do casal com programação, pendentes geradas e previstas para geração. */
export async function listSeries(ctx: HouseholdContext): Promise<SeriesView[]> {
  const rows = await db.recurringSeries.findMany({
    where: { householdId: ctx.householdId },
    orderBy: { createdAt: "desc" },
    include: {
      rules: {
        include: {
          account: { select: { name: true, archivedAt: true } },
          toAccount: { select: { name: true, archivedAt: true } },
          category: { select: { name: true, color: true, icon: true, archivedAt: true } },
        },
      },
      exceptions: { select: { occurrenceIndex: true } },
      occurrences: { select: { occurrenceIndex: true, status: true, amountCents: true, dueDate: true } },
    },
  });
  return rows.map((s) => {
    const schedule = scheduleOf(s);
    const rule = ruleFor(s.rules, Math.max(0, s.generatedThroughIndex + 1));
    const pending = s.occurrences.filter((o) => o.status === "PENDING").map((o) => fromDbDate(o.dueDate)).sort();
    return {
      id: s.id,
      kind: s.kind,
      frequency: s.frequency,
      endMode: s.endMode,
      occurrenceCount: s.occurrenceCount,
      untilDate: schedule.untilDate,
      startDate: schedule.startDate,
      description: rule.description,
      amountCents: rule.amountCents,
      accountName: rule.account.name,
      toAccountName: rule.toAccount?.name ?? null,
      categoryName: rule.category?.name ?? null,
      categoryColor: rule.category?.color ?? null,
      categoryIcon: rule.category?.icon ?? null,
      nextPendingDate: pending[0] ?? null,
      usesArchived: !!(rule.account.archivedAt || rule.toAccount?.archivedAt || rule.category?.archivedAt),
      summary: summarize(
        schedule,
        s.occurrences.map((o) => ({ index: o.occurrenceIndex!, status: o.status, amountCents: o.amountCents })),
        new Set(s.exceptions.map((e) => e.occurrenceIndex)),
        s.generatedThroughIndex,
      ),
    };
  });
}
