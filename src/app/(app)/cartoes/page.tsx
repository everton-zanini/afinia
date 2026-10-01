import type { Metadata } from "next";
import Link from "next/link";
import { CreditCard, Plus } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { InvoiceStatusBadges, LimitBar } from "@/components/card-widgets";
import { EmptyState } from "@/components/empty-state";
import { Money } from "@/components/money";
import { Button } from "@/components/ui/button";
import { formatDate, todayISO } from "@/lib/dates";
import { listCards, type CardSummary } from "@/server/finance/cards";
import { requireHousehold } from "@/server/session";

export const metadata: Metadata = { title: "Cartões" };

function CardItem({ card }: { card: CardSummary }) {
  const inv = card.currentInvoice;
  return (
    <li className="grid gap-3 rounded-2xl bg-card p-4 ring-1 ring-border">
      <Link href={`/cartoes/${card.id}`} className="flex min-h-11 items-center gap-3">
        <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full text-white" style={{ backgroundColor: card.color }}>
          <CreditCard className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">
            {card.name}
            {card.lastFour && <span className="font-normal text-muted-foreground"> · final {card.lastFour}</span>}
          </span>
          <span className="block truncate text-sm text-muted-foreground">
            {[card.issuer, card.holder && `Titular: ${card.holder.name}`, card.archived && "Arquivado"].filter(Boolean).join(" · ")}
          </span>
        </span>
      </Link>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-muted-foreground">Fatura atual</dt>
          <dd className="font-semibold">{inv ? <Money cents={inv.status.totalCents} /> : "Sem fatura"}</dd>
          {inv && <dd className="text-xs text-muted-foreground">Fecha em {formatDate(inv.closingDate)}</dd>}
        </div>
        <div>
          <dt className="text-muted-foreground">Próximo vencimento</dt>
          <dd className="font-semibold">{card.nextDue ? formatDate(card.nextDue.dueDate) : "Nada a pagar"}</dd>
          {card.nextDue && (
            <dd className="text-xs text-muted-foreground">
              Saldo devedor <Money cents={card.nextDue.status.remainingCents} />
            </dd>
          )}
        </div>
      </dl>
      {card.nextDue && <InvoiceStatusBadges status={card.nextDue.status} />}
      <LimitBar limit={card.limit} name={card.name} />
      {!card.archived && (
        <Button asChild variant="outline" size="sm">
          <Link href={`/cartoes/${card.id}/compra`}>
            <Plus aria-hidden />
            Nova compra
          </Link>
        </Button>
      )}
    </li>
  );
}

export default async function CardsPage() {
  const { ctx } = await requireHousehold();
  const cards = await listCards(ctx, todayISO());
  const active = cards.filter((c) => !c.archived);
  const archived = cards.filter((c) => c.archived);
  return (
    <>
      <PageHeader
        title="Cartões"
        backHref="/mais"
        description="Controle manual: o limite é uma estimativa e não consulta o banco."
        actions={
          <Button asChild size="sm">
            <Link href="/cartoes/novo">
              <Plus aria-hidden />
              Novo cartão
            </Link>
          </Button>
        }
      />
      {cards.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title="Nenhum cartão cadastrado"
          description="Cadastre um cartão de crédito para acompanhar compras, parcelas e faturas sem contar o mesmo gasto duas vezes."
          action={
            <Button asChild>
              <Link href="/cartoes/novo">Cadastrar cartão</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-5">
          <ul className="grid gap-3">{active.map((c) => <CardItem key={c.id} card={c} />)}</ul>
          {archived.length > 0 && (
            <section aria-labelledby="arquivados" className="grid gap-2">
              <h2 id="arquivados" className="px-1 text-sm font-semibold text-muted-foreground">Arquivados</h2>
              <ul className="grid gap-3">{archived.map((c) => <CardItem key={c.id} card={c} />)}</ul>
            </section>
          )}
        </div>
      )}
    </>
  );
}
