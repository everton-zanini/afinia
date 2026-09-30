import { db } from "@/server/db";
import { DomainError, NotFoundError } from "@/server/errors";
import type { HouseholdContext } from "@/server/households/context";
import { fromDbDate, toDbDate, type ISODate } from "@/lib/dates";
import { accountBalances } from "@/lib/finance/rules";
import type { AccountInput } from "@/lib/validation/finance";
import { movementSelect, toMovement } from "./common";

export type AccountKind = "CHECKING" | "CASH" | "RESERVE";

export const ACCOUNT_KIND_LABEL: Record<AccountKind, string> = {
  CHECKING: "Conta bancária",
  CASH: "Dinheiro",
  RESERVE: "Reserva",
};

export type AccountDTO = {
  id: string;
  name: string;
  kind: AccountKind;
  openingBalanceCents: number;
  openingDate: ISODate;
  archived: boolean;
};

const select = { id: true, name: true, kind: true, openingBalanceCents: true, openingDate: true, archivedAt: true } as const;

function toDTO(a: { id: string; name: string; kind: AccountKind; openingBalanceCents: number; openingDate: Date; archivedAt: Date | null }): AccountDTO {
  return {
    id: a.id,
    name: a.name,
    kind: a.kind,
    openingBalanceCents: a.openingBalanceCents,
    openingDate: fromDbDate(a.openingDate),
    archived: !!a.archivedAt,
  };
}

export async function listAccounts(ctx: HouseholdContext, opts: { includeArchived?: boolean } = {}) {
  const rows = await db.financialAccount.findMany({
    where: { householdId: ctx.householdId, ...(opts.includeArchived ? {} : { archivedAt: null }) },
    orderBy: [{ archivedAt: { sort: "asc", nulls: "first" } }, { createdAt: "asc" }],
    select,
  });
  return rows.map(toDTO);
}

export async function getAccount(ctx: HouseholdContext, id: string) {
  const a = await db.financialAccount.findFirst({ where: { id, householdId: ctx.householdId }, select });
  if (!a) throw new NotFoundError();
  return toDTO(a);
}

/** Lançamentos efetivados do casal (forma mínima), usados para saldos. */
export async function effectiveMovements(ctx: HouseholdContext, until?: ISODate) {
  const rows = await db.transaction.findMany({
    where: {
      householdId: ctx.householdId,
      status: "EFFECTIVE",
      ...(until ? { effectiveDate: { lte: toDbDate(until) } } : {}),
    },
    select: movementSelect,
  });
  return rows.map(toMovement);
}

/** Contas com saldo realizado e previsão (pendências) por conta. */
export async function accountsWithBalances(ctx: HouseholdContext, opts: { includeArchived?: boolean } = {}) {
  const accounts = await listAccounts(ctx, { includeArchived: true });
  const [effective, pending] = await Promise.all([
    effectiveMovements(ctx),
    db.transaction.findMany({ where: { householdId: ctx.householdId, status: "PENDING" }, select: movementSelect }),
  ]);
  const balances = accountBalances(accounts, effective);
  const projected = accountBalances(
    accounts.map((a) => ({ ...a, openingBalanceCents: balances.get(a.id) ?? 0 })),
    pending.map((p) => ({ ...toMovement(p), status: "EFFECTIVE" as const, effectiveDate: fromDbDate(p.dueDate) })),
  );
  return accounts
    .filter((a) => opts.includeArchived || !a.archived)
    .map((a) => ({ ...a, balanceCents: balances.get(a.id) ?? 0, projectedCents: projected.get(a.id) ?? 0 }));
}

async function earliestEffectiveDate(ctx: HouseholdContext, accountId: string) {
  const first = await db.transaction.findFirst({
    where: {
      householdId: ctx.householdId,
      status: "EFFECTIVE",
      OR: [{ accountId }, { toAccountId: accountId }],
    },
    orderBy: { effectiveDate: "asc" },
    select: { effectiveDate: true },
  });
  return first?.effectiveDate ? fromDbDate(first.effectiveDate) : null;
}

export async function createAccount(ctx: HouseholdContext, input: AccountInput) {
  const a = await db.financialAccount.create({
    data: {
      householdId: ctx.householdId,
      name: input.name,
      kind: input.kind,
      openingBalanceCents: input.openingBalance,
      openingDate: toDbDate(input.openingDate),
    },
    select,
  });
  return toDTO(a);
}

export async function updateAccount(ctx: HouseholdContext, id: string, input: AccountInput) {
  await getAccount(ctx, id);
  const earliest = await earliestEffectiveDate(ctx, id);
  if (earliest && input.openingDate > earliest) {
    throw new DomainError(
      "A data de abertura não pode ser posterior a lançamentos já efetivados nesta conta",
      "openingDate",
    );
  }
  const a = await db.financialAccount.update({
    where: { id, householdId: ctx.householdId },
    data: {
      name: input.name,
      kind: input.kind,
      openingBalanceCents: input.openingBalance,
      openingDate: toDbDate(input.openingDate),
    },
    select,
  });
  return toDTO(a);
}

export async function setAccountArchived(ctx: HouseholdContext, id: string, archived: boolean) {
  await getAccount(ctx, id);
  await db.financialAccount.update({
    where: { id, householdId: ctx.householdId },
    data: { archivedAt: archived ? new Date() : null },
  });
}

export async function deleteAccount(ctx: HouseholdContext, id: string) {
  const a = await db.financialAccount.findFirst({
    where: { id, householdId: ctx.householdId },
    select: { _count: { select: { outgoing: true, incoming: true } } },
  });
  if (!a) throw new NotFoundError();
  if (a._count.outgoing + a._count.incoming > 0) {
    throw new DomainError("Esta conta tem lançamentos. Arquive-a para preservar o histórico.");
  }
  await db.financialAccount.delete({ where: { id, householdId: ctx.householdId } });
}
