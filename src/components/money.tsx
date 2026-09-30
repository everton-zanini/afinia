import { formatBRL } from "@/lib/money";
import { cn } from "@/lib/utils";

type Tone = "income" | "expense" | "transfer" | "neutral";

/** Valor monetário. O sinal textual (+/−) acompanha a cor, que nunca é o único indicador. */
export function Money({
  cents,
  tone = "neutral",
  signed = false,
  className,
}: {
  cents: number;
  tone?: Tone;
  signed?: boolean;
  className?: string;
}) {
  const value = tone === "expense" && signed ? -Math.abs(cents) : cents;
  return (
    <span
      className={cn(
        "tabular whitespace-nowrap",
        tone === "income" && "text-income",
        tone === "expense" && "text-expense",
        tone === "transfer" && "text-transfer",
        className,
      )}
    >
      {formatBRL(value, { signed: signed && tone === "income" })}
    </span>
  );
}
