import type { Metadata } from "next";
import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/app-shell/page-header";
import { Button } from "@/components/ui/button";
import { todayISO } from "@/lib/dates";
import { NotFoundError } from "@/server/errors";
import { getForecast } from "@/server/finance/cards";
import { requireHousehold } from "@/server/session";
import { loadPurchaseContext } from "../../cards-data";
import { ConfirmForecastForm, PurchaseForm } from "../../purchase-form";

export const metadata: Metadata = { title: "Nova compra no cartão" };

export default async function NewPurchasePage({ params, searchParams }: PageProps<"/cartoes/[id]/compra">) {
  const { ctx } = await requireHousehold();
  const { id } = await params;
  const { previsao } = await searchParams;
  const today = todayISO();
  const data = await loadPurchaseContext(ctx, id, today).catch((e) => {
    if (e instanceof NotFoundError) notFound();
    throw e;
  });

  if (data.card.archived) {
    return (
      <>
        <PageHeader title="Nova compra" backHref={`/cartoes/${id}`} />
        <div className="rounded-2xl bg-card p-5 text-center ring-1 ring-border">
          <p className="font-semibold">Cartão arquivado</p>
          <p className="mt-1 text-sm text-muted-foreground">Cartões arquivados não aceitam novas compras. Reative o cartão para registrar compras.</p>
          <Button asChild variant="outline" className="mt-4">
            <Link href={`/cartoes/${id}/editar`}>Reativar cartão</Link>
          </Button>
        </div>
      </>
    );
  }

  if (typeof previsao === "string") {
    const forecast = await getForecast(ctx, previsao, today).catch((e) => {
      if (e instanceof NotFoundError) notFound();
      throw e;
    });
    if (forecast.cardId !== id) notFound();
    return (
      <>
        <PageHeader title="Confirmar cobrança" backHref={`/cartoes/${id}`} description={`Prevista para ${forecast.expectedDate.split("-").reverse().join("/")}`} />
        <ConfirmForecastForm
          {...data.common}
          forecastId={forecast.id}
          description={forecast.description}
          initialCents={forecast.amountCents}
          confirmDate={forecast.confirmDate}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Nova compra" backHref={`/cartoes/${id}`} description={data.card.name} />
      {/* Chave nova a cada abertura do formulário: reenvios do mesmo formulário não duplicam. */}
      <PurchaseForm
        {...data.common}
        purchaseId={null}
        idempotencyKey={randomUUID()}
        categories={data.categories}
        members={data.members}
        initial={{ description: "", totalCents: null, purchaseDate: today, categoryId: "", responsibleMemberId: null, notes: null, installmentCount: 1, invoiceId: "" }}
      />
    </>
  );
}
