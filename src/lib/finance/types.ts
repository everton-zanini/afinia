import type { ISODate, ISOMonth } from "@/lib/dates";

export type MovementKind = "INCOME" | "EXPENSE" | "TRANSFER";
export type MovementStatus = "PENDING" | "EFFECTIVE";

/** Forma mínima de um lançamento para as regras financeiras puras. */
export type Movement = {
  id?: string;
  kind: MovementKind;
  status: MovementStatus;
  amountCents: number;
  accountId: string;
  toAccountId: string | null;
  categoryId: string | null;
  dueDate: ISODate;
  effectiveDate: ISODate | null;
};

export type AccountOpening = { id: string; openingBalanceCents: number; openingDate: ISODate };

export type { ISODate, ISOMonth };
