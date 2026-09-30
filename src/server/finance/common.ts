import { Prisma } from "@/generated/prisma/client";
import { fromDbDate } from "@/lib/dates";
import type { Movement } from "@/lib/finance/types";

export const movementSelect = {
  id: true,
  kind: true,
  status: true,
  amountCents: true,
  accountId: true,
  toAccountId: true,
  categoryId: true,
  dueDate: true,
  effectiveDate: true,
} satisfies Prisma.TransactionSelect;

type MovementRow = Prisma.TransactionGetPayload<{ select: typeof movementSelect }>;

export function toMovement(row: MovementRow): Movement {
  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    amountCents: row.amountCents,
    accountId: row.accountId,
    toAccountId: row.toAccountId,
    categoryId: row.categoryId,
    dueDate: fromDbDate(row.dueDate),
    effectiveDate: row.effectiveDate ? fromDbDate(row.effectiveDate) : null,
  };
}

export function isUniqueViolation(error: unknown, field?: string) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") return false;
  if (!field) return true;
  return JSON.stringify(error.meta ?? {}).includes(field);
}
