import { AlertTriangle, CheckCircle2, CircleDashed, Clock } from "lucide-react";
import { PAYMENT_STATUS_LABEL, type InvoiceStatus, type LimitView } from "@/lib/finance/cards";
import { formatBRL } from "@/lib/money";
import { cn } from "@/lib/utils";

/** Situação da fatura em texto (a cor nunca é o único indicador). */
export function InvoiceStatusBadges({ status, className }: { status: InvoiceStatus; className?: string }) {
  const PayIcon = status.payment === "paid" ? CheckCircle2 : status.payment === "empty" ? CircleDashed : Clock;
  return (
    <span className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold", className)}>
      <span className="text-muted-foreground">{status.cycle === "open" ? "Ciclo aberto" : "Ciclo fechado"}</span>
      <span className={cn("inline-flex items-center gap-1", status.payment === "paid" ? "text-income" : "text-foreground")}>
        <PayIcon aria-hidden className="size-3.5" />
        {PAYMENT_STATUS_LABEL[status.payment]}
      </span>
      {status.overdue && (
        <span className="inline-flex items-center gap-1 text-expense">
          <AlertTriangle aria-hidden className="size-3.5" />
          Atrasada
        </span>
      )}
    </span>
  );
}

/** Limite estimado: comprometido sobre o limite informado (nunca é saldo nem dinheiro disponível). */
export function LimitBar({ limit, name }: { limit: LimitView; name: string }) {
  const used = Math.max(0, limit.committedCents);
  const pct = limit.limitCents ? Math.min(100, Math.round((used * 100) / limit.limitCents)) : 0;
  return (
    <div className="grid gap-1.5">
      <div
        role="meter"
        aria-label={`Limite estimado comprometido do cartão ${name}`}
        aria-valuemin={0}
        aria-valuemax={limit.limitCents}
        aria-valuenow={Math.min(used, limit.limitCents)}
        className="h-2.5 w-full overflow-hidden rounded-full bg-muted"
      >
        <div className={cn("h-full rounded-full", limit.over ? "bg-expense" : pct >= 80 ? "bg-warning" : "bg-primary")} style={{ width: `${pct}%` }} />
      </div>
      <p className="flex flex-wrap items-baseline justify-between gap-x-2 text-xs text-muted-foreground">
        <span>
          Comprometido (estimado) <strong className="tabular font-semibold text-foreground">{formatBRL(used)}</strong> de {formatBRL(limit.limitCents)}
        </span>
        <span>
          Disponível (estimado) <strong className="tabular font-semibold text-foreground">{formatBRL(limit.availableCents)}</strong>
        </span>
      </p>
      {limit.over && (
        <p className="flex items-center gap-1 text-xs font-semibold text-expense">
          <AlertTriangle aria-hidden className="size-3.5" />
          Acima do limite estimado
        </p>
      )}
    </div>
  );
}
