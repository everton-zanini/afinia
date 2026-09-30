import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, Download, List, ListOrdered, Search } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { EmptyState } from "@/components/empty-state";
import { FormMessage } from "@/components/form";
import { Money } from "@/components/money";
import { TransactionRow } from "@/components/transaction-row";
import { Button } from "@/components/ui/button";
import { addMonths, formatDate, formatDayHeading, formatMonthLong, todayISO } from "@/lib/dates";
import { listAccounts } from "@/server/finance/accounts";
import { listCategories } from "@/server/finance/categories";
import { LIST_LIMIT, listTransactions, type TransactionDTO } from "@/server/finance/transactions";
import { requireHousehold } from "@/server/session";
import { FiltersSheet } from "./filters-sheet";
import { MonthCalendar } from "./month-calendar";
import { parseListParams, toQuery } from "./params";

export const metadata: Metadata = { title: "Lançamentos" };

function summarize(rows: TransactionDTO[]) {
  const s = { income: 0, expense: 0, incomePending: 0, expensePending: 0 };
  for (const t of rows) {
    if (t.kind === "TRANSFER") continue;
    if (t.status === "EFFECTIVE") s[t.kind === "INCOME" ? "income" : "expense"] += t.amountCents;
    else s[t.kind === "INCOME" ? "incomePending" : "expensePending"] += t.amountCents;
  }
  return s;
}

export default async function TransactionsPage({ searchParams }: PageProps<"/lancamentos">) {
  const { ctx } = await requireHousehold();
  const sp = await searchParams;
  const { filters, month, raw } = parseListParams(sp);
  const [rows, categories, accounts] = await Promise.all([
    listTransactions(ctx, filters),
    listCategories(ctx, { includeArchived: true }),
    listAccounts(ctx, { includeArchived: true }),
  ]);
  const today = todayISO();
  const summary = summarize(rows);
  const byDay = new Map<string, TransactionDTO[]>();
  for (const t of rows) byDay.set(t.referenceDate, [...(byDay.get(t.referenceDate) ?? []), t]);
  const activeFilters = ["q", "categoria", "conta", "situacao", "tipo", "pessoa", "de", "ate"].filter((k) => raw[k]).length;
  const periodLabel = month
    ? formatMonthLong(month)
    : filters.from || filters.to
      ? `${filters.from ? formatDate(filters.from) : "início"} a ${filters.to ? formatDate(filters.to) : "hoje"}`
      : "Todo o período";

  return (
    <>
      <PageHeader
        title="Lançamentos"
        actions={
          <Button asChild variant="ghost" size="icon" aria-label="Exportar CSV dos resultados filtrados">
            <a href={`/lancamentos/exportar${toQuery(raw)}`} download>
              <Download aria-hidden />
            </a>
          </Button>
        }
      />
      <div className="grid gap-4">
        {sp.salvo && <FormMessage ok message="Lançamento salvo." />}
        {sp.excluido && <FormMessage ok message="Lançamento excluído." />}

        <div className="flex items-center justify-between gap-2">
          {month ? (
            <Link href={`/lancamentos${toQuery(raw, { mes: addMonths(month, -1) })}`} aria-label="Mês anterior" className="flex size-11 items-center justify-center rounded-full hover:bg-muted">
              <ChevronLeft aria-hidden />
            </Link>
          ) : <span className="size-11" />}
          <p className="text-center font-semibold first-letter:uppercase">{periodLabel}</p>
          {month ? (
            <Link href={`/lancamentos${toQuery(raw, { mes: addMonths(month, 1) })}`} aria-label="Próximo mês" className="flex size-11 items-center justify-center rounded-full hover:bg-muted">
              <ChevronRight aria-hidden />
            </Link>
          ) : <span className="size-11" />}
        </div>

        <div className="flex gap-2">
          <form action="/lancamentos" method="get" role="search" className="relative min-w-0 flex-1">
            {Object.entries(raw).filter(([k]) => k !== "q").map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
            <label htmlFor="busca" className="sr-only">Buscar por descrição</label>
            <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              id="busca"
              name="q"
              type="search"
              defaultValue={raw.q ?? ""}
              placeholder="Buscar descrição"
              className="h-11 w-full rounded-lg border border-input bg-card pl-9 pr-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </form>
          <FiltersSheet
            raw={raw}
            categories={categories}
            accounts={accounts}
            members={ctx.members}
            activeCount={activeFilters - (raw.q ? 1 : 0)}
          />
        </div>

        {month && (
          <nav aria-label="Modo de visualização" className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
            {[
              { id: null, label: "Lista", Icon: List },
              { id: "calendario", label: "Calendário", Icon: CalendarDays },
            ].map(({ id, label, Icon }) => {
              const active = (raw.visao ?? null) === id;
              return (
                <Link
                  key={label}
                  href={`/lancamentos${toQuery(raw, { visao: id })}`}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-11 items-center justify-center gap-1.5 rounded-lg text-sm font-medium ${active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
                >
                  <Icon aria-hidden className="size-4" />
                  {label}
                </Link>
              );
            })}
          </nav>
        )}

        <section aria-label="Resumo do período" className="grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-card p-3 ring-1 ring-border">
            <p className="text-xs font-medium text-muted-foreground">Entrou (realizado)</p>
            <Money cents={summary.income} tone="income" className="text-lg font-semibold" />
            {summary.incomePending > 0 && (
              <p className="text-xs text-muted-foreground">+ <Money cents={summary.incomePending} /> previsto</p>
            )}
          </div>
          <div className="rounded-2xl bg-card p-3 ring-1 ring-border">
            <p className="text-xs font-medium text-muted-foreground">Saiu (realizado)</p>
            <Money cents={summary.expense} tone="expense" className="text-lg font-semibold" />
            {summary.expensePending > 0 && (
              <p className="text-xs text-muted-foreground">+ <Money cents={summary.expensePending} /> previsto</p>
            )}
          </div>
        </section>

        {month && raw.visao === "calendario" ? (
          <MonthCalendar
            month={month}
            rows={rows}
            today={today}
            linkQuery={(day) => toQuery(raw, { mes: null, visao: null, de: day, ate: day })}
          />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={ListOrdered}
            title={activeFilters ? "Nenhum lançamento encontrado" : "Nenhum lançamento neste período"}
            description={activeFilters ? "Tente ajustar a busca ou os filtros." : "Toque em “Novo lançamento” para registrar uma receita ou despesa."}
            action={activeFilters ? <Button asChild variant="outline"><Link href="/lancamentos">Limpar filtros</Link></Button> : undefined}
          />
        ) : (
          <div className="grid gap-4">
            {[...byDay.entries()].map(([day, items]) => (
              <section key={day} aria-labelledby={`d-${day}`}>
                <h2 id={`d-${day}`} className="mb-1.5 px-1 text-sm font-semibold text-muted-foreground first-letter:uppercase">
                  {formatDayHeading(day)}
                </h2>
                <ul className="divide-y overflow-hidden rounded-2xl bg-card ring-1 ring-border">
                  {items.map((t) => (
                    <li key={t.id}>
                      <TransactionRow t={t} today={today} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            {rows.length >= LIST_LIMIT && (
              <p className="text-center text-sm text-muted-foreground">
                Mostrando os {LIST_LIMIT} mais recentes. Use os filtros para refinar.
              </p>
            )}
          </div>
        )}
      </div>
    </>
  );
}
