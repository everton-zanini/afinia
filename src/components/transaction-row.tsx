import Link from "next/link";
import { ArrowLeftRight } from "lucide-react";
import { CategoryBadge } from "@/components/category-icon";
import { Money } from "@/components/money";
import { TransactionStatus } from "@/components/transaction-status";
import type { TransactionDTO } from "@/server/finance/transactions";

const TONE = { INCOME: "income", EXPENSE: "expense", TRANSFER: "transfer" } as const;

export function TransactionRow({ t, today }: { t: TransactionDTO; today: string }) {
  const subtitle =
    t.kind === "TRANSFER"
      ? `${t.account.name} → ${t.toAccount?.name ?? ""}`
      : `${t.category?.name ?? ""} · ${t.account.name}`;
  return (
    <Link href={`/lancamentos/${t.id}`} className="flex min-h-16 items-center gap-3 px-4 py-2.5 hover:bg-muted/60">
      {t.category ? (
        <CategoryBadge icon={t.category.icon} color={t.category.color} />
      ) : (
        <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-transfer-soft text-transfer">
          <ArrowLeftRight className="size-5" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{t.description}</span>
        <span className="block truncate text-sm text-muted-foreground">{subtitle}</span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-0.5">
        <Money
          cents={t.amountCents}
          tone={TONE[t.kind]}
          signed={t.kind !== "TRANSFER"}
          className={t.status === "PENDING" ? "font-semibold opacity-80" : "font-semibold"}
        />
        <TransactionStatus status={t.status} kind={t.kind} dueDate={t.dueDate} today={today} />
      </span>
    </Link>
  );
}
