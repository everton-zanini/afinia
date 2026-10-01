import Link from "next/link";
import { Ticket, Wallet } from "lucide-react";
import { formatBRL } from "@/lib/money";

/**
 * Saldos: disponível para uso geral (sem benefícios) em destaque; benefícios à parte; total
 * consolidado sempre com a composição.
 */
export function BalanceSummary({
  generalCents,
  benefitCents,
  totalCents,
  benefits,
  showAccountsLink = false,
}: {
  generalCents: number;
  benefitCents: number;
  totalCents: number;
  benefits: { id: string; name: string; cents: number }[];
  showAccountsLink?: boolean;
}) {
  return (
    <div className="grid gap-2">
      <section aria-label="Disponível para uso geral" className="rounded-3xl bg-primary p-5 text-primary-foreground shadow-sm">
        <p className="text-sm opacity-90">Disponível para uso geral</p>
        <p className="mt-1 text-3xl font-semibold tabular">{formatBRL(generalCents)}</p>
        <p className="mt-1 text-sm opacity-90">Contas bancárias, dinheiro e reservas. Não inclui benefícios.</p>
        {showAccountsLink && (
          <Link href="/mais/contas" className="mt-2 inline-flex min-h-11 items-center gap-1 text-sm font-medium underline-offset-4 hover:underline">
            <Wallet aria-hidden className="size-4" /> Ver contas
          </Link>
        )}
      </section>
      {benefits.length > 0 && (
        <section aria-label="Em benefícios" className="grid gap-2 rounded-2xl bg-card p-4 ring-1 ring-border">
          <div className="flex items-baseline justify-between gap-2">
            <p className="flex items-center gap-1.5 text-sm font-medium">
              <Ticket aria-hidden className="size-4 text-primary" /> Em benefícios
            </p>
            <p className="font-semibold tabular">{formatBRL(benefitCents)}</p>
          </div>
          <ul className="grid gap-1 text-sm">
            {benefits.map((b) => (
              <li key={b.id} className="flex justify-between gap-2 text-muted-foreground">
                <span className="truncate">{b.name}</span>
                <span className="tabular">{formatBRL(b.cents)}</span>
              </li>
            ))}
          </ul>
          <p className="border-t pt-2 text-sm">
            Total consolidado: <strong className="tabular">{formatBRL(totalCents)}</strong>{" "}
            <span className="text-muted-foreground">
              = {formatBRL(generalCents)} de uso geral + {formatBRL(benefitCents)} em benefícios
            </span>
          </p>
        </section>
      )}
    </div>
  );
}
