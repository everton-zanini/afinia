import { Repeat } from "lucide-react";
import { cn } from "@/lib/utils";

/** Posição na recorrência com ícone e texto ("Ocorrência 3 de 12" / "Recorrente · mensal"). */
export function SeriesBadge({ label, className }: { label: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium text-primary", className)}>
      <Repeat aria-hidden className="size-3.5" />
      {label}
    </span>
  );
}
