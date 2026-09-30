import { CircleCheck, CircleSlash } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatusBadge({ active }: { active: boolean }) {
  const Icon = active ? CircleCheck : CircleSlash;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
        active ? "bg-income-soft text-income" : "bg-muted text-muted-foreground",
      )}
    >
      <Icon aria-hidden className="size-3.5" />
      {active ? "Ativo" : "Desativado"}
    </span>
  );
}
