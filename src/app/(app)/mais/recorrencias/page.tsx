import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowLeftRight, CircleCheck, CircleSlash, ListOrdered, Repeat } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { CategoryBadge } from "@/components/category-icon";
import { EmptyState } from "@/components/empty-state";
import { Money } from "@/components/money";
import { Button } from "@/components/ui/button";
import { formatDate, todayISO } from "@/lib/dates";
import { frequencyLabel } from "@/lib/finance/recurrence";
import { listSeries, type SeriesView } from "@/server/finance/recurrences";
import { requireHousehold } from "@/server/session";
import { EndSeriesButton } from "./end-series-button";

export const metadata: Metadata = { title: "Recorrências" };

const TONE = { INCOME: "income", EXPENSE: "expense", TRANSFER: "transfer" } as const;

function endText(s: SeriesView) {
  if (s.endMode === "COUNT") return `${s.occurrenceCount} ocorrências`;
  if (s.endMode === "UNTIL") return `até ${formatDate(s.untilDate!)}`;
  return "sem término";
}

function SeriesCard({ s, today }: { s: SeriesView; today: string }) {
  const active = s.summary.programming === "active";
  return (
    <article id={s.id} className="grid scroll-mt-4 gap-3 rounded-2xl bg-card p-4 ring-1 ring-border">
      <div className="flex items-start gap-3">
        {s.categoryIcon && s.categoryColor ? (
          <CategoryBadge icon={s.categoryIcon} color={s.categoryColor} />
        ) : (
          <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-transfer-soft text-transfer">
            <ArrowLeftRight className="size-5" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{s.description}</p>
          <p className="truncate text-sm text-muted-foreground">
            {s.kind === "TRANSFER" ? `${s.accountName} → ${s.toAccountName}` : `${s.categoryName} · ${s.accountName}`}
          </p>
          <p className="mt-0.5 flex items-start gap-1 text-xs text-muted-foreground">
            <Repeat aria-hidden className="mt-0.5 size-3.5 shrink-0" />
            <span>
              {frequencyLabel(s.frequency)} · desde {formatDate(s.startDate)} · {endText(s)}
            </span>
          </p>
        </div>
        <Money cents={s.amountCents} tone={TONE[s.kind]} signed={s.kind !== "TRANSFER"} className="font-semibold" />
      </div>

      <dl className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <dt className="text-muted-foreground">Programação</dt>
          <dd className={`flex items-center gap-1 font-semibold ${active ? "text-income" : "text-muted-foreground"}`}>
            {active ? <CircleCheck aria-hidden className="size-3.5" /> : <CircleSlash aria-hidden className="size-3.5" />}
            {active ? "Ativa" : "Encerrada"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Pendentes</dt>
          <dd className="font-semibold">
            {s.summary.pendingCount} {s.summary.pendingCount === 1 ? "lançamento" : "lançamentos"}
            <Money cents={s.summary.pendingCents} className="block font-normal text-muted-foreground" />
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">A gerar</dt>
          <dd className="font-semibold">{s.summary.toGenerate === null ? "—" : s.summary.toGenerate}</dd>
        </div>
      </dl>
      {s.nextPendingDate && (
        <p className="text-sm">
          Próxima pendente: <strong>{formatDate(s.nextPendingDate)}</strong>
          {s.nextPendingDate < today && <span className="ml-1 text-expense">(vencida)</span>}
        </p>
      )}
      {s.usesArchived && active && (
        <p className="flex items-center gap-1 text-sm text-warning">
          <AlertTriangle aria-hidden className="size-4" /> Usa conta ou categoria arquivada.
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Button asChild variant="outline">
          <Link href={`/lancamentos?serie=${s.id}&mes=todos`}>
            <ListOrdered aria-hidden /> Lançamentos
          </Link>
        </Button>
        {active ? <EndSeriesButton seriesId={s.id} description={s.description} today={today} /> : <span />}
      </div>
    </article>
  );
}

export default async function RecurrencesPage() {
  const { ctx } = await requireHousehold();
  const today = todayISO();
  const all = await listSeries(ctx);
  const active = all.filter((s) => s.summary.programming === "active");
  const ended = all.filter((s) => s.summary.programming === "ended");

  return (
    <>
      <PageHeader
        title="Recorrências"
        backHref="/mais"
        description="Receitas, despesas e transferências que se repetem. Para criar, use “Repetir” no novo lançamento."
      />
      {all.length === 0 ? (
        <EmptyState
          icon={Repeat}
          title="Nenhuma recorrência"
          description="Ao registrar um lançamento, ative “Repetir” para salário, aluguel, assinaturas e outras contas periódicas."
          action={<Button asChild><Link href="/lancamentos/novo">Novo lançamento</Link></Button>}
        />
      ) : (
        <div className="grid gap-6">
          <section aria-labelledby="ativas" className="grid gap-2">
            <h2 id="ativas" className="px-1 text-sm font-semibold text-muted-foreground">Programação ativa ({active.length})</h2>
            {active.length === 0 ? (
              <p className="rounded-2xl bg-card p-4 text-sm text-muted-foreground ring-1 ring-border">Nenhuma.</p>
            ) : (
              active.map((s) => <SeriesCard key={s.id} s={s} today={today} />)
            )}
          </section>
          {ended.length > 0 && (
            <section aria-labelledby="encerradas" className="grid gap-2">
              <h2 id="encerradas" className="px-1 text-sm font-semibold text-muted-foreground">Programação encerrada ({ended.length})</h2>
              {ended.map((s) => <SeriesCard key={s.id} s={s} today={today} />)}
            </section>
          )}
        </div>
      )}
    </>
  );
}
