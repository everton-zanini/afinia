import { AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

/** Situação com ícone e texto (não depende só da cor). */
export function TransactionStatus({
  status,
  kind,
  dueDate,
  today,
  className,
}: {
  status: "PENDING" | "EFFECTIVE";
  kind: "INCOME" | "EXPENSE" | "TRANSFER";
  dueDate: string;
  today: string;
  className?: string;
}) {
  if (status === "EFFECTIVE") {
    const label = kind === "INCOME" ? "Recebido" : kind === "TRANSFER" ? "Feita" : "Pago";
    return (
      <span className={cn("inline-flex items-center gap-1 text-xs font-medium text-income", className)}>
        <CheckCircle2 aria-hidden className="size-3.5" />
        {label}
      </span>
    );
  }
  const late = dueDate < today;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-1.5 text-xs font-medium",
        late ? "bg-expense-soft text-expense" : "bg-warning-soft text-warning",
        className,
      )}
    >
      {late ? <AlertTriangle aria-hidden className="size-3.5" /> : <Clock aria-hidden className="size-3.5" />}
      {late ? "Atrasado" : "Pendente"}
    </span>
  );
}
