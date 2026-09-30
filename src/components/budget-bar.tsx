import { AlertTriangle, CheckCircle2, OctagonAlert } from "lucide-react";
import type { BudgetAlert } from "@/lib/finance/rules";
import { cn } from "@/lib/utils";

export const ALERT_TEXT: Record<BudgetAlert, string> = {
  ok: "Dentro do limite",
  near: "Perto do limite",
  over: "Acima do limite",
};

export function BudgetAlertLabel({ alert, className }: { alert: BudgetAlert; className?: string }) {
  const Icon = alert === "over" ? OctagonAlert : alert === "near" ? AlertTriangle : CheckCircle2;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-semibold",
        alert === "over" && "text-expense",
        alert === "near" && "text-warning",
        alert === "ok" && "text-income",
        className,
      )}
    >
      <Icon aria-hidden className="size-3.5" />
      {ALERT_TEXT[alert]}
    </span>
  );
}

/** Barra de consumo: realizado sólido + pendente hachurado (previsão). */
export function BudgetBar({
  realized,
  pending,
  limit,
  alert,
  label,
}: {
  realized: number;
  pending: number;
  limit: number;
  alert: BudgetAlert;
  label: string;
}) {
  const scale = Math.max(limit, realized + pending);
  const realizedPct = scale ? Math.min(100, (realized * 100) / scale) : 0;
  const pendingPct = scale ? Math.min(100 - realizedPct, (pending * 100) / scale) : 0;
  const limitPct = scale ? (limit * 100) / scale : 100;
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={limit}
      aria-valuenow={realized}
      className="relative h-3 w-full overflow-hidden rounded-full bg-muted"
    >
      <div
        className={cn(
          "absolute inset-y-0 left-0 rounded-full transition-[width] duration-500",
          alert === "over" ? "bg-expense" : alert === "near" ? "bg-warning" : "bg-primary",
        )}
        style={{ width: `${realizedPct}%` }}
      />
      {pendingPct > 0 && (
        <div
          className="absolute inset-y-0 bg-[repeating-linear-gradient(45deg,var(--muted-foreground)_0_3px,transparent_3px_6px)] opacity-50"
          style={{ left: `${realizedPct}%`, width: `${pendingPct}%` }}
        />
      )}
      {limitPct < 100 && <div aria-hidden className="absolute inset-y-0 w-0.5 bg-foreground" style={{ left: `${limitPct}%` }} />}
    </div>
  );
}
