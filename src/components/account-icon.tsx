import { Banknote, Landmark, PiggyBank, Ticket, type LucideIcon } from "lucide-react";

export const ACCOUNT_ICON: Record<"CHECKING" | "CASH" | "RESERVE" | "BENEFIT", LucideIcon> = {
  CHECKING: Landmark,
  CASH: Banknote,
  RESERVE: PiggyBank,
  BENEFIT: Ticket,
};
