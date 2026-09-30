import { Banknote, Landmark, PiggyBank, type LucideIcon } from "lucide-react";

export const ACCOUNT_ICON: Record<"CHECKING" | "CASH" | "RESERVE", LucideIcon> = {
  CHECKING: Landmark,
  CASH: Banknote,
  RESERVE: PiggyBank,
};
