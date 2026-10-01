import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ChevronLeft, ChevronRight, Pencil, Plus, Undo2 } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { InvoiceStatusBadges, LimitBar } from "@/components/card-widgets";
import { ConfirmAction } from "@/components/confirm-action";
import { FutureInvoicesBars } from "@/components/charts";
import { FormMessage } from "@/components/form";
import { Money } from "@/components/money";
import { Button } from "@/components/ui/button";
import { formatDate, formatMonthShort, monthOf, todayISO } from "@/lib/dates";
import { undoPaymentAction } from "@/server/actions/cards";
import { NotFoundError } from "@/server/errors";
import { listAccounts } from "@/server/finance/accounts";
import { getCardDetail } from "@/server/finance/cards";
import { requireHousehold } from "@/server/session";
import { ForecastActions } from "./forecast-actions";
import { InvoicePicker } from "./invoice-picker";
import { PayInvoice } from "./pay-invoice";

export const metadata: Metadata = { title: "Cartão" };

const SAVED: Record<string, string> = {
  novo: "Cartão cadastrado.",
  cartao: "Alterações salvas.",
  compra: "Compra registrada.",
  confirmada: "Cobrança confirmada.",
  excluida: "Compra excluída.",
};

export default async function CardPage({ params, searchParams }: PageProps<"/cartoes/[id]">) {
  const { ctx } = await requireHousehold();
  const { id } = await params;
  const { fatura, salvo, acima } = await searchParams;
  const today = todayISO();
  const detail = await getCardDetail(ctx, id, typeof fatura === "string" ? fatura : null, today).catch((e) => {
    if (e instanceof NotFoundError) notFound();
    throw e;
  });
  const { card, invoice } = detail;
  const accounts = (await listAccounts(ctx)).filter((a) => a.kind !== "BENEFIT");
  const totalByCategory = invoice?.byCategory.reduce((s, c) => s + c.amountCents, 0) ?? 0;

  const byMonth = new Map<string, number>();
  for (const u of detail.upcoming) byMonth.set(monthOf(u.dueDate), (byMonth.get(monthOf(u.dueDate)) ?? 0) + u.totalCents);
  const future = [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(0, 12);

  return (
    <>
      <PageHeader
        title={card.name}
        backHref="/cartoes"
        description={[card.lastFour && `final ${card.lastFour}`, card.issuer, `fecha dia ${card.closingDay} · vence dia ${card.dueDay}`, card.archived && "arquivado"].filter(Boolean).join(" · ")}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href={`/cartoes/${id}/editar`}>
              <Pencil aria-hidden />
              Editar
            </Link>
          </Button>
        }
      />
      <div className="grid gap-4">
        {typeof salvo === "string" && SAVED[salvo] && <FormMessage ok message={SAVED[salvo]} />}
        {acima === "1" && (
          <p role="status" className="flex items-start gap-2 rounded-lg bg-expense-soft px-3 py-2.5 text-sm font-medium text-destructive">
            <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
            Acima do limite estimado. A compra foi salva mesmo assim.
          </p>
        )}

        <section aria-label="Limite estimado" className="grid gap-2 rounded-2xl bg-card p-4 ring-1 ring-border">
          <LimitBar limit={card.limit} name={card.name} />
          <p className="text-xs text-muted-foreground">
            Estimativa manual: parcelas confirmadas (inclusive futuras) menos pagamentos registrados. Previsões de recorrência e saldos de contas não entram.
          </p>
          {!card.archived && (
            <Button asChild>
              <Link href={`/cartoes/${id}/compra`}>
                <Plus aria-hidden />
                Nova compra
              </Link>
            </Button>
          )}
        </section>

        {invoice ? (
          <>
            <section aria-labelledby="fatura" className="grid gap-3 rounded-2xl bg-card p-4 ring-1 ring-border">
              <div className="flex items-center justify-between gap-2">
                <Button asChild={!!invoice.previousId} variant="ghost" size="icon" disabled={!invoice.previousId} aria-label="Fatura anterior">
                  {invoice.previousId ? (
                    <Link href={`/cartoes/${id}?fatura=${invoice.previousId}`} aria-label="Fatura anterior">
                      <ChevronLeft aria-hidden />
                    </Link>
                  ) : (
                    <ChevronLeft aria-hidden />
                  )}
                </Button>
                <div className="min-w-0 text-center">
                  <h2 id="fatura" className="font-semibold">Fatura de vencimento {formatDate(invoice.dueDate)}</h2>
                  <p className="text-xs text-muted-foreground">
                    Ciclo {formatDate(invoice.periodStart)} a {formatDate(invoice.closingDate)}
                  </p>
                </div>
                <Button asChild={!!invoice.nextId} variant="ghost" size="icon" disabled={!invoice.nextId} aria-label="Próxima fatura">
                  {invoice.nextId ? (
                    <Link href={`/cartoes/${id}?fatura=${invoice.nextId}`} aria-label="Próxima fatura">
                      <ChevronRight aria-hidden />
                    </Link>
                  ) : (
                    <ChevronRight aria-hidden />
                  )}
                </Button>
              </div>
              <InvoicePicker
                cardId={id}
                selectedId={invoice.id}
                options={detail.invoices.map((i) => ({ id: i.id, label: `Vence ${formatDate(i.dueDate)} · ${i.status.totalCents ? "" : "sem compras"}`.replace(/ · $/, "") }))}
              />
              <dl className="grid grid-cols-3 gap-2 text-sm">
                <div>
                  <dt className="text-muted-foreground">Total</dt>
                  <dd className="font-semibold"><Money cents={invoice.status.totalCents} /></dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Pago</dt>
                  <dd className="font-semibold"><Money cents={invoice.status.paidCents} /></dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Saldo devedor</dt>
                  <dd className="font-semibold"><Money cents={invoice.status.remainingCents} /></dd>
                </div>
              </dl>
              <InvoiceStatusBadges status={invoice.status} />
              <p className="text-xs text-muted-foreground">
                A fatura sugerida é uma previsão manual e pode diferir da instituição. Juros, multas e encargos não estão incluídos.
              </p>
              <PayInvoice
                invoiceId={invoice.id}
                remainingCents={invoice.status.remainingCents}
                accounts={accounts.map((a) => ({ id: a.id, name: a.name }))}
                defaultAccountId={card.paymentAccount?.id ?? null}
                today={today}
              />
            </section>

            <section aria-labelledby="compras" className="grid gap-2">
              <h2 id="compras" className="px-1 font-semibold">Compras e parcelas</h2>
              {invoice.installments.length === 0 ? (
                <p className="rounded-2xl bg-card p-4 text-sm text-muted-foreground ring-1 ring-border">Nenhuma compra confirmada nesta fatura.</p>
              ) : (
                <ul className="divide-y overflow-hidden rounded-2xl bg-card ring-1 ring-border">
                  {invoice.installments.map((i) => (
                    <li key={i.id}>
                      <Link href={`/cartoes/compras/${i.purchaseId}`} className="flex min-h-16 items-center gap-3 px-4 py-2.5 hover:bg-muted/60">
                        <span aria-hidden className="size-3 shrink-0 rounded-full" style={{ backgroundColor: i.category.color }} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{i.description}</span>
                          <span className="block truncate text-sm text-muted-foreground">
                            {i.category.name} · {formatDate(i.purchaseDate)}
                            {i.count > 1 && ` · parcela ${i.index}/${i.count}`}
                          </span>
                        </span>
                        <Money cents={i.amountCents} tone="expense" className="font-semibold" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {invoice.forecasts.length > 0 && (
              <section aria-labelledby="previsoes" className="grid gap-2">
                <h2 id="previsoes" className="px-1 font-semibold">Cobranças previstas (recorrências)</h2>
                <p className="px-1 text-sm text-muted-foreground">Previsões não afetam o limite nem os saldos até serem confirmadas.</p>
                <ul className="divide-y overflow-hidden rounded-2xl bg-card ring-1 ring-border">
                  {invoice.forecasts.map((f) => (
                    <li key={f.id} className="grid gap-2 px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span aria-hidden className="size-3 shrink-0 rounded-full" style={{ backgroundColor: f.category.color }} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{f.description}</span>
                          <span className="block text-sm text-muted-foreground">Previsto · {formatDate(f.expectedDate)} · {f.category.name}</span>
                        </span>
                        <Money cents={f.amountCents} className="font-semibold opacity-80" />
                      </div>
                      <ForecastActions id={f.id} cardId={id} archived={card.archived} description={f.description} />
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section aria-labelledby="pagamentos" className="grid gap-2">
              <h2 id="pagamentos" className="px-1 font-semibold">Pagamentos desta fatura</h2>
              {invoice.payments.length === 0 ? (
                <p className="rounded-2xl bg-card p-4 text-sm text-muted-foreground ring-1 ring-border">Nenhum pagamento registrado.</p>
              ) : (
                <ul className="divide-y overflow-hidden rounded-2xl bg-card ring-1 ring-border">
                  {invoice.payments.map((p) => (
                    <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium"><Money cents={p.amountCents} tone="expense" /></span>
                        <span className="block truncate text-sm text-muted-foreground">
                          {formatDate(p.date)} · {p.account.name} · {p.createdBy}
                        </span>
                      </span>
                      <ConfirmAction
                        action={undoPaymentAction.bind(null, p.id)}
                        title="Desfazer pagamento?"
                        description="O valor volta para a conta e o saldo devedor da fatura é restaurado."
                        confirmLabel="Desfazer"
                      >
                        <Undo2 aria-hidden />
                        Desfazer
                      </ConfirmAction>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {invoice.byCategory.length > 0 && (
              <section aria-labelledby="categorias" className="grid gap-2">
                <h2 id="categorias" className="px-1 font-semibold">Gastos por categoria nesta fatura</h2>
                <ul className="divide-y overflow-hidden rounded-2xl bg-card ring-1 ring-border">
                  {invoice.byCategory.map((c) => (
                    <li key={c.categoryId} className="flex min-h-12 items-center gap-3 px-4 py-2">
                      <span aria-hidden className="size-3 shrink-0 rounded-full" style={{ backgroundColor: c.color }} />
                      <span className="min-w-0 flex-1 truncate">{c.name}</span>
                      <span className="text-right text-sm">
                        <Money cents={c.amountCents} className="font-semibold" />
                        <span className="block text-xs text-muted-foreground">{Math.round((c.amountCents * 100) / totalByCategory)}%</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        ) : (
          <p className="rounded-2xl bg-card p-4 text-sm text-muted-foreground ring-1 ring-border">
            Este cartão ainda não tem faturas. A primeira é criada ao registrar a primeira compra.
          </p>
        )}

        <section aria-labelledby="futuras" className="grid gap-3 rounded-2xl bg-card p-4 ring-1 ring-border">
          <h2 id="futuras" className="font-semibold">Próximas faturas e parcelas futuras</h2>
          {future.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum compromisso em faturas que ainda vencem.</p>
          ) : (
            <>
              <FutureInvoicesBars
                label={`Compromissos por mês de vencimento: ${future.map(([m, c]) => `${formatMonthShort(m)} ${(c / 100).toFixed(2).replace(".", ",")}`).join("; ")}`}
                data={future.map(([m, c]) => ({ label: formatMonthShort(m), Compromisso: c }))}
              />
              <table className="w-full text-sm">
                <caption className="sr-only">Compromissos por mês de vencimento</caption>
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th scope="col" className="py-1 font-medium">Vencimento</th>
                    <th scope="col" className="py-1 text-right font-medium">Compromisso</th>
                    <th scope="col" className="py-1 text-right font-medium">Saldo devedor</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.upcoming.map((u) => (
                    <tr key={u.invoiceId} className="border-t">
                      <td className="py-1.5">
                        <Link href={`/cartoes/${id}?fatura=${u.invoiceId}`} className="text-primary underline-offset-4 hover:underline">{formatDate(u.dueDate)}</Link>
                      </td>
                      <td className="py-1.5 text-right"><Money cents={u.totalCents} /></td>
                      <td className="py-1.5 text-right"><Money cents={u.remainingCents} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </section>
      </div>
    </>
  );
}
