import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Lock, Repeat, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { InvoiceStatusBadges } from "@/components/card-widgets";
import { ConfirmAction } from "@/components/confirm-action";
import { FormMessage } from "@/components/form";
import { Money } from "@/components/money";
import { formatDate, todayISO } from "@/lib/dates";
import { deletePurchaseAction } from "@/server/actions/cards";
import { NotFoundError } from "@/server/errors";
import { getPurchase, selectableInvoices } from "@/server/finance/cards";
import { requireHousehold } from "@/server/session";
import { randomUUID } from "node:crypto";
import { loadPurchaseContext } from "../../cards-data";
import { PurchaseForm } from "../../purchase-form";
import { MoveInstallment } from "./move-installment";

export const metadata: Metadata = { title: "Compra no cartão" };

export default async function PurchasePage({ params, searchParams }: PageProps<"/cartoes/compras/[id]">) {
  const { ctx } = await requireHousehold();
  const { id } = await params;
  const { salvo } = await searchParams;
  const today = todayISO();
  const purchase = await getPurchase(ctx, id, today).catch((e) => {
    if (e instanceof NotFoundError) notFound();
    throw e;
  });
  const [data, targets] = await Promise.all([
    loadPurchaseContext(ctx, purchase.cardId, today, purchase.categoryId),
    selectableInvoices(ctx, purchase.cardId, today),
  ]);
  const moveOptions = targets
    .filter((t) => t.status.paidCents === 0)
    .map((t) => ({ id: t.id, label: `Vence ${formatDate(t.dueDate)} (fecha ${formatDate(t.closingDate)})` }));

  return (
    <>
      <PageHeader title={purchase.description} backHref={`/cartoes/${purchase.cardId}`} description={`${purchase.cardName} · ${formatDate(purchase.purchaseDate)}`} />
      <div className="grid gap-4">
        {salvo && <FormMessage ok message="Alterações salvas." />}
        <section className="grid gap-1 rounded-2xl bg-card p-5 text-center ring-1 ring-border">
          <p className="text-3xl font-semibold"><Money cents={purchase.totalCents} tone="expense" /></p>
          <p className="text-sm text-muted-foreground">
            {purchase.installmentCount > 1 ? `${purchase.installmentCount} parcelas` : "À vista"} · cadastrada por {purchase.createdBy}
          </p>
          {purchase.seriesId && (
            <Link href={`/mais/recorrencias#${purchase.seriesId}`} className="mx-auto inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline">
              <Repeat aria-hidden className="size-4" /> Cobrança de recorrência
            </Link>
          )}
        </section>

        {purchase.locked && (
          <p role="note" className="flex items-start gap-2 rounded-lg bg-muted px-3 py-2.5 text-sm">
            <Lock aria-hidden className="mt-0.5 size-4 shrink-0" />
            Há pagamento registrado em uma fatura desta compra. Valores, parcelas, datas e faturas não podem mudar, e a compra não pode ser excluída; descrição, categoria, responsável e observação continuam editáveis. Se foi um erro de cadastro, desfaça o pagamento na fatura antes.
          </p>
        )}

        <section aria-labelledby="parcelas" className="grid gap-2">
          <h2 id="parcelas" className="px-1 font-semibold">Parcelas</h2>
          <ul className="divide-y overflow-hidden rounded-2xl bg-card ring-1 ring-border">
            {purchase.installments.map((i) => (
              <li key={i.id} className="grid gap-2 px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="min-w-0 flex-1">
                    <Link href={`/cartoes/${purchase.cardId}?fatura=${i.invoice.id}`} className="block font-medium underline-offset-4 hover:underline">
                      {purchase.installmentCount > 1 ? `Parcela ${i.index}/${purchase.installmentCount}` : "À vista"} · vence {formatDate(i.invoice.dueDate)}
                    </Link>
                    <InvoiceStatusBadges status={i.invoice.status} />
                  </span>
                  <Money cents={i.amountCents} tone="expense" className="font-semibold" />
                </div>
                {!purchase.locked && purchase.installmentCount > 1 && (
                  <div>
                    <MoveInstallment
                      installmentId={i.id}
                      label={`parcela ${i.index}/${purchase.installmentCount}`}
                      currentInvoiceId={i.invoice.id}
                      options={moveOptions}
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="editar" className="grid gap-2">
          <h2 id="editar" className="px-1 font-semibold">Editar compra</h2>
          {!purchase.locked && purchase.installmentCount > 1 && (
            <p className="px-1 text-sm text-muted-foreground">Alterar valor, parcelas, data ou fatura recalcula todas as {purchase.installmentCount} parcelas.</p>
          )}
          <PurchaseForm
            {...data.common}
            purchaseId={purchase.id}
            idempotencyKey={randomUUID()}
            categories={data.categories}
            members={data.members}
            locked={purchase.locked}
            initial={{
              description: purchase.description,
              totalCents: purchase.totalCents,
              purchaseDate: purchase.purchaseDate,
              categoryId: purchase.categoryId,
              responsibleMemberId: purchase.responsibleMemberId,
              notes: purchase.notes,
              installmentCount: purchase.installmentCount,
              invoiceId: purchase.startInvoiceId,
            }}
          />
        </section>

        {!purchase.locked && (
          <ConfirmAction
            action={deletePurchaseAction.bind(null, purchase.id)}
            title="Excluir compra?"
            description={
              purchase.installmentCount > 1
                ? `“${purchase.description}” e todas as ${purchase.installmentCount} parcelas serão excluídas das faturas. Esta ação não pode ser desfeita.`
                : `“${purchase.description}” será excluída da fatura. Esta ação não pode ser desfeita.`
            }
            confirmLabel="Excluir"
            variant="destructive"
            destructive
          >
            <Trash2 aria-hidden />
            Excluir compra
          </ConfirmAction>
        )}
      </div>
    </>
  );
}
