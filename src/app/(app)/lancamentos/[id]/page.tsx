import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftRight, Copy, Pencil, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { CategoryBadge } from "@/components/category-icon";
import { ConfirmAction } from "@/components/confirm-action";
import { FormMessage } from "@/components/form";
import { Money } from "@/components/money";
import { TransactionStatus } from "@/components/transaction-status";
import { Button } from "@/components/ui/button";
import { formatDate, todayISO } from "@/lib/dates";
import { NotFoundError } from "@/server/errors";
import { getTransaction } from "@/server/finance/transactions";
import { deleteTransactionAction } from "@/server/actions/finance";
import { requireHousehold } from "@/server/session";
import { StatusActions } from "./status-actions";
import { DeleteOccurrence } from "./delete-occurrence";
import { SeriesBadge } from "@/components/series-badge";

export const metadata: Metadata = { title: "Lançamento" };

const KIND_LABEL = { INCOME: "Receita", EXPENSE: "Despesa", TRANSFER: "Transferência" } as const;
const TONE = { INCOME: "income", EXPENSE: "expense", TRANSFER: "transfer" } as const;
const timestamp = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-right text-sm font-medium">{children}</dd>
    </div>
  );
}

export default async function TransactionPage({ params, searchParams }: PageProps<"/lancamentos/[id]">) {
  const { ctx } = await requireHousehold();
  const { id } = await params;
  const { salvo } = await searchParams;
  const t = await getTransaction(ctx, id).catch((e) => {
    if (e instanceof NotFoundError) notFound();
    throw e;
  });
  const today = todayISO();

  return (
    <>
      <PageHeader title={KIND_LABEL[t.kind]} backHref="/lancamentos" />
      <div className="grid gap-4">
        {salvo && <FormMessage ok message="Alterações salvas." />}
        <section className="grid gap-2 rounded-2xl bg-card p-5 text-center ring-1 ring-border">
          <div className="mx-auto">
            {t.category ? (
              <CategoryBadge icon={t.category.icon} color={t.category.color} size="lg" />
            ) : (
              <span className="flex size-12 items-center justify-center rounded-full bg-transfer-soft text-transfer">
                <ArrowLeftRight aria-hidden className="size-6" />
              </span>
            )}
          </div>
          <p className="font-medium">{t.description}</p>
          <p className="text-3xl font-semibold">
            <Money cents={t.amountCents} tone={TONE[t.kind]} signed={t.kind !== "TRANSFER"} />
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
            <TransactionStatus status={t.status} kind={t.kind} dueDate={t.dueDate} today={today} />
            {t.series && <SeriesBadge label={t.series.label} />}
          </div>
          {t.series && (
            <Link href={`/mais/recorrencias#${t.series.id}`} className="mx-auto inline-flex min-h-11 items-center text-sm font-medium text-primary underline-offset-4 hover:underline">
              Ver recorrência{t.series.override ? " · ajustado individualmente" : ""}
            </Link>
          )}
        </section>

        <StatusActions id={t.id} status={t.status} kind={t.kind} today={today} />

        <dl className="divide-y rounded-2xl bg-card px-4 ring-1 ring-border">
          {t.category && (
            <Row label="Categoria">{t.category.parentName ? `${t.category.parentName} › ${t.category.name}` : t.category.name}</Row>
          )}
          <Row label={t.kind === "TRANSFER" ? "De" : "Conta"}>{t.account.name}</Row>
          {t.toAccount && <Row label="Para">{t.toAccount.name}</Row>}
          <Row label={t.kind === "INCOME" ? "Data prevista" : "Vencimento"}>{formatDate(t.dueDate)}</Row>
          <Row label="Efetivado em">{t.effectiveDate ? formatDate(t.effectiveDate) : "Ainda não"}</Row>
          <Row label="Responsável">{t.responsible?.name ?? "Ninguém em especial"}</Row>
          <Row label="Cadastrado por">
            {t.createdBy.name}
            <span className="block text-xs font-normal text-muted-foreground">{timestamp.format(new Date(t.createdAt))}</span>
          </Row>
          {t.updatedAt !== t.createdAt && <Row label="Atualizado em">{timestamp.format(new Date(t.updatedAt))}</Row>}
          {t.notes && <Row label="Observação"><span className="whitespace-pre-wrap font-normal">{t.notes}</span></Row>}
        </dl>

        <div className="grid grid-cols-2 gap-2">
          <Button asChild variant="outline">
            <Link href={`/lancamentos/${t.id}/editar`}>
              <Pencil aria-hidden />
              Editar
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/lancamentos/novo?duplicar=${t.id}`}>
              <Copy aria-hidden />
              Duplicar
            </Link>
          </Button>
          {t.series ? (
            <DeleteOccurrence id={t.id} description={t.description} />
          ) : (
          <ConfirmAction
            action={deleteTransactionAction.bind(null, t.id)}
            title="Excluir lançamento?"
            description={`"${t.description}" será excluído e os saldos serão recalculados. Esta ação não pode ser desfeita.`}
            confirmLabel="Excluir"
            variant="destructive"
            destructive
            className="col-span-2"
          >
            <Trash2 aria-hidden />
            Excluir
          </ConfirmAction>
          )}
        </div>
      </div>
    </>
  );
}
