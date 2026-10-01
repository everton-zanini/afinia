import type { ISODate, ISOMonth } from "@/lib/dates";

/** CARD_PAYMENT: pagamento de fatura — saída de caixa, nunca despesa por categoria. */
export type MovementKind = "INCOME" | "EXPENSE" | "TRANSFER" | "CARD_PAYMENT";

/** Gastos de cartão entram nas regras como movimentos com accountId "card:<id>" (não são contas). */
export const CARD_MOVEMENT_PREFIX = "card:";
export function isCardMovement(m: { accountId: string }) {
  return m.accountId.startsWith(CARD_MOVEMENT_PREFIX);
}
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
