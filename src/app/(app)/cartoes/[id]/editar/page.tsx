import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Archive, ArchiveRestore } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { ConfirmAction } from "@/components/confirm-action";
import { todayISO } from "@/lib/dates";
import { archiveCardAction } from "@/server/actions/cards";
import { NotFoundError } from "@/server/errors";
import { listAccounts } from "@/server/finance/accounts";
import { getCardSummary } from "@/server/finance/cards";
import { requireHousehold } from "@/server/session";
import { CardForm } from "../../card-form";

export const metadata: Metadata = { title: "Editar cartão" };

export default async function EditCardPage({ params }: PageProps<"/cartoes/[id]/editar">) {
  const { ctx } = await requireHousehold();
  const { id } = await params;
  const card = await getCardSummary(ctx, id, todayISO()).catch((e) => {
    if (e instanceof NotFoundError) notFound();
    throw e;
  });
  const paymentAccountId = card.paymentAccount?.id ?? null;
  const accounts = (await listAccounts(ctx, { includeArchived: true })).filter(
    (a) => a.kind !== "BENEFIT" && (!a.archived || a.id === paymentAccountId),
  );

  return (
    <>
      <PageHeader title={`Editar ${card.name}`} backHref={`/cartoes/${id}`} />
      <div className="grid gap-4">
        <CardForm
          card={{
            id: card.id,
            name: card.name,
            issuer: card.issuer,
            lastFour: card.lastFour,
            color: card.color,
            limitCents: card.limitCents,
            closingDay: card.closingDay,
            dueDay: card.dueDay,
            holderMemberId: card.holder?.memberId ?? null,
            paymentAccountId,
          }}
          members={ctx.members.map((m) => ({ memberId: m.memberId, name: m.name }))}
          accounts={accounts.map((a) => ({ id: a.id, name: a.name }))}
        />
        <section className="grid gap-2 rounded-2xl bg-card p-4 ring-1 ring-border">
          <h2 className="font-semibold">Arquivar</h2>
          <p className="text-sm text-muted-foreground">
            Cartão arquivado não aceita novas compras nem confirmações de cobranças recorrentes e para de gerar previsões. Compras, faturas e pagamentos continuam acessíveis, e faturas com saldo devedor ainda podem ser pagas.
          </p>
          <ConfirmAction
            action={archiveCardAction.bind(null, id, !card.archived)}
            title={card.archived ? "Reativar cartão?" : "Arquivar cartão?"}
            description={
              card.archived
                ? "Ele voltará a aceitar compras e a gerar previsões de cobranças recorrentes."
                : "Ele deixará de aceitar novas compras. O histórico, as faturas e os pagamentos são mantidos."
            }
            confirmLabel={card.archived ? "Reativar" : "Arquivar"}
          >
            {card.archived ? <ArchiveRestore aria-hidden /> : <Archive aria-hidden />}
            {card.archived ? "Reativar" : "Arquivar"}
          </ConfirmAction>
        </section>
      </div>
    </>
  );
}
